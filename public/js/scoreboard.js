    /* JUDO BHARAT v3 - full script
       - preserves all fields from your previous versions
       - timer-based logs (use match timer time)
       - big card overlays (pop-in), technique center overlay
       - 3-shido hansoku-make, pointer animation, PDF/export
    */

    /* CONFIG */
    const HANSOKU_THRESHOLD = 3; // IJF standard - 3 shido -> hansoku-make
    const TECH_OVERLAY_MS = 2000;
    const BIG_CARD_MS = 2000;
    const SHIDO_POINTER_MS = 1500;

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
      winnerName: null,
      // Hold timer state
      holdTimer: {
        active: false,
        player: null, // 'A' or 'B'
        remainingSec: 20,
        timerId: null,
        type: 'normal' // 'normal' (20s) or 'waza-ari' (10s)
      }
    };

    /* helpers */
    /**
     * Gets the current match time in MM:SS format
     * @returns {string} Formatted match time
     */
    function nowMatchTime() { 
        return window.formatTimeFromSec ? window.formatTimeFromSec(match.remainingSec) : '00:00'; 
    }

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

  // Ensure input fields reflect the current state
  const nameA = document.getElementById('nameA');
  const clubA = document.getElementById('clubA');
  const weightA = document.getElementById('weightA');
  const nameB = document.getElementById('nameB');
  const clubB = document.getElementById('clubB');
  const weightB = document.getElementById('weightB');
  
  if (nameA) nameA.value = match.fighterA.name;
  if (clubA) clubA.value = match.fighterA.club;
  if (weightA) weightA.value = match.fighterA.weight || '';
  if (nameB) nameB.value = match.fighterB.name;
  if (clubB) clubB.value = match.fighterB.club;
  if (weightB) weightB.value = match.fighterB.weight || '';

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
    if (shidoCount === 0) {
      // Show "0" when no shidos
      const el = document.createElement('div');
      el.className = 'score-num';
      el.textContent = '0';
      el.style.fontSize = '36px';
      el.style.fontWeight = '800';
      container.appendChild(el);
    } else if (shidoCount >= 3) {
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
      if (!area) return;
      
      const escape = window.escapeHtml || (s => (s || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;'));
      area.innerHTML = '';
      
      match.log.slice().reverse().forEach(e => {
        const div = document.createElement('div');
        div.className = 'event-row';
        div.innerHTML = `
          <div class="d-flex justify-content-between">
            <div>
              <strong>${escape(e.actor)}</strong> · 
              <span class="small-muted">${escape(e.action)}</span>
            </div>
            <div class="small-muted">${escape(e.t)}</div>
          </div>
          <div class="small-muted">${escape(e.info)}</div>`;
        area.appendChild(div);
      });
    }

    /* Sound (WebAudio) */
    const audioCtx = (window.AudioContext || window.webkitAudioContext) ? new (window.AudioContext || window.webkitAudioContext)() : null;


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
      if (side === 'A') {
        if (bigCardTimeoutA) clearTimeout(bigCardTimeoutA);
        bigCardTimeoutA = setTimeout(() => {
          el.className = 'big-card ' + colorClass + ' hide';
          el.setAttribute('aria-hidden', 'true');
        }, BIG_CARD_MS);
      } else {
        if (bigCardTimeoutB) clearTimeout(bigCardTimeoutB);
        bigCardTimeoutB = setTimeout(() => {
          el.className = 'big-card ' + colorClass + ' hide';
          el.setAttribute('aria-hidden', 'true');
        }, BIG_CARD_MS);
      }
    }

    /* Shido pointer animation removed - unused in current UI */

    /* scoring logic */
function doTechnique(side, tech, detail) {
  if (!isActionAllowed()) return;

  const f = side === 'A' ? match.fighterA : match.fighterB;
  const opp = side === 'A' ? match.fighterB : match.fighterA;

  const actions = {
    Ippon: () => handleIppon(f, side, detail),
    Waza: () => handleWaza(f, side, detail),
    Yuko: () => handleYuko(f, side, detail),
    Shido: () => handleShido(f, opp, side, detail)
  };

  const action = actions[tech];
  if (action) action();

  refreshUI();
}

/* ---------- Helper functions ---------- */

function handleIppon(f, side, detail) {
  if (f.ippon >= 1) return; // already has ippon
  f.ippon = 1;
  pushLog(f.name, 'Ippon', `${f.name} awarded Ippon${detail ? ' by ' + detail : ''}`);
  match.winnerName = f.name;
  showBigCard(side, 'yellow', 'IPPON');

  stopMainTimer();
}


function handleWaza(f, side, detail) {
  if (f.ippon >= 1) return; // already has ippon
  f.waza += 1;
  pushLog(f.name, 'Waza-ari', `${f.name} awarded Waza-ari (${f.waza})${detail ? ' by ' + detail : ''}`);
  showBigCard(side, 'white', 'WAZA-ARI');

  if (f.waza >= 2) {
    // Convert 2 Waza-ari → 1 Ippon
    f.waza = 0;
    f.ippon = 1;
    match.winnerName = f.name;
    pushLog(f.name, 'Waza-ari Awasete Ippon', `${f.name} 2 Waza-ari → Ippon${detail ? ' by ' + detail : ''}`);
    showBigCard(side, 'yellow', 'IPPON');
    stopMainTimer();
  }
}


function handleYuko(f, side, detail) {
  f.yuko += 1;
  pushLog(f.name, 'Yuko', `${f.name} awarded Yuko${detail ? ' by ' + detail : ''}`);
  showBigCard(side, 'white', 'YUKO');
}

function handleShido(f, opp, side, detail) {
  f.shido += 1;
  pushLog(f.name, 'Shido', `${f.name} now has ${f.shido} Shido${detail ? ' (Reason: ' + detail + ')' : ''}`);
  
  // Determine card color based on shido count
  let cardColor, cardText, statusText;
  
  if (f.shido >= HANSOKU_THRESHOLD) {
    // 3rd shido = Red card (Hansoku-make)
    cardColor = 'red';
    cardText = 'HANSOKU';
    pushLog(f.name, 'Hansoku-make', `${f.name} receives Hansoku-make (Shido ${f.shido})${detail ? ' (Reason: ' + detail + ')' : ''}`);
    match.winnerName = opp.name;
  } else {
    // 1st and 2nd shido = Yellow card
    cardColor = 'yellow';
    cardText = 'SHIDO';
  }
  
  showBigCard(side, cardColor, cardText);

  refreshUI();
}

    /* red card manual */
    function giveRedCard(side) {
      // Check if timer is running
      if (!isActionAllowed()) return;
      const f = (side === 'A') ? match.fighterA : match.fighterB;
      const opp = (side === 'A') ? match.fighterB : match.fighterA;
      pushLog(f.name, 'Red Card (Hansoku-make)', `${f.name} given Red Card → Hansoku-make`);
      match.winnerName = opp.name;
      showTechniqueCenter('HANSOKU-MAKE', 'hansoku');
      showBigCard(side, 'red', 'HANSOKU');
      refreshUI();
    }

    /* undo last action for a side */
function undoLast(side) {
  if (!isActionAllowed()) return;

  const fighter = side === 'A' ? match.fighterA : match.fighterB;
  const fighterName = fighter.name;
  const lastActionIndex = findLastActionIndex(fighterName);

  if (lastActionIndex === -1) {
    alert('No recent action found for this fighter');
    return;
  }

  const event = match.log[lastActionIndex];
  undoAction(event.action, fighter, side);
  match.log.splice(lastActionIndex, 1);

  pushLog('System', 'Undo', `Undo last for ${fighterName}`);
  refreshUI();
}

/* ---------------- Helper functions ---------------- */

function findLastActionIndex(fighterName) {
  for (let i = match.log.length - 1; i >= 0; i--) {
    if (match.log[i].actor === fighterName) {
      return i;
    }
  }
  return -1;
}

function undoAction(action, fighter, side) {
  const actionsMap = {
    'Ippon': () => { if (fighter.ippon > 0) fighter.ippon--; match.winnerName = null; },
    'Waza-ari Awasete Ippon': () => {
      if (fighter.ippon > 0) fighter.ippon--;
      fighter.waza = Math.max(0, fighter.waza - 2);
      match.winnerName = null;
    },
    'Waza-ari': () => { fighter.waza = Math.max(0, fighter.waza - 1); },
    'Yuko': () => { fighter.yuko = Math.max(0, fighter.yuko - 1); },
    'Shido': () => { fighter.shido = Math.max(0, fighter.shido - 1); },
    'Hansoku-make': () => { match.winnerName = null; },
    'Red Card (Hansoku-make)': () => { match.winnerName = null; }
  };

  const handler = actionsMap[action];
  if (handler) handler();
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
  if (!timerDisplay) return;
  // GS: golden color, running: white, stopped: red
  if (match.goldenScoreActive) {
    timerDisplay.innerHTML = formatTimeFromSec(match.remainingSec) + ' <span style="color: gold; font-size: 0.7em;">GS</span>';
    timerDisplay.style.color = '#FFD700';
//    timerDisplay.style.textShadow = '0 0 8px #FFD700, 0 0 2px #fff';
  } else if (match.running) {
    timerDisplay.textContent = formatTimeFromSec(match.remainingSec);
    timerDisplay.style.color = '#fff';
//    timerDisplay.style.textShadow = '0 0 8px #fff, 0 0 2px #222';
  } else {
    timerDisplay.textContent = formatTimeFromSec(match.remainingSec);
    timerDisplay.style.color = '#ff3333';
//    timerDisplay.style.textShadow = '0 0 8px #ff3333, 0 0 2px #fff';
  }
}

    function startPauseTimer() {
  const btn = document.getElementById('startBtn');
  if (!match.running) {
    match.running = true;
    btn.textContent = 'Pause';
    
    // Resume hold timer if it was active
    if (match.holdTimer.active && !match.holdTimer.timerId) {
      match.holdTimer.timerId = setInterval(() => {
        match.holdTimer.remainingSec--;
        updateHoldTimerDisplay();
        
        // Check if hold timer completed
        if (match.holdTimer.remainingSec <= 0) {
          completeHoldTimer();
        }
      }, 1000);
      pushLog('System', 'Hold Timer Resumed', 'Hold timer resumed with match timer');
    }
    
    match.timerId = setInterval(() => {
      if (match.goldenScoreActive) {
        // In golden score, count up
        match.remainingSec += 1;
        updateTimerDisplay();
      } else {
        // Normal countdown
        if (match.remainingSec > 0) {
          match.remainingSec -= 1;
          updateTimerDisplay();
          
          // Check if we just hit 0:00
          if (match.remainingSec === 0) {
            // Timer reached 0, stop the timer and prepare for golden score
            clearInterval(match.timerId);
            match.running = false;
            match.goldenScoreActive = true; // Set GS flag
            document.getElementById('startBtn').textContent = 'Start';
            updateTimerDisplay();
            pushLog('System', 'Time End', 'Match time ended');
            showTechniqueCenter('GOLDEN SCORE', 'ippon');
            return;
          }
        }
      }
    }, 1000);
  } else {
    match.running = false;
    btn.textContent = 'Start';
    clearInterval(match.timerId);
    
    // Also pause hold timer when main timer is paused
    if (match.holdTimer.active) {
      clearInterval(match.holdTimer.timerId);
      pushLog('System', 'Hold Timer Paused', 'Hold timer paused with match timer');
    }
  }
}

function startGoldenScore() {
  // Only allow starting golden score if we're at 00:00 and not already in golden score
  if (match.remainingSec === 0 || match.goldenScoreActive) {
    if (!match.running) {
      // Starting or resuming golden score
      match.running = true;
      match.goldenScoreActive = true;
      document.getElementById('startBtn').textContent = 'Pause';
      
      if (match.remainingSec === 0) {
        pushLog('System', 'Golden Score', 'Golden Score period started');
        showTechniqueCenter('GOLDEN SCORE', 'ippon');
      } else {
        pushLog('System', 'Golden Score', 'Golden Score resumed');
      }
      
      // Start the timer for golden score
      match.timerId = setInterval(() => {
        match.remainingSec += 1;
        updateTimerDisplay();
      }, 1000);
    } else {
      // Pause golden score
      match.running = false;
      clearInterval(match.timerId);
      document.getElementById('startBtn').textContent = 'Start';
      pushLog('System', 'Golden Score', 'Golden Score paused');
    }
  }
}

   function resetTimer() {
  // Clear any running timers
  if (match.running) {
    clearInterval(match.timerId);
  }
  
  // Reset match state
  match.running = false;
  match.goldenScoreActive = false;
  
  // Update duration from input field
  match.durationMin = Math.max(1, Number(document.getElementById('matchDuration').value) || 4);
  match.remainingSec = match.durationMin * 60;
  
  // Update UI
  document.getElementById('startBtn').textContent = 'Start';
  updateTimerDisplay();
  
  // Stop hold timer when main timer is reset
  stopHoldTimer();
  
  // Log the reset
  pushLog('System', 'Timer Reset', `Match timer reset to ${match.durationMin} minutes`);
}
function endMatch() {
  const confirmEnd = confirm('End match now?');
  if (!confirmEnd) return;

  match.remainingSec = 0;
  updateTimerDisplay();
  onTimeExpired();
}

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

      // Reset hold timer
      stopHoldTimer();

      resetTimer();
      pushLog('System', 'Reset', 'Match reset');
      refreshUI();
    }

    /* save/load local */
    function saveMatch() {
      // Safely get element values with null checks
      const getSafeValue = (id, defaultValue = '') => {
        const el = document.getElementById(id);
        return el ? el.value : defaultValue;
      };
      
      const matchNumber = getSafeValue("matchNumber");
      const matchTime = getSafeValue("matchTime");
      const matchDuration = Number(getSafeValue("matchDuration", 4));
      const notes = getSafeValue("matchNotes");
      
      const payload = {
        created: new Date().toISOString(),
        durationMin: matchDuration,
        fighterA: match.fighterA,
        fighterB: match.fighterB,
        log: match.log,
        winner: match.winnerName || '',
        notes: notes,
        location: match.location || '',
        matchNumber: matchNumber,
        matNumber: match.matNumber || 1,
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
      const escape = window.escapeHtml || (s => (s || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;'));
      
      w.document.write('<html><head><title>Match Log</title></head><body style="font-family:Arial;padding:20px;color:#000">');
      w.document.write(`<h3>Judo Match Log — ${new Date().toLocaleString()}</h3>`);
      w.document.write('<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%"><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Info</th></tr></thead><tbody>');
      
      match.log.forEach(it => {
        w.document.write(`
          <tr>
            <td>${it.t}</td>
            <td>${escape(it.actor)}</td>
            <td>${escape(it.action)}</td>
            <td>${escape(it.info)}</td>
          </tr>`);
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
  const weightCategory = document.getElementById("weightCategory").value;
  const matNumber = document.getElementById("matNumber").value;  // Get mat number

  w.document.write('<html><head><title>Match Report</title>');
  w.document.write('<style>@media print { body, .card-pill { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }</style>');
  w.document.write('</head><body style="font-family:Arial;color:#000;padding:18px">');
  // HEADER with all logos and match name
  w.document.write('<div style="display:grid;grid-template-columns:54px 1fr 54px;align-items:center;gap:0;margin-bottom:18px;">');
  w.document.write('<img src="/public/assets/Backdrop%5B1%5D%20mja%20logooooo.png" alt="Logo1" style="width:54px;height:54px;border-radius:12px;box-shadow:0 2px 8px #0002;justify-self:start;">');
  w.document.write('<div style="display:flex;flex-direction:column;align-items:center;width:100%;">');
  w.document.write('<img src="/public/assets/punit%20p.png" alt="Logo2" style="width:54px;height:54px;border-radius:12px;box-shadow:0 2px 8px #0002;margin-bottom:8px;">');
  w.document.write('<h1 style="font-size:1.6rem;font-weight:700;line-height:1.2;text-align:center;margin:0;">52th SENIOR STATE & NATIONAL SELECTION JUDO CHAMPIONSHIP 2025-26, MUMBAI</h1>');
  w.document.write('</div>');
  w.document.write('<img src="/public/assets/mum_m%20copy%2001.png" alt="Logo3" style="width:54px;height:54px;border-radius:12px;box-shadow:0 2px 8px #0002;justify-self:end;">');
  w.document.write('</div>');
  w.document.write(`<p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>`);
  if (weightCategory) w.document.write(`<p><strong>Weight Category:</strong> ${weightCategory}</p>`);
  if (matNumber) w.document.write(`<p><strong>Mat Number:</strong> ${matNumber}</p>`);

  w.document.write('<h3>Status Point Cards & Points</h3>');
  w.document.write('<div style="display:flex;gap:32px;margin-bottom:18px;">');
  w.document.write(`
  <div style="flex:1;border:3px solid #0b2a8a;border-radius:12px;padding:12px;">
<!--    <div style="font-weight:700;font-size:1.1em;">${escapeHtml(match.fighterA.name)}</div>-->
<div style="font-weight:700;font-size:1.1em;">${match.fighterA.name} <span style="font-weight:normal;opacity:0.7;font-size:0.9em">(${match.fighterA.club})</span></div>

    ${renderCardPills(match.fighterA.shido)}
    ${renderPointsGrid(match.fighterA)}
  </div>
  <div style="flex:1;border:3px solid #000;border-radius:12px;padding:12px;">
<!--    <div style="font-weight:700;font-size:1.1em;">${escapeHtml(match.fighterB.name)}</div>-->
<div style="font-weight:700;font-size:1.1em;">${match.fighterB.name} <span style="font-weight:normal;opacity:0.7;font-size:0.9em">(${match.fighterB.club})</span></div>

    ${renderCardPills(match.fighterB.shido)}
    ${renderPointsGrid(match.fighterB)}
  </div>
`);
  w.document.write('</div>');
  w.document.write('<h3>Summary</h3>');
  w.document.write('<ul>');
  w.document.write(`<li>A — Ippon: ${match.fighterA.ippon}, Waza-ari: ${match.fighterA.waza}, Yuko: ${match.fighterA.yuko}, Shido: ${match.fighterA.shido}</li>`);
  w.document.write(`<li>B — Ippon: ${match.fighterB.ippon}, Waza-ari: ${match.fighterB.waza}, Yuko: ${match.fighterB.yuko}, Shido: ${match.fighterB.shido}</li>`);
  w.document.write('</ul>');
  w.document.write(`<p><strong>Winner:</strong> ${match.winnerName || '—'}</p>`);
  w.document.write('<h3>Events</h3>');
  w.document.write('<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%"><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Info</th></tr></thead><tbody>');
  match.log.forEach(it => {
    w.document.write(`<tr><td>${it.t}</td><td>${it.actor}</td><td>${it.action}</td><td>${it.info}</td></tr>`);
  });
  w.document.write('</tbody></table>');
  w.document.write('</body></html>');
  w.document.close();
setTimeout(() => {
  try {
    w.print();
  } catch (e) {
    alert('⚠️ Printing failed. Please check your browser settings.');
  }
}, 350);
    }

    /* fullscreen helper */
    function toggleFullscreen() {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
      } else { document.exitFullscreen && document.exitFullscreen(); }
    }

    /* Hold Timer Functions */
    function updateHoldTimerDisplay() {
      const display = document.getElementById('holdTimerDisplay');
      const timeDisplay = document.getElementById('holdTimerTime');
      const playerDisplay = document.getElementById('holdTimerPlayer');
      
      if (match.holdTimer.active) {
        display.style.display = 'block';
        const elapsedSeconds = match.holdTimer.elapsedSec || 0;
        timeDisplay.textContent = elapsedSeconds;
        const playerName = match.holdTimer.player === 'A' ? match.fighterA.name : match.fighterB.name;
        const playerColor = match.holdTimer.player === 'A' ? 'White' : 'Blue';
        const holdType = match.holdTimer.type === 'waza-ari' ? ' (after Waza-ari)' : '';
        playerDisplay.textContent = `${playerColor} (${playerName})${holdType}`;
        
        // Change color based on time elapsed and timer type
        const warningThreshold = match.holdTimer.type === 'waza-ari' ? 7 : 15; // 7s for waza-ari (10s total), 15s for normal (20s total)
        const cautionThreshold = match.holdTimer.type === 'waza-ari' ? 5 : 10;  // 5s for waza-ari, 10s for normal
        
        if (elapsedSeconds >= warningThreshold) {
          timeDisplay.style.color = '#ff4444'; // Red for final seconds
        } else if (elapsedSeconds >= cautionThreshold) {
          timeDisplay.style.color = '#ffaa00'; // Orange for caution
        } else {
          timeDisplay.style.color = '#00ff00'; // Green for normal time
        }
      } else {
        display.style.display = 'none';
      }
    }

    function startHoldTimer(player) {
      // Check if match is running
      if (!match.running) {
        alert('Please start the match timer before starting hold timer.');
        return;
      }

      // Stop any existing hold timer
      if (match.holdTimer.active) {
        clearInterval(match.holdTimer.timerId);
      }

      // Determine duration: 10s if player has previous waza-ari, else 20s
      let duration = 20;
      let type = 'normal';
      if ((player === 'A' && match.fighterA.waza > 0) || (player === 'B' && match.fighterB.waza > 0)) {
        duration = 10;
        type = 'waza-ari';
      }

      // Initialize hold timer
      match.holdTimer = {
        active: true,
        player: player,
        elapsedSec: 0,
        duration: duration,
        type: type,
        timerId: null
      };

      const playerName = player === 'A' ? match.fighterA.name : match.fighterB.name;
      const playerColor = player === 'A' ? 'White' : 'Blue';
      const holdTypeText = type === 'waza-ari' ? ' (after Waza-ari)' : '';

      pushLog('System', 'Hold Timer Start', `${playerColor} hold timer${holdTypeText} started for ${playerName}`);

      // Update display immediately
      updateHoldTimerDisplay();

      // Start count-up timer
      match.holdTimer.timerId = setInterval(() => {
        match.holdTimer.elapsedSec++;
        updateHoldTimerDisplay();

        // Check if hold timer completed
        if (match.holdTimer.elapsedSec >= match.holdTimer.duration) {
          completeHoldTimer();
        }
      }, 1000);
    }

   function completeHoldTimer() {
     const player = match.holdTimer.player;
     const fighter = player === 'A' ? match.fighterA : match.fighterB;
     const playerColor = player === 'A' ? 'White' : 'Blue';
     const holdType = match.holdTimer.type;
     const duration = holdType === 'waza-ari' ? '10-second' : '20-second';
     const holdTypeText = holdType === 'waza-ari' ? ' after Waza-ari' : '';

     clearInterval(match.holdTimer.timerId);
     match.holdTimer.active = false;

     fighter.ippon = 1;
     match.winnerName = fighter.name;

     pushLog(fighter.name, 'Ippon (Hold)', `${fighter.name} awarded Ippon via ${duration} hold${holdTypeText} (${playerColor})`);
     showBigCard(player, 'yellow', 'IPPON');

     stopMainTimer();

     updateHoldTimerDisplay();
     refreshUI();
   }

function stopHoldTimer() {
  if (!match.holdTimer.active) return;

  clearInterval(match.holdTimer.timerId);

  const elapsed = match.holdTimer.elapsedSec || 0;
  const player = match.holdTimer.player;
  const fighter = player === 'A' ? match.fighterA : match.fighterB;
  const opp = player === 'A' ? match.fighterB : match.fighterA;
  const playerName = fighter.name;
  const playerColor = player === 'A' ? 'White' : 'Blue';

  let awarded = 'No Score';

  if (elapsed >= 20) {
    // IPPON
    fighter.ippon = 1;
    match.winnerName = fighter.name;
    showBigCard(player, 'yellow', 'IPPON');
    awarded = 'Ippon';
    stopMainTimer();
  } else if (elapsed >= 10) {
    // WAZA-ARI
    fighter.waza += 1;
   if (fighter.waza >= 2) {
     fighter.waza = 0; // Reset Waza-ari count
     fighter.ippon = 1;
     match.winnerName = fighter.name;
     showBigCard(player, 'yellow', 'IPPON');
     awarded = 'Waza-ari Awasete Ippon';
     stopMainTimer();
   } else {
     showBigCard(player, 'white', 'WAZA-ARI');
     awarded = 'Waza-ari';
   }

  } else if (elapsed >= 5) {
    // YUKO
    fighter.yuko += 1;
    showBigCard(player, 'white', 'YUKO');
    awarded = 'Yuko';
  }

  pushLog(
    'System',
    'Hold Timer Stop',
    `${playerColor} (${playerName}) hold stopped at ${elapsed}s → ${awarded}`
  );

  match.holdTimer.active = false;
  match.holdTimer.player = null;
  match.holdTimer.elapsedSec = 0;
  match.holdTimer.type = 'normal';

  updateHoldTimerDisplay();
  refreshUI();
}


    function stopMainTimer() {
      if (match.running && match.timerId) {
        clearInterval(match.timerId);
        match.running = false;
        document.getElementById('startBtn').textContent = 'Start';
        pushLog('System', 'Timer Stop', 'Main timer stopped (Ippon / match end)');
      }
    }


    function startHoldWhite() {
      startHoldTimer('A');
    }

    function startHoldBlue() {
      startHoldTimer('B');
    }



    /* ---------------- Technique and Penalty Dropdowns ---------------- */

    // Data extracted from Excel (trimmed to key examples)
    const judoTechniques = [
      { name: "SEOI-NAGE", code: "SON" },
      { name: "IPPON-SEOI-NAGE", code: "ISN" },
      { name: "SEOI-OTOSHI", code: "SOO" },
      { name: "TAI-OTOSHI", code: "TOS" },
      { name: "KATA-GURUMA", code: "KGU" },
      { name: "UCHI-MATA", code: "UMA" },
      { name: "HARAI-GOSHI", code: "HGO" },
      { name: "O-GOSHI", code: "OGO" },
      { name: "SASAE-TSURIKOMI-ASHI", code: "STA" },
      { name: "KO-SOTO-GARI", code: "KSG" },
      // ... add more as needed
    ];

    const judoPenalties = [
      { name: "NEGATIVE JUDO", code: "PS1" },
      { name: "FALSE ATTACK", code: "PS2" },
      { name: "PULL DOWN", code: "PS3" },
      { name: "NON COMBATIVITY", code: "PS4" },
      { name: "PUSH OUT", code: "PS5" },
      { name: "GRABBING BELOW BELT", code: "PS6" },
      { name: "AVOIDING GRIP", code: "PS7" },
      { name: "STEPPING OUTSIDE AREA", code: "PS8" }
    ];

    // Populate dropdowns dynamically
    function populateDropdowns() {
      ["A", "B"].forEach(side => {
        const techSelect = document.getElementById(`techniqueSelect${side}`);
        const penSelect = document.getElementById(`penaltySelect${side}`);
        if (techSelect) {
          judoTechniques.forEach(t => {
            const opt = document.createElement("option");
            opt.value = t.name;
            opt.textContent = `${t.name} (${t.code})`;
            techSelect.appendChild(opt);
          });
        }
        if (penSelect) {
          judoPenalties.forEach(p => {
            const opt = document.createElement("option");
            opt.value = p.name;
            opt.textContent = `${p.name} (${p.code})`;
            penSelect.appendChild(opt);
          });
        }
      });
    }

    document.addEventListener("DOMContentLoaded", populateDropdowns);

    // Handle apply buttons
    function applyTechnique(side) {
      const select = document.getElementById(`techniqueSelect${side}`);
      const value = select.value;
      if (!value) return alert("Select a technique first.");
//      doTechnique(side, "Waza", value); // all listed moves → Waza-ari
      pushLog(
        match[`fighter${side}`].name,
        "Technique",
        `Performed ${value}`
      );
      select.value = "";
    }

    function applyPenalty(side) {
      const select = document.getElementById(`penaltySelect${side}`);
      const value = select.value;
      if (!value) return alert("Select a penalty reason.");
//      doTechnique(side, "Shido", value);
      pushLog(
        match[`fighter${side}`].name,
        "Penalty",
        `Shido given for ${value}`
      );
      select.value = "";
    }


    // Make functions and match object available globally
    window.declareWinner = declareWinner;
    window.startPauseTimer = startPauseTimer;
    window.resetTimer = resetTimer;
    window.resetMatch = resetMatch;
    window.saveMatch = saveMatch;
    window.loadLastMatch = loadLastMatch;
    window.exportLog = exportLog;
    window.printLog = printLog;
    window.savePdf = savePdf;
    window.startHoldWhite = startHoldWhite;
    window.startHoldBlue = startHoldBlue;
    window.stopHoldTimer = stopHoldTimer;
    window.match = match; // Expose match object for Firebase sync
