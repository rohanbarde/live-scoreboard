    /* JUDO BHARAT v3 - full script
       - preserves all fields from your previous versions
       - timer-based logs (use match timer time)
       - big card overlays (pop-in), technique center overlay
       - 3-shido hansoku-make, pointer animation, stage mode, PDF/export
    */

    /* CONFIG */
    const HANSOKU_THRESHOLD = 3; // IJF standard - 3 shido -> hansoku-make
    const TECH_OVERLAY_MS = 2000;
    const BIG_CARD_MS = 2000;
    const SHIDO_POINTER_MS = 1500;
    let useWebAudioDing = true;

    /* Match state */
    const match = {
      durationMin: 4,
      remainingSec: 4 * 60,
      running: false,
      goldenScoreActive: false,
      timerId: null,
      location: '',  // Add this line
      matchNumber: 1,  // Add this line
      matNumber: 1,  // Add this line
      fighterA: { name: 'Fighter A', club: 'Club A', weight: '', waza: 0, ippon: 0, yuko: 0, shido: 0 },
      fighterB: { name: 'Fighter B', club: 'Club B', weight: '', waza: 0, ippon: 0, yuko: 0, shido: 0 },
      log: [],
      winnerName: null
    };

    /* helpers */
    function pad(n) { return String(n).padStart(2, '0'); }
    function formatTimeFromSec(sec) { sec = Math.max(0, Math.floor(sec)); return `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`; }
    function nowMatchTime() { return formatTimeFromSec(match.remainingSec); }

    // Function to check if action is allowed (only when timer is running)
    function isActionAllowed() {
      if (!match.running) {
        alert('Please start the timer before performing any actions.');
        return false;
      }
      return true;
    }

    /* init */
    function init() {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
        return;
      }
      // match duration
      const dur = document.getElementById('matchDuration');
      match.durationMin = Number(dur.value) || 4;
      match.remainingSec = match.durationMin * 60;
      updateTimerDisplay();

      // bind inputs and keep weight sync
      document.getElementById('matchDuration').addEventListener('change', (e) => {
  match.durationMin = Math.max(1, Number(e.target.value) || 4);
  resetTimer(); // This will handle the timer reset with the new duration
});

      document.getElementById('nameA').addEventListener('input', (e) => { match.fighterA.name = e.target.value; refreshUI(); });
      document.getElementById('clubA').addEventListener('input', (e) => { match.fighterA.club = e.target.value; refreshUI(); });
      document.getElementById('weightA').addEventListener('input', (e) => {
        match.fighterA.weight = e.target.value;
        match.fighterB.weight = e.target.value;
        document.getElementById('weightB').value = e.target.value;
        refreshUI();
      });

      document.getElementById('nameB').addEventListener('input', (e) => { match.fighterB.name = e.target.value; refreshUI(); });
      document.getElementById('clubB').addEventListener('input', (e) => { match.fighterB.club = e.target.value; refreshUI(); });
      document.getElementById('weightB').addEventListener('input', (e) => {
        match.fighterB.weight = e.target.value;
        match.fighterA.weight = e.target.value;
        document.getElementById('weightA').value = e.target.value;
        refreshUI();
      });

      // stage toggle
      const stageToggle = document.getElementById('stageToggle');
      const matchLocation = document.getElementById('matchLocation');
      const matchNumber = document.getElementById('matchNumber');
      const matNumber = document.getElementById('matNumber');

      if (stageToggle) {
        stageToggle.addEventListener('click', toggleStageMode);
      }

      if (matchLocation) {
        matchLocation.addEventListener('input', (e) => {
          match.location = e.target.value;
          saveMatch();
        });
      }

      if (matchNumber) {
        matchNumber.addEventListener('input', (e) => {
          match.matchNumber = Math.max(1, Number(e.target.value) || 1);
          saveMatch();
        });
      }

      if (matNumber) {
        matNumber.addEventListener('input', (e) => {
          match.matNumber = Math.max(1, Number(e.target.value) || 1);
          saveMatch();
        });
      }


      // initial render
      refreshUI();
    }

    /* UI refresh */
 function refreshUI() {
  // First, update the match object with current input values (only name and club)
  match.fighterA.name = document.getElementById('nameA').value || match.fighterA.name;
  match.fighterA.club = document.getElementById('clubA').value || match.fighterA.club;
  match.fighterB.name = document.getElementById('nameB').value || match.fighterB.name;
  match.fighterB.club = document.getElementById('clubB').value || match.fighterB.club;

  // Update the UI with the latest match data
  // Only update the scores from the match object, don't override them with input values
  document.getElementById('wazaA').textContent = match.fighterA.waza;
  document.getElementById('ipponA').textContent = match.fighterA.ippon;
  document.getElementById('yukoA').textContent = match.fighterA.yuko;
  document.getElementById('shidoA').textContent = match.fighterA.shido;

  document.getElementById('wazaB').textContent = match.fighterB.waza;
  document.getElementById('ipponB').textContent = match.fighterB.ippon;
  document.getElementById('yukoB').textContent = match.fighterB.yuko;
  document.getElementById('shidoB').textContent = match.fighterB.shido;

  // Update status and club displays
  document.getElementById('statusA').textContent = match.fighterA.club;
  document.getElementById('statusB').textContent = match.fighterB.club;

  // Ensure input fields reflect the current state
  document.getElementById('nameA').value = match.fighterA.name;
  document.getElementById('clubA').value = match.fighterA.club;
  document.getElementById('weightA').value = match.fighterA.weight;
  document.getElementById('nameB').value = match.fighterB.name;
  document.getElementById('clubB').value = match.fighterB.club;
  document.getElementById('weightB').value = match.fighterB.weight;

  // Update other UI elements
  renderSmallCards();
  document.getElementById('winnerLabel').textContent = match.winnerName || '—';
  document.getElementById('hansokuA').textContent = (match.fighterA.shido >= HANSOKU_THRESHOLD) ? 'HANSOKU-MAKE' : '';
  document.getElementById('hansokuB').textContent = (match.fighterB.shido >= HANSOKU_THRESHOLD) ? 'HANSOKU-MAKE' : '';

  updateTimerDisplay();
  renderLog();

  // Save to local storage
  saveMatch();

  // Trigger Firebase update if available
  if (typeof updateFirebase === 'function') {
    updateFirebase();
  }
}

/* render small card indicators */
function renderSmallCards() {
  const a = document.getElementById('smallCardA');
  const b = document.getElementById('smallCardB');

  // Clear existing cards
  a.innerHTML = '';
  b.innerHTML = '';

  // Function to render cards for a fighter
  function renderCards(container, shidoCount) {
    if (shidoCount >= 3) {
      // Show red card for 3 or more shidos
      const el = document.createElement('div');
      el.className = 'card-pill red';
      el.textContent = 'R';
      container.appendChild(el);
    } else {
      // Show yellow cards for 1-2 shidos
      for (let i = 0; i < shidoCount; i++) {
        const el = document.createElement('div');
        el.className = 'card-pill yellow';
        el.textContent = 'Y';
        container.appendChild(el);
      }
    }
  }

  // Render cards for both fighters
  renderCards(a, match.fighterA.shido);
  renderCards(b, match.fighterB.shido);

  // Update shido counts (hidden by CSS)
  document.getElementById('cardCountA').textContent = match.fighterA.shido;
  document.getElementById('cardCountB').textContent = match.fighterB.shido;
}

    /* Logging using match timer time */
    function pushLog(actor, action, info = '') {
      const entry = { t: nowMatchTime(), actor, action, info };
      match.log.push(entry);
      renderLog();
    }
    function renderLog() {
      const area = document.getElementById('logArea');
      area.innerHTML = '';
      match.log.slice().reverse().forEach(e => {
        const div = document.createElement('div'); div.className = 'event-row';
        div.innerHTML = `<div class="d-flex justify-content-between"><div><strong>${escapeHtml(e.actor)}</strong> · <span class="small-muted">${escapeHtml(e.action)}</span></div><div class="small-muted">${escapeHtml(e.t)}</div></div><div class="small-muted">${escapeHtml(e.info)}</div>`;
        area.appendChild(div);
      });
    }
    function escapeHtml(s) { return (s || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

    /* Sound (WebAudio with fallback) */
    const audioCtx = (window.AudioContext || window.webkitAudioContext) ? new (window.AudioContext || window.webkitAudioContext)() : null;
    function playDing() {
      if (audioCtx && useWebAudioDing) {
        try {
          const o = audioCtx.createOscillator();
          const g = audioCtx.createGain();
          o.type = 'sine';
          o.frequency.setValueAtTime(880, audioCtx.currentTime);
          g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
          o.connect(g); g.connect(audioCtx.destination);
          g.gain.exponentialRampToValueAtTime(0.12, audioCtx.currentTime + 0.01);
          o.frequency.exponentialRampToValueAtTime(660, audioCtx.currentTime + 0.12);
          g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.36);
          o.stop(audioCtx.currentTime + 0.36);
        } catch (e) {
          fallbackAudio();
        }
      } else {
        fallbackAudio();
      }
    }
    function fallbackAudio() {
      const a = document.getElementById('dingAudio');
      try { a.currentTime = 0; a.play(); } catch (e) { }
    }

    /* Overlay management */
    let techTimeout = null;
    let bigCardTimeoutA = null;
    let bigCardTimeoutB = null;
    let pointerTimeout = null;



    function showBigCard(side, colorClass, text) {
      const el = (side === 'A') ? document.getElementById('bigCardA') : document.getElementById('bigCardB');
      el.innerHTML = text || '';
      el.className = 'big-card ' + colorClass + ' show';
      el.setAttribute('aria-hidden', 'false');
      playDing();
      if (side === 'A') { if (bigCardTimeoutA) clearTimeout(bigCardTimeoutA); bigCardTimeoutA = setTimeout(() => { el.className = 'big-card ' + colorClass + ' hide'; el.setAttribute('aria-hidden', 'true'); }, BIG_CARD_MS); }
      else { if (bigCardTimeoutB) clearTimeout(bigCardTimeoutB); bigCardTimeoutB = setTimeout(() => { el.className = 'big-card ' + colorClass + ' hide'; el.setAttribute('aria-hidden', 'true'); }, BIG_CARD_MS); }
    }

    /* show pointer near shido count */
<!--    function showShidoPointer(side) {-->
<!--      const container = (side === 'A') ? document.getElementById('shidoA') : document.getElementById('shidoB');-->
<!--      // create temp pointer element near number-->
<!--      const parent = container.parentElement;-->
<!--      const pointer = document.createElement('div');-->
<!--      pointer.className = 'shido-pointer';-->
<!--      pointer.style.marginLeft = '8px';-->
<!--      parent.appendChild(pointer);-->
<!--      if (pointerTimeout) clearTimeout(pointerTimeout);-->
<!--      pointerTimeout = setTimeout(() => { try { parent.removeChild(pointer); } catch (e) { } }, SHIDO_POINTER_MS);-->
<!--    }-->

    /* scoring logic */
    function doTechnique(side, tech) {
      // Check if timer is running
      if (!isActionAllowed()) return;
      // side: 'A' or 'B' ; tech: 'Ippon'|'Waza'|'Yuko'|'Shido'
      const f = (side === 'A') ? match.fighterA : match.fighterB;
      const opp = (side === 'A') ? match.fighterB : match.fighterA;
      if (tech === 'Ippon') {

        if (f.ippon < 1) {
          f.ippon = 1;  // Set to exactly 1 (not increment)
          pushLog(f.name, 'Ippon', `${f.name} awarded Ippon`);
          match.winnerName = f.name;
          showBigCard(side, 'yellow', 'IPPON');
          // do NOT auto-stop the timer (manual control)
        } else {
          return;  // Already has ippon, ignore additional clicks
        }
        //f.ippon += 1;
        //pushLog(f.name, 'Ippon', `${f.name} awarded Ippon`);
        //match.winnerName = f.name;

<!--        showBigCard(side, 'yellow', 'IPPON');-->
        // do NOT auto-stop the timer (manual control)
      } else if (tech === 'Waza') {

        if (f.waza < 2) {
          f.waza += 1;
          pushLog(f.name, 'Waza-ari', `${f.name} awarded Waza-ari (${f.waza})`);
          showBigCard(side, 'white', 'WAZA-ARI');
          if (f.waza >= 2) {
            // awasete ippon
            f.ippon = 1;  // Set to exactly 1 (not increment)
            pushLog(f.name, 'Waza-ari Awasete Ippon', `${f.name} 2 Waza-ari -> Ippon`);
            match.winnerName = f.name;
            showBigCard(side, 'yellow', 'IPPON');
          }
        }
        // f.waza += 1;
        // pushLog(f.name, 'Waza-ari', `${f.name} awarded Waza-ari (${f.waza})`);

        // showBigCard(side, 'white', 'WAZA-ARI');
        // if (f.waza >= 2) {
        //   // awasete ippon
        //   f.ippon += 1;
        //   pushLog(f.name, 'Waza-ari Awasete Ippon', `${f.name} 2 Waza-ari -> Ippon`);
        //   match.winnerName = f.name;

        //   showBigCard(side, 'yellow', 'IPPON');
        // }
      } else if (tech === 'Yuko') {
        f.yuko += 1;
        pushLog(f.name, 'Yuko', `${f.name} awarded Yuko`);

        showBigCard(side, 'white', 'YUKO');
      } else if (tech === 'Shido') {
        f.shido += 1;
        pushLog(f.name, 'Shido', `${f.name} now has ${f.shido} Shido`);

        showBigCard(side, 'yellow', 'SHIDO');
        // show pointer near shido count
<!--        showShidoPointer(side);-->
        // hansoku check
        if (f.shido >= HANSOKU_THRESHOLD) {
          // hansoku-make
          pushLog(f.name, 'Hansoku-make', `${f.name} receives Hansoku-make (Shido ${f.shido})`);
          match.winnerName = opp.name;

          // show red big card as well
          showBigCard(side, 'red', 'HANSOKU');
        }

        if (side === 'A') {
          document.getElementById('statusA').textContent = 'Yellow Card';
        } else {
          document.getElementById('statusB').textContent = 'Yellow Card';
        }

      }
      refreshUI();
    }

    /* red card manual */
    function giveRedCard(side) {
      // Check if timer is running
      if (!isActionAllowed()) return;
      const f = (side === 'A') ? match.fighterA : match.fighterB;
      const opp = (side === 'A') ? match.fighterB : match.fighterA;
      if (side === 'A') {
        document.getElementById('statusA').textContent = 'Red Card';
      } else {
        document.getElementById('statusB').textContent = 'Red Card';
      }
      pushLog(f.name, 'Red Card (Hansoku-make)', `${f.name} given Red Card → Hansoku-make`);
      match.winnerName = opp.name;
      showTechniqueCenter('HANSOKU-MAKE', 'hansoku');
      showBigCard(side, 'red', 'HANSOKU');
      refreshUI();
    }

    /* undo last action for a side */
    function undoLast(side) {
      // Check if timer is running
      if (!isActionAllowed()) return;
      // Check if timer is running
      if (!isActionAllowed()) return;
      const fighterName = (side === 'A') ? match.fighterA.name : match.fighterB.name;
      for (let i = match.log.length - 1; i >= 0; i--) {
        const e = match.log[i];
        if (e.actor === fighterName) {
          // reverse by action label
          if (e.action === 'Ippon' || e.action === 'Waza-ari Awasete Ippon') {
            const f = (side === 'A') ? match.fighterA : match.fighterB;
            if (f.ippon > 0) f.ippon--;
            if (e.action === 'Waza-ari Awasete Ippon') f.waza = Math.max(0, f.waza - 2);
          } else if (e.action === 'Waza-ari') {
            const f = (side === 'A') ? match.fighterA : match.fighterB;
            f.waza = Math.max(0, f.waza - 1);
          } else if (e.action === 'Yuko') {
            const f = (side === 'A') ? match.fighterA : match.fighterB;
            f.yuko = Math.max(0, f.yuko - 1);
          } else if (e.action === 'Shido') {
            const f = (side === 'A') ? match.fighterA : match.fighterB;
            f.shido = Math.max(0, f.shido - 1);
          } else if (e.action === 'Red Card (Hansoku-make)' || e.action === 'Hansoku-make') {
            match.winnerName = null;
          } else if (e.action === 'Ippon' && match.winnerName) {
            match.winnerName = null;
          }
          match.log.splice(i, 1);
          pushLog('System', 'Undo', `Undo last for ${fighterName}`);
          refreshUI();
          return;
        }
      }
      alert('No recent action found for this fighter');
    }

    /* declare winner manually */
    function declareWinner(side) {
      if (!side) { // no specified side: ask or skip
        return alert('Specify side to declare winner.');
      }
      const winner = (side === 'A') ? match.fighterA.name : match.fighterB.name;
      match.winnerName = winner;
      pushLog('Referee', 'Declare Winner', `${winner} declared winner manually`);
      refreshUI();
    }

    /* timer controls */
function updateTimerDisplay() {
  const timerDisplay = document.getElementById('timerDisplay');
  if (match.goldenScoreActive) {
    timerDisplay.innerHTML = formatTimeFromSec(match.remainingSec) + ' <span style="color: gold; font-size: 0.7em;">GS</span>';
  } else {
    timerDisplay.textContent = formatTimeFromSec(match.remainingSec);
  }
}

    function startPauseTimer() {
  const btn = document.getElementById('startBtn');
  if (!match.running) {
    match.running = true;
    btn.textContent = 'Pause';
    match.timerId = setInterval(() => {
      if (match.goldenScoreActive) {
        // In golden score, count up
        match.remainingSec += 1;
      } else {
        // Normal countdown
        match.remainingSec = Math.max(0, match.remainingSec - 1);
      }
      updateTimerDisplay();

      // Check for end of regular time
      if (match.remainingSec <= 0 && !match.goldenScoreActive) {
        startGoldenScore();
      }
    }, 1000);
  } else {
    match.running = false;
    btn.textContent = 'Start';
    clearInterval(match.timerId);
  }
}

function startGoldenScore() {
  match.goldenScoreActive = true;
  match.remainingSec = 0; // Reset to 0 and start counting up
  pushLog('System', 'Golden Score', 'Golden Score period started');
  showTechniqueCenter('GOLDEN SCORE', 'ippon');
  playDing();
}

   function resetTimer() {
  if (match.running) {
    clearInterval(match.timerId);
    match.running = false;
    document.getElementById('startBtn').textContent = 'Start';
  }
  match.goldenScoreActive = false;
  // Update durationMin from the input field
  match.durationMin = Math.max(1, Number(document.getElementById('matchDuration').value) || 4);
  // Then set remaining seconds based on the updated duration
  match.remainingSec = match.durationMin * 60;
  updateTimerDisplay();
}
    function endMatch() { if (!confirm('End match now?')) return; match.remainingSec = 0; updateTimerDisplay(); onTimeExpired(); }

    /* when time finishes determine winner */
    function onTimeExpired() {
      pushLog('System', 'Time End', 'Match time ended');
      const a = match.fighterA, b = match.fighterB;
      let winner = null;
      if (a.ippon > 0 && b.ippon === 0) winner = a.name;
      else if (b.ippon > 0 && a.ippon === 0) winner = b.name;
      else {
        if (a.waza > b.waza) winner = a.name;
        else if (b.waza > a.waza) winner = b.name;
        else if (a.yuko > b.yuko) winner = a.name;
        else if (b.yuko > a.yuko) winner = b.name;
        else if (a.shido < b.shido) winner = a.name;
        else if (b.shido < a.shido) winner = b.name;
        else winner = 'Draw / Hantei';
      }
      match.winnerName = winner;
      pushLog('System', 'Result', `Winner: ${winner}`);
      showTechniqueCenter('Result: ' + (winner || '—'), 'hansoku');
      refreshUI();
    }

    /* reset match (keeps names/clubs) */
    function resetMatch() {
      if (!confirm('Reset match (this will clear scores and log)?')) return;
      match.fighterA.waza = match.fighterA.ippon = match.fighterA.yuko = match.fighterA.shido = 0;
      match.fighterB.waza = match.fighterB.ippon = match.fighterB.yuko = match.fighterB.shido = 0;
      match.log = [];
      match.winnerName = null;
      match.goldenScoreActive = false;
      match.location = document.getElementById('matchLocation').value || '';
      match.matchNumber = Number(document.getElementById('matchNumber').value) || 1;
      match.matNumber = Number(document.getElementById('matNumber').value) || 1;

      resetTimer();
      pushLog('System', 'Reset', 'Match reset');
      refreshUI();
    }

    /* save/load local */
    function saveMatch() {
      const matchNumber = document.getElementById("matchNumber").value;
      const matchTime = document.getElementById("matchTime").value;
      const payload = {
        created: new Date().toISOString(),
        durationMin: Number(document.getElementById("matchDuration").value),
        fighterA: match.fighterA,
        fighterB: match.fighterB,
        log: match.log,
        winner: match.winnerName,
        notes: document.getElementById("matchNotes").value,
        location: match.location,
        matchNumber: matchNumber,
        matNumber: match.matNumber,
        matchTime: matchTime
      };
      localStorage.setItem("last_judo_match_v3", JSON.stringify(payload));
    }
    function loadLastMatch() {
      const raw = localStorage.getItem('last_judo_match_v3');
      if (!raw) return alert('No saved match found.');
      const payload = JSON.parse(raw);
      match.fighterA = payload.fighterA;
      match.fighterB = payload.fighterB;
      match.log = payload.log || [];
      match.winnerName = payload.winner || null;
      match.location = payload.location || '';
      match.matchNumber = payload.matchNumber || '';
      match.matNumber = payload.matNumber || 1;
      match.matchTime = payload.matchTime || '';
      document.getElementById('matchNotes').value = payload.notes || '';
      document.getElementById('matchDuration').value = payload.durationMin || 4;
      document.getElementById('matchLocation').value = match.location;
      document.getElementById('matchNumber').value = match.matchNumber || '';
      document.getElementById('matchTime').value = match.matchTime || '';
      document.getElementById('matNumber').value = match.matNumber;
      match.remainingSec = (payload.durationMin || 4) * 60;
      refreshUI();
      alert('Last match loaded.');
    }
    /* Export log JSON / CSV */
    function exportLog(format) {
      if (!match.log.length) return alert('No events to export.');
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      if (format === 'json') {
        const blob = new Blob([JSON.stringify(match.log, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `judo_match_log_${ts}.json`; a.click();
      } else {
        const rows = [['time', 'actor', 'action', 'info']];
        match.log.forEach(r => rows.push([r.t, r.actor, r.action, `"${(r.info || '').replace(/"/g, '""')}"`]));
        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `judo_match_log_${ts}.csv`; a.click();
      }
    }

    /* print log */
    function printLog() {
      const w = window.open('', '_blank');
      w.document.write('<html><head><title>Match Log</title></head><body style="font-family:Arial;padding:20px;color:#000">');
      w.document.write(`<h3>Judo Match Log — ${new Date().toLocaleString()}</h3>`);
      w.document.write('<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%"><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Info</th></tr></thead><tbody>');
      match.log.forEach(it => {
        w.document.write(`<tr><td>${it.t}</td><td>${escapeHtml(it.actor)}</td><td>${escapeHtml(it.action)}</td><td>${escapeHtml(it.info)}</td></tr>`);
      });
      w.document.write('</tbody></table>');
      w.document.write('</body></html>');
      w.document.close();
    }

    // Helper to render card pills for PDF
    function renderCardPills(shidoCount) {
      if (shidoCount === 0) {
        return '<span style="color:#888;">No cards</span>';
      }
      if (shidoCount === 1) {
        return '<div style="display:flex;gap:8px;">' +
          '<span style="display:inline-block;width:34px;height:60px;background:linear-gradient(180deg,#fff7d8,#ffd24a);border-radius:10px;border:3px solid #fff;font-weight:900;font-size:18px;display:flex;align-items:center;justify-content:center;">Y</span>' +
          '</div>';
      }
      if (shidoCount === 2) {
        return '<div style="display:flex;gap:8px;">' +
          '<span style="display:inline-block;width:34px;height:60px;background:linear-gradient(180deg,#fff7d8,#ffd24a);border-radius:10px;border:3px solid #fff;font-weight:900;font-size:18px;display:flex;align-items:center;justify-content:center;">Y</span>' +
          '<span style="display:inline-block;width:34px;height:60px;background:linear-gradient(180deg,#fff7d8,#ffd24a);border-radius:10px;border:3px solid #fff;font-weight:900;font-size:18px;display:flex;align-items:center;justify-content:center;">Y</span>' +
          '</div>';
      }
      // Red card
      return '<div style="display:flex;gap:8px;">' +
        '<span style="display:inline-block;width:34px;height:60px;background:linear-gradient(180deg,#ff9b9b,#ff4b4b);border-radius:10px;border:3px solid #fff;color:#fff;text-align:center;line-height:60px;font-weight:900;display:flex;align-items:center;justify-content:center;font-size:18px;">R</span>' +
        '</div>';
    }

    // Helper to render points grid for PDF
    function renderPointsGrid(fighter) {
      return `
    <div style="display:flex;gap:14px;align-items:center;margin-top:6px;">
      <div style="text-align:center;min-width:82px;">
        <div style="font-size:13px;color:#888;font-weight:700;">IPPON</div>
        <div style="font-size:36px;font-weight:800;margin-top:6px;">${fighter.ippon}</div>
      </div>
      <div style="text-align:center;min-width:82px;">
        <div style="font-size:13px;color:#888;font-weight:700;">WAZA-ARI</div>
        <div style="font-size:36px;font-weight:800;margin-top:6px;">${fighter.waza}</div>
      </div>
      <div style="text-align:center;min-width:82px;">
        <div style="font-size:13px;color:#888;font-weight:700;">YUKO</div>
        <div style="font-size:36px;font-weight:800;margin-top:6px;">${fighter.yuko}</div>
      </div>
      <div style="text-align:center;min-width:82px;">
        <div style="font-size:13px;color:#888;font-weight:700;">SHIDO</div>
        <div style="font-size:36px;font-weight:800;margin-top:6px;">${fighter.shido}</div>
      </div>
    </div>
  `;
    }

    /* Save to PDF (open print) */
    function savePdf() {
  const w = window.open('', '_blank');
  const matchNumber = document.getElementById("matchNumber").value;
<!--  const matchTime = document.getElementById("matchTime").value;-->
  const weightCategory = document.getElementById("weightCategory").value;
  const matNumber = document.getElementById("matNumber").value;  // Get mat number

  w.document.write('<html><head><title>Match Report</title>');
  w.document.write('<style>@media print { body, .card-pill { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }</style>');
  w.document.write('</head><body style="font-family:Arial;color:#000;padding:18px">');
  w.document.write(`<h2>JUDO BHARAT — Match Report</h2>`);
  w.document.write(`<p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>`);
  if (weightCategory) w.document.write(`<p><strong>Weight Category:</strong> ${escapeHtml(weightCategory)}</p>`);
<!--  if (matchTime) w.document.write(`<p><strong>Match Number:</strong> ${escapeHtml(matchTime)}</p>`);-->
  if (matNumber) w.document.write(`<p><strong>Mat Number:</strong> ${escapeHtml(matNumber)}</p>`);

<!--      w.document.write('<h3>Players</h3>');-->
<!--      w.document.write(`<p><strong>A:</strong> ${escapeHtml(match.fighterA.name)} — ${escapeHtml(match.fighterA.club)} — ${escapeHtml(match.fighterA.weight)}</p>`);-->
<!--      w.document.write(`<p><strong>B:</strong> ${escapeHtml(match.fighterB.name)} — ${escapeHtml(match.fighterB.club)} — ${escapeHtml(match.fighterB.weight)}</p>`);-->
      // In savePdf(), replace the Status Point Cards & Points section with:
      w.document.write('<h3>Status Point Cards & Points</h3>');
      w.document.write('<div style="display:flex;gap:32px;margin-bottom:18px;">');
      w.document.write(`
  <div style="flex:1;border:3px solid #0b2a8a;border-radius:12px;padding:12px;">
<!--    <div style="font-weight:700;font-size:1.1em;">${escapeHtml(match.fighterA.name)}</div>-->
<div style="font-weight:700;font-size:1.1em;">${escapeHtml(match.fighterA.name)} <span style="font-weight:normal;opacity:0.7;font-size:0.9em">(${escapeHtml(match.fighterA.club)})</span></div>

    ${renderCardPills(match.fighterA.shido)}
    ${renderPointsGrid(match.fighterA)}
  </div>
  <div style="flex:1;border:3px solid #000;border-radius:12px;padding:12px;">
<!--    <div style="font-weight:700;font-size:1.1em;">${escapeHtml(match.fighterB.name)}</div>-->
<div style="font-weight:700;font-size:1.1em;">${escapeHtml(match.fighterB.name)} <span style="font-weight:normal;opacity:0.7;font-size:0.9em">(${escapeHtml(match.fighterB.club)})</span></div>

    ${renderCardPills(match.fighterB.shido)}
    ${renderPointsGrid(match.fighterB)}
  </div>
`);
      w.document.write('</div>');
      w.document.write('</div>');
      w.document.write('<h3>Summary</h3>');
      w.document.write('<ul>');
      w.document.write(`<li>A — Ippon: ${match.fighterA.ippon}, Waza-ari: ${match.fighterA.waza}, Yuko: ${match.fighterA.yuko}, Shido: ${match.fighterA.shido}</li>`);
      w.document.write(`<li>B — Ippon: ${match.fighterB.ippon}, Waza-ari: ${match.fighterB.waza}, Yuko: ${match.fighterB.yuko}, Shido: ${match.fighterB.shido}</li>`);
      w.document.write('</ul>');
      w.document.write(`<p><strong>Winner:</strong> ${escapeHtml(match.winnerName || '—')}</p>`);
      w.document.write('<h3>Events</h3>');
      w.document.write('<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%"><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Info</th></tr></thead><tbody>');
      match.log.forEach(it => {
        w.document.write(`<tr><td>${it.t}</td><td>${escapeHtml(it.actor)}</td><td>${escapeHtml(it.action)}</td><td>${escapeHtml(it.info)}</td></tr>`);
      });
      w.document.write('</tbody></table>');
      w.document.write('</body></html>');
      w.document.close();
      setTimeout(() => { try { w.print(); } catch (e) { } }, 350);
    }

    /* Stage mode toggle: hide operator-like controls for audience */
    let stageMode = false;
    function toggleStageMode() {
      stageMode = !stageMode;
      const controls = document.querySelectorAll('.btn-score, .operator-panel, .card-surface .btn-outline-light, #stageToggle');
      // We'll hide operator area by hiding the operator actions only (we kept layout fields)
      const operatorPanel = document.querySelector('.operator-panel');
      // We used individual buttons - easier: hide action button groups (they are in fighter boxes)
      const actionButtons = document.querySelectorAll('.fighter-box .btn-score, .fighter-box .btn-light, .fighter-box .btn-outline-danger, .fighter-box .btn-outline-warning');
      if (stageMode) {
        // hide buttons and log controls to keep pure scoreboard
        actionButtons.forEach(b => b.style.display = 'none');
        document.querySelectorAll('.card-surface > .d-flex .btn, .card-surface .export-btn').forEach(x => x.style.display = 'none');
        document.getElementById('stageToggle').textContent = '🔧 Operator Mode';
        // optionally go fullscreen
        try { document.documentElement.requestFullscreen(); } catch (e) { }
      } else {
        actionButtons.forEach(b => b.style.display = 'inline-block');
        document.querySelectorAll('.card-surface > .d-flex .btn, .card-surface .export-btn').forEach(x => x.style.display = 'inline-block');
        document.getElementById('stageToggle').textContent = '🎥 Stage Mode';
        try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { }
      }
    }

    /* fullscreen helper */
    function toggleFullscreen() {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
      } else { document.exitFullscreen && document.exitFullscreen(); }
    }

    // Make functions available globally
    window.declareWinner = declareWinner;
    window.startPauseTimer = startPauseTimer;
    window.resetTimer = resetTimer;
    window.resetMatch = resetMatch;
    window.saveMatch = saveMatch;
    window.loadLastMatch = loadLastMatch;
    window.exportLog = exportLog;
    window.printLog = printLog;
    window.savePdf = savePdf;
