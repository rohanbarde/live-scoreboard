// Initialize Firebase
let database;
let players = [];
let weights = new Set();
let tournamentDraw;

// DOM Elements
const ageGroupFilter = document.getElementById('ageGroupFilter');
const genderFilter = document.getElementById('drawGenderFilter');
const weightFilter = document.getElementById('drawWeightFilter');
const generateDrawBtn = document.getElementById('generateDrawBtn');
const saveDrawBtn = document.getElementById('saveDrawBtn');
const drawsContent = document.getElementById('drawsContent');

// Store current draw data
let currentDrawData = null;

// Tournament Draw System
class TournamentDraw {

  constructor() {
    this.database = firebase.database();
    this.playersRef = this.database.ref('registrations').orderByChild('userType').equalTo('player');
    this.matchesRef = this.database.ref('tournament/matches');
  }

  async loadPlayers() {
    const snap = await this.playersRef.once('value');
    const arr = [];
    snap.forEach(s => {
      const p = s.val();
      p.id = s.key;
      arr.push(p);
    });
    return arr;
  }

  nextBracketSize(n) {
    // IJF bracket sizes: 2, 4, 8, 16, 32, 64
    return [2, 4, 8, 16, 32, 64].find(s => s >= n) || 64;
  }

  shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  generateSlots(players) {
    const bracketSize = this.nextBracketSize(players.length);
    const byes = bracketSize - players.length;
    
    console.log(`🎯 Generating slots: ${players.length} players, ${bracketSize} bracket size, ${byes} BYEs`);

    // Shuffle players
    let shuffledPlayers = this.shuffle([...players]);
    
    // NEW STRATEGY: Distribute players and BYEs to ensure no BYE vs BYE
    // Create slots array
    let slots = new Array(bracketSize).fill(null);
    
    // Calculate number of matches
    const numMatches = bracketSize / 2;
    
    // Distribute BYEs across matches (max 1 BYE per match)
    if (byes >= numMatches) {
      // Too many BYEs - this is impossible to avoid BYE vs BYE
      console.error(`❌ IMPOSSIBLE: ${byes} BYEs for ${numMatches} matches - BYE vs BYE unavoidable`);
      // Fall back to simple distribution
      slots = this.shuffle([...shuffledPlayers, ...new Array(byes).fill(null)]);
    } else {
      // Distribute BYEs evenly across matches (max 1 per match)
      let byePositions = [];
      
      // Create list of all possible positions
      let availablePositions = [];
      for (let i = 0; i < bracketSize; i++) {
        availablePositions.push(i);
      }
      
      // Shuffle positions
      availablePositions = this.shuffle(availablePositions);
      
      // Select BYE positions ensuring no two BYEs in same match
      let usedMatches = new Set();
      for (let i = 0; i < availablePositions.length && byePositions.length < byes; i++) {
        const pos = availablePositions[i];
        const matchIndex = Math.floor(pos / 2);
        
        if (!usedMatches.has(matchIndex)) {
          byePositions.push(pos);
          usedMatches.add(matchIndex);
        }
      }
      
      // Mark BYE positions as null
      byePositions.forEach(pos => {
        slots[pos] = 'BYE_MARKER';
      });
      
      // Fill remaining positions with players
      let playerIndex = 0;
      for (let i = 0; i < bracketSize; i++) {
        if (slots[i] === null) {
          slots[i] = shuffledPlayers[playerIndex++];
        }
      }
      
      // Convert BYE markers back to null
      for (let i = 0; i < bracketSize; i++) {
        if (slots[i] === 'BYE_MARKER') {
          slots[i] = null;
        }
      }
      
      console.log(`✅ Distributed ${byes} BYEs across ${byes} different matches`);
    }
    
    // Debug: Show bracket structure
    console.log('📋 Bracket structure:');
    for (let i = 0; i < slots.length; i += 2) {
      const playerA = slots[i]?.fullName || 'BYE';
      const playerB = slots[i + 1]?.fullName || 'BYE';
      const matchNum = i / 2 + 1;
      const pool = this.assignPools(i, bracketSize);
      console.log(`   Match ${matchNum} (Pool ${pool}): ${playerA} vs ${playerB}`);
    }
    
    // Final validation
    let byeVsByeCount = 0;
    for (let i = 0; i < slots.length; i += 2) {
      if (slots[i] === null && slots[i + 1] === null) {
        byeVsByeCount++;
        console.error(`❌ BYE vs BYE at match ${i/2 + 1} (positions ${i}-${i+1})`);
      }
    }
    
    if (byeVsByeCount === 0) {
      console.log('✅ Slot validation passed: No BYE vs BYE matches');
    } else {
      console.error(`❌ VALIDATION FAILED: ${byeVsByeCount} BYE vs BYE matches still exist`);
    }

    return { slots, bracketSize, byes };
  }

  assignPools(slotIndex, bracketSize) {
    // IJF Rule: Always 4 pools (A, B, C, D)
    // Pools are bracket quarters with fixed slot counts:
    //   8-slot  → 2 per pool
    //   16-slot → 4 per pool
    //   32-slot → 8 per pool
    //   64-slot → 16 per pool
    const perPool = bracketSize / 4;
    const poolIndex = Math.floor(slotIndex / perPool);
    return ["A", "B", "C", "D"][poolIndex] || "D";
  }

  createRound1(slots, bracketSize, categoryKey) {
    const matches = [];
    
    // IJF Rule: Round-1 ALWAYS FULL - Create ALL matches
    for (let i = 0; i < slots.length; i += 2) {
      const A = slots[i];
      const B = slots[i + 1];
      
      // Validate no BYE vs BYE
      if (!A && !B) {
        console.error(`❌ CRITICAL: BYE vs BYE at match ${i/2 + 1}`);
      }

      const match = {
        id: `M1_${i/2+1}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        round: 1,
        pool: this.assignPools(i, bracketSize),
        matchType: 'main',
        playerA: A?.id || null,
        playerB: B?.id || null,
        playerAName: A?.fullName || 'BYE',
        playerBName: B?.fullName || 'BYE',
        playerAClub: A?.playerInfo?.team || A?.team || '',
        playerBClub: B?.playerInfo?.team || B?.team || '',
        playerASeed: A?.seed || null,
        playerBSeed: B?.seed || null,
        playerACountry: A?.playerInfo?.country || A?.country || '',
        playerBCountry: B?.playerInfo?.country || B?.country || '',
        winner: null,
        loser: null,
        completed: false,
        status: 'pending',
        nextMatchId: null,
        winnerTo: null,
        category: categoryKey
      };

      // IJF Rule: If player faces BYE → Auto Win (show "Auto Win (BYE)")
      // Always show BYE in opponent slot
      if (A && !B) {
        match.winner = A.id;
        match.loser = null;
        match.completed = true;
        match.status = 'completed';
        match.winByBye = true;
        console.log(`✅ Auto-advance: ${A.fullName} (BYE in position B)`);
      } else if (B && !A) {
        match.winner = B.id;
        match.loser = null;
        match.completed = true;
        match.status = 'completed';
        match.winByBye = true;
        console.log(`✅ Auto-advance: ${B.fullName} (BYE in position A)`);
      }

      matches.push(match);
    }
    
    console.log(`✅ Created ${matches.length} Round-1 matches`);
    const byeMatches = matches.filter(m => m.winByBye);
    console.log(`   - ${byeMatches.length} auto-advance (BYE) matches`);
    console.log(`   - ${matches.length - byeMatches.length} regular matches`);
    
    return matches;
  }

  linkNextRounds(matches) {
    let round = 1;
    let current = matches;
    const all = [...matches];
    
    const totalRounds = Math.log2(matches.length) + 1;
    console.log(`🔗 Linking rounds: ${totalRounds} total rounds`);

    while (current.length > 1) {
      round++;
      const next = [];
      
      for (let i = 0; i < current.length; i += 2) {
        const isFinal = (current.length === 2);
        const isSemifinal = (current.length === 4);
        const isQuarterfinal = (current.length === 8);
        
        let roundName = 'main';
        if (isFinal) roundName = 'final';
        else if (isSemifinal) roundName = 'semifinal';
        else if (isQuarterfinal) roundName = 'quarterfinal';

        const m = {
          id: `R${round}_M${i/2+1}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          round,
          matchType: isFinal ? 'final' : 'main',
          playerA: null,
          playerB: null,
          playerAName: 'TBD',
          playerBName: 'TBD',
          playerAClub: '',
          playerBClub: '',
          playerASeed: null,
          playerBSeed: null,
          playerACountry: '',
          playerBCountry: '',
          winner: null,
          loser: null,
          completed: false,
          status: 'pending',
          nextMatchId: null,
          winnerTo: null
        };

        // Link previous matches to this match
        if (current[i]) {
          current[i].nextMatchId = m.id;
          current[i].winnerTo = 'A';
          
          // CRITICAL: If previous match is already completed (BYE), advance winner immediately
          if (current[i].completed && current[i].winner) {
            m.playerA = current[i].winner;
            m.playerAName = current[i].winner === current[i].playerA ? current[i].playerAName : current[i].playerBName;
            m.playerAClub = current[i].winner === current[i].playerA ? current[i].playerAClub : current[i].playerBClub;
            m.playerASeed = current[i].winner === current[i].playerA ? current[i].playerASeed : current[i].playerBSeed;
            m.playerACountry = current[i].winner === current[i].playerA ? current[i].playerACountry : current[i].playerBCountry;
            console.log(`   → Auto-filled position A in R${round} match ${i/2+1}: ${m.playerAName}`);
          }
        }

        if (current[i + 1]) {
          current[i + 1].nextMatchId = m.id;
          current[i + 1].winnerTo = 'B';
          
          // CRITICAL: If previous match is already completed (BYE), advance winner immediately
          if (current[i + 1].completed && current[i + 1].winner) {
            m.playerB = current[i + 1].winner;
            m.playerBName = current[i + 1].winner === current[i + 1].playerA ? current[i + 1].playerAName : current[i + 1].playerBName;
            m.playerBClub = current[i + 1].winner === current[i + 1].playerA ? current[i + 1].playerAClub : current[i + 1].playerBClub;
            m.playerBSeed = current[i + 1].winner === current[i + 1].playerA ? current[i + 1].playerASeed : current[i + 1].playerBSeed;
            m.playerBCountry = current[i + 1].winner === current[i + 1].playerA ? current[i + 1].playerACountry : current[i + 1].playerBCountry;
            console.log(`   → Auto-filled position B in R${round} match ${i/2+1}: ${m.playerBName}`);
          }
        }

        next.push(m);
      }
      
      console.log(`   Round ${round}: ${next.length} matches`);
      all.push(...next);
      current = next;
    }
    
    console.log(`✅ Linked ${all.length} total matches across ${round} rounds`);
    
    // Count auto-filled positions
    const autoFilledCount = all.filter(m => 
      m.round > 1 && (
        (m.playerAName !== 'TBD' && m.playerA !== null) || 
        (m.playerBName !== 'TBD' && m.playerB !== null)
      )
    ).length;
    
    if (autoFilledCount > 0) {
      console.log(`✅ Auto-filled ${autoFilledCount} next-round positions from BYE winners`);
    }
    
    return all;
  }

  async generateDraw(players) {
    if (!players || players.length < 1) {
      throw new Error("No players passed to generator");
    }

    if (players.length === 0) throw new Error("No players");

    const { slots, bracketSize, byes } = this.generateSlots(players);
    const categoryKey = "default";

    const r1 = this.createRound1(slots, bracketSize, categoryKey);
    const main = this.linkNextRounds(r1);

    const full = {
      bracketSize,
      byeCount: byes,
      slots: slots.map((p, i) => ({
        slot: i,
        pool: this.assignPools(i, bracketSize),
        name: p?.fullName || "BYE"
      })),
      main,
      repechage: []
    };

    // Save to Firebase
    await this.matchesRef.child(categoryKey).set(full);
    
    console.log('✅ Draw saved to Firebase');
    console.log('🔄 Processing BYE auto-advancements...');
    
    // CRITICAL: Process BYE matches immediately after generation
    // This ensures players with BYE in Round-1 advance to Round-2
    try {
      if (typeof TournamentProgression !== 'undefined') {
        const progression = new TournamentProgression();
        await progression.processByes();
        console.log('✅ BYE processing complete');
      } else if (window.TournamentProgression) {
        const progression = new window.TournamentProgression();
        await progression.processByes();
        console.log('✅ BYE processing complete');
      } else {
        console.error('❌ TournamentProgression not available - BYEs not processed');
        console.error('   Make sure tournament-progression.js is loaded before generate-draws.js');
      }
    } catch (error) {
      console.error('❌ Error processing BYEs:', error);
    }
    
    return full;   // ← REQUIRED
  }

validateNoByeVsBye(bracket) {
  let safety = 0;

  while (safety < 100) {
    let fixed = true;

    for (let i = 0; i < bracket.length; i += 2) {
      if (!bracket[i] && !bracket[i + 1]) {

        // Find any slot holding real player in a different match
        const swapIndex = bracket.findIndex((p, idx) => p && Math.floor(idx / 2) !== Math.floor(i / 2));

        if (swapIndex !== -1) {
          [bracket[i], bracket[swapIndex]] = [bracket[swapIndex], bracket[i]];
          fixed = false;
        }
      }
    }

    if (fixed) break;
    safety++;
  }

  return bracket;
}

}

window.tournamentDraw = new TournamentDraw();

// Initialize the application

document.addEventListener('DOMContentLoaded', () => {
  const shuffleBtn = document.getElementById('shufflePlayersBtn');
  const shuffleAnim = document.getElementById('shuffleAnimation');
  const playersList = document.getElementById('playersList');

  if (!shuffleBtn || !playersList) {
    console.warn('Shuffle button or player list not found.');
    return;
  }

  shuffleBtn.addEventListener('click', () => {
    // Try to detect players dynamically — supports async loading
    let playerItems = Array.from(playersList.querySelectorAll('.player-card, .player-item'));

    // Try fallback: if players rendered inside another element
    if (playerItems.length === 0) {
      const allDivs = Array.from(document.querySelectorAll('#playersList div'));
      playerItems = allDivs.filter(div =>
        div.textContent.trim().length > 0 &&
        !div.classList.contains('no-players')
      );
    }

    console.log('Detected players:', playerItems.length, playerItems);

    if (playerItems.length === 0) {
      alert('No players to shuffle.');
      return;
    }

    // Show overlay spinner (if available)
        if (shuffleAnim) {
          shuffleAnim.style.display = 'flex';
          const overlayText = shuffleAnim.querySelector('.mt-3');
          if (overlayText) {
            overlayText.textContent = 'Shuffling Players...';
          }
        }

    // Wait a moment for visual effect
    setTimeout(() => {
      // Fisher–Yates shuffle
      for (let i = playerItems.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [playerItems[i], playerItems[j]] = [playerItems[j], playerItems[i]];
      }

      // Clear and re-render shuffled list
      playersList.innerHTML = '';
      playerItems.forEach(card => {
        card.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        playersList.appendChild(card);
      });

      // Animate back in
      playerItems.forEach((card, index) => {
        setTimeout(() => {
          card.style.opacity = '1';
          card.style.transform = 'translateY(0)';
        }, index * 100);
      });

      // Hide overlay after animation
      setTimeout(() => {
        if (shuffleAnim) {
                  shuffleAnim.style.display = 'none';
                }
      }, playerItems.length * 120 + 700);
    }, 600);
  });
});


// Load players from Firebase
function loadPlayers() {
    showLoading(true);

    const playersRef = window.database.ref('registrations');

    playersRef.on('value', (snapshot) => {
        players = [];
        weights.clear();

        snapshot.forEach((childSnapshot) => {
            const player = childSnapshot.val();
            player.id = childSnapshot.key;

            // Check if this is a player and has the required data
            if (player.userType === 'player' && player.playerInfo) {
                players.push(player);

                // Add weight to weights set if it exists
                if (player.playerInfo.weight) {
                    weights.add(player.playerInfo.weight);
                }
            }
        });

//        console.log('Loaded players:', players);
        console.log('Available weights:', Array.from(weights));

        // Update weight filter
        updateWeightFilter();

        // Initial render
        filterAndRenderDraws();

        showLoading(false);
    }, (error) => {
        console.error('Error loading players:', error);
        showError('Failed to load players. Please try again.');
        showLoading(false);
    });
}

// Update weight filter dropdown
function updateWeightFilter() {
    const weightFilterEl = document.getElementById('drawWeightFilter');
    if (!weightFilterEl) return;

    const currentValue = weightFilterEl.value;

    // Clear existing options except the first one
    weightFilterEl.innerHTML = '<option value="">All Weights</option>';

    // Convert weights to array and sort numerically
    const sortedWeights = Array.from(weights)
        .filter(weight => weight !== undefined && weight !== null && weight !== '')
        .sort((a, b) => {
            // Try to convert to numbers for proper numeric sorting
            const numA = parseFloat(a);
            const numB = parseFloat(b);
            return numA - numB;
        });

    // Add weight options
    sortedWeights.forEach(weight => {
        const option = document.createElement('option');
        option.value = weight;
        option.textContent = `${weight} kg`;
        weightFilterEl.appendChild(option);
    });

    // Restore previous value if it still exists
    if (currentValue && sortedWeights.includes(currentValue)) {
        weightFilterEl.value = currentValue;
    }
}

// Set up event listeners
function setupEventListeners() {
    // Age group filter - updates weight categories
    if (ageGroupFilter) {
        ageGroupFilter.addEventListener('change', () => {
            updateWeightCategories();
            filterAndRenderDraws();
        });
    }

    // Gender filter - updates weight categories
    if (genderFilter) {
        genderFilter.addEventListener('change', () => {
            updateWeightCategories();
            filterAndRenderDraws();
        });
    }

    // Weight filter
    if (weightFilter) {
        weightFilter.addEventListener('change', filterAndRenderDraws);
    }
}

// Update weight categories based on age group and gender
function updateWeightCategories() {
    const ageGroup = ageGroupFilter ? ageGroupFilter.value : '';
    const gender = genderFilter ? genderFilter.value : '';

    if (!weightFilter) return;

    // Clear current options
    weightFilter.innerHTML = '<option value="">All Weights</option>';

    if (ageGroup && gender && window.getWeightCategories) {
        // Get categories for selected age group and gender
        const categories = window.getWeightCategories(ageGroup, gender);
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.value;
            option.textContent = cat.label;
            weightFilter.appendChild(option);
        });
    } else {
        // Show all unique weights from players
        const uniqueWeights = [...weights].sort((a, b) => a - b);
        uniqueWeights.forEach(weight => {
            const option = document.createElement('option');
            option.value = weight;
            option.textContent = `${weight} kg`;
            weightFilter.appendChild(option);
        });
    }
}

// Filter players and render draws
function filterAndRenderDraws() {
    const selectedGender = genderFilter ? genderFilter.value : '';
    const selectedWeight = weightFilter ? weightFilter.value : '';

    console.log('Filtering with - Gender:', selectedGender, 'Weight:', selectedWeight);

    // Filter players
    const filteredPlayers = players.filter(player => {
        // Skip if player doesn't have playerInfo
        if (!player.playerInfo) return false;

        // Filter by gender
        const playerGender = player.playerInfo.gender ? player.playerInfo.gender.toLowerCase() : '';
        const matchesGender = !selectedGender || playerGender === selectedGender.toLowerCase();

        // Filter by weight
        const playerWeight = player.playerInfo.weight ? player.playerInfo.weight.toString() : '';
        const matchesWeight = !selectedWeight || playerWeight === selectedWeight;

        return matchesGender && matchesWeight;
    });

    console.log('Filtered players count:', filteredPlayers.length);

    // Render the filtered players
    renderDraws(filteredPlayers);
}

/* ---------------------------
  Animated Draw / Fly-to-Bracket
   --------------------------- */

async function animateGenerateDraw() {
  // Prepare current filtered players (same filter logic as filterAndRenderDraws)
  const selectedGender = genderFilter ? genderFilter.value : '';
  const selectedWeight = weightFilter ? weightFilter.value : '';

  const visiblePlayers = players.filter(player => {
    if (!player.playerInfo) return false;
    const playerGender = player.playerInfo.gender ? player.playerInfo.gender.toLowerCase() : '';
    const matchesGender = !selectedGender || playerGender === selectedGender.toLowerCase();
    const playerWeight = player.playerInfo.weight ? player.playerInfo.weight.toString() : '';
    const matchesWeight = !selectedWeight || playerWeight === selectedWeight;
    return matchesGender && matchesWeight;
  });

  if (visiblePlayers.length < 2) {
    return;
  }

  // Remove the no-draw placeholder (logo and text)
  const noDraw = drawsContent.querySelector('.no-draw');
  if (noDraw) {
    noDraw.remove();
  }

  // Create bracket container
  const existing = document.getElementById('animatedBracket');
  if (existing) existing.remove();

  const bracket = document.createElement('div');
  bracket.id = 'animatedBracket';

  // add a shuffle overlay
  const shuffle = document.createElement('div');
  shuffle.className = 'shuffle-overlay';
//  shuffle.textContent = 'Shuffling players...';
  drawsContent.prepend(shuffle);

  // show shuffle for a moment
  requestAnimationFrame(() => shuffle.classList.add('visible'));
  await new Promise(r => setTimeout(r, 900));

  // Get seeds from player data (if they have seed property)
  const seeds = visiblePlayers
    .filter(p => p.seed)
    .sort((a, b) => a.seed - b.seed)
    .map(p => p.id);

  // Create bracket with IJF seeding FIRST (so we know the actual pairings)
  const bracketData = await tournamentDraw.generateDraw(visiblePlayers);

  // Extract first round matches to display in animation
  const firstRoundMatches = bracketData.main.filter(m => m.round === 1);

  console.log('🎬 Animating', firstRoundMatches.length, 'first round matches');

  // Create placeholder match slots for first round
  const matchSlots = [];
  for (let i = 0; i < firstRoundMatches.length; i++) {
    const slot = document.createElement('div');
    slot.className = 'match-slot';
    slot.dataset.slotIndex = i;
    slot.innerHTML = `
      <div class="slot-left">
        <div class="slot-name"></div>
      </div>
      <div class="vs-label">V/S</div>
      <div class="slot-right">
        <div class="slot-name"></div>
      </div>
    `;

    bracket.appendChild(slot);
    matchSlots.push(slot);
  }

  drawsContent.appendChild(bracket);

  // allow CSS insertion then reveal
  await new Promise(r => requestAnimationFrame(r));
  matchSlots.forEach((s, idx) => {
    setTimeout(() => s.classList.add('visible'), idx * 80);
  });

  // small pause before animation begins
  await new Promise(r => setTimeout(r, 350));

  // Animate the ACTUAL matches that will be saved
  for (let i = 0; i < firstRoundMatches.length; i++) {
    const match = firstRoundMatches[i];

    // Find player objects from visiblePlayers
    const pA = visiblePlayers.find(p => p.id === match.playerA);
    const pB = match.playerB ? visiblePlayers.find(p => p.id === match.playerB) : null;

    // Determine source DOM elements
    const sourceA = pA ? (document.querySelector(`.player-card[data-player-id="${pA.id}"]`) ||
                    document.querySelector(`.player-card`)) : null;
    const sourceB = pB ? (document.querySelector(`.player-card[data-player-id="${pB.id}"]`) ||
                    document.querySelector(`.player-card`)) : null;

    // target slot
    const slot = matchSlots[i];

    // compute target positions (slot left and right)
    const slotLeftEl = slot.querySelector('.slot-left .slot-name');
    const slotRightEl = slot.querySelector('.slot-right .slot-name');

    // animate player A -> slot left
    if (pA && sourceA) {
      await animatePlayerToSlot(sourceA, slotLeftEl, pA);
    } else {
      // directly populate if source not found
      slotLeftEl.textContent = match.playerAName || 'N/A';
    }

    // animate player B -> slot right (or BYE)
    if (pB && sourceB) {
      await animatePlayerToSlot(sourceB, slotRightEl, pB);
    } else if (match.playerB) {
      // Player B exists but source not found
      slotRightEl.textContent = match.playerBName || 'N/A';
    } else {
      // BYE
      slotRightEl.textContent = 'BYE';
    }

    // small delay between matches for visual rhythm
    await new Promise(r => setTimeout(r, 250));
  }

  // remove shuffle overlay after completion
  shuffle.classList.remove('visible');
  setTimeout(() => shuffle.remove(), 300);

  // Get age group
  const selectedAgeGroup = ageGroupFilter ? ageGroupFilter.value : '';
  const ageGroupLabel = selectedAgeGroup ?
    ageGroupFilter.options[ageGroupFilter.selectedIndex].text : 'All Ages';

  // Store the bracket data for saving later
  currentDrawData = {
    bracketData: bracketData,
    category: {
      ageGroup: selectedAgeGroup || 'all',
      gender: selectedGender || 'all',
      weight: selectedWeight || 'all',
      ageGroupLabel: ageGroupLabel,
      weightLabel: selectedWeight ? `${selectedWeight} kg` : 'All Weights',
      genderLabel: selectedGender ? (selectedGender.charAt(0).toUpperCase() + selectedGender.slice(1)) : 'All Genders'
    },
    players: visiblePlayers,
    seeds: seeds,
    createdAt: Date.now()
  };

  // Show the Save Draw button
  if (saveDrawBtn) {
    saveDrawBtn.style.display = 'inline-block';
  }

  console.log('✅ Draw generated successfully. Click "Save Draw" to save to database.');
}

/* Animate a DOM element clone from `sourceEl` to overlay target name element `targetNameEl`.
   pData is the player data used to fill clone visuals. */
function animatePlayerToSlot(sourceEl, targetNameEl, pData) {
  return new Promise((resolve) => {
    // If sourceEl is jQuery text search fallback (pseudo-selector) it might not work;
    // best case: renderDraws sets data-player-id on .player-card so source query works.
    const rectSrc = sourceEl.getBoundingClientRect();
    const rectTarget = targetNameEl.getBoundingClientRect();

    // create clone
    const clone = document.createElement('div');
    clone.className = 'floating-clone';
    clone.style.left = `${rectSrc.left}px`;
    clone.style.top = `${rectSrc.top}px`;
    clone.style.width = `${rectSrc.width}px`;
    clone.style.height = `${rectSrc.height}px`;
    clone.style.opacity = '1';
    clone.innerHTML = `
      <div class="avatar" style="background:${getColorForString(pData.fullName || '')}">${getInitials(pData.fullName || '')}</div>
      <div style="font-weight:700">${pData.fullName || 'N/A'}</div>
    `;
    document.body.appendChild(clone);

    // force layout
    clone.getBoundingClientRect();

    // compute translation
    const dx = rectTarget.left + rectTarget.width / 2 - (rectSrc.left + rectSrc.width / 2);
    const dy = rectTarget.top + rectTarget.height / 2 - (rectSrc.top + rectSrc.height / 2);

    clone.style.transform = `translate(${dx}px, ${dy}px) scale(0.92)`;
    clone.style.opacity = '0.98';

    // after transition ends, remove clone and set target text
    const cleanup = () => {
      clone.style.opacity = '0';
      setTimeout(() => {
        clone.remove();
        // set the target text (animated slot content)
        targetNameEl.innerHTML = `
          <div class="draw-player-card">
            <div class="draw-player-name">${pData.fullName || 'N/A'}</div>
            <div class="draw-player-club">${pData.playerInfo?.team || ''}</div>
          </div>
        `;

        resolve();
      }, 180);
    };

    // in case transitionend doesn't fire consistently, set timeout fallback
    const t = setTimeout(cleanup, 820);

    clone.addEventListener('transitionend', () => {
      clearTimeout(t);
      cleanup();
    }, { once: true });
  });
}

/* small utility to produce initials (reuse) */
function getInitials(name) {
  if (!name) return '??';
  return name.split(' ')
      .map(part => part[0] || '')
      .join('')
      .toUpperCase()
      .substring(0, 2);
}

/* quick deterministic-ish avatar color by string */
function getColorForString(str) {
  if (!str) return '#4361ee';
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const h = Math.abs(hash) % 360;
  return `hsl(${h} 75% 55%)`;
}

// Render the player list in the left column
function renderPlayerList(players) {
    const playersList = document.getElementById('playersList');

    if (!players || players.length === 0) {
        playersList.innerHTML = `
            <div class="no-players">
                <i class="fas fa-users-slash"></i>
                <p>No players found matching the selected criteria</p>
            </div>
        `;
        return;
    }

    // Group players by weight category
    const playersByWeight = {};
    players.forEach(player => {
        const weight = player.playerInfo?.weight || 'No Weight';
        if (!playersByWeight[weight]) {
            playersByWeight[weight] = [];
        }
        playersByWeight[weight].push(player);
    });

    // Generate HTML for each weight category
    let html = '';

    for (const [weight, weightPlayers] of Object.entries(playersByWeight)) {
        const weightTitle = weight === 'No Weight' ? 'No Weight Category' : `${weight} kg`;

        html += `
            <div class="weight-category">
                <h4>${weightTitle} (${weightPlayers.length} players)</h4>
                <div class="players-grid">
                    ${weightPlayers.map(player => `
                        <div class="player-card" data-player-id="${player.id}" style="position: relative;">
                            ${player.seed ? `<div style="position: absolute; top: -8px; right: -8px; background: linear-gradient(135deg, #ffd700, #ffed4e); color: #000; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; box-shadow: 0 2px 8px rgba(255,215,0,0.4); border: 2px solid white; z-index: 1;">
                                ${player.seed}
                            </div>` : ''}
                            <div class="player-avatar" style="background: ${getColorForString(player.fullName || '')}">
                                ${getInitials(player.fullName || '')}
                            </div>
                            <div class="player-info">
                                <h4>${player.fullName || 'N/A'}${player.seed ? ' <i class="fas fa-trophy" style="color: #ffd700; font-size: 12px;"></i>' : ''}</h4>
                                <div class="player-details">
                                    ${player.playerInfo?.gender ? player.playerInfo.gender.charAt(0).toUpperCase() + player.playerInfo.gender.slice(1) : ''}
                                    ${player.playerInfo?.team ? ' • ' + player.playerInfo.team : ''}
                                    ${player.seed ? ` • <span style="color: #ffd700; font-weight: 600;">Seed ${player.seed}</span>` : ''}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    playersList.innerHTML = html;
}

// Render the draws in the right column
function renderDraws(players) {
    // First render the player list in the left column
    renderPlayerList(players);

    // Then show the draw area in the right column
    const drawsContent = document.getElementById('drawsContent');
    if (!drawsContent) return;

    if (!players || players.length === 0) {
        drawsContent.innerHTML = `
            <div class="no-draw">
                <i class="fas fa-users-slash"></i>
                <p>No players available to generate a draw</p>
            </div>
        `;
        return;
    }

    // Show the initial state of the draw area
    drawsContent.innerHTML = `
        <div class="no-draw">
            <i class="fas fa-random"></i>
            <p>Click "Generate Draw" to create tournament matches</p>
        </div>
    `;
}

// Helper function to get initials from name
function getInitials(name) {
    if (!name) return '??';
    return name.split(' ')
        .map(part => part[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
}

// Show loading state
function showLoading(show) {
    // You can implement a loading spinner here if needed
    if (show) {
        console.log('Loading...');
    }
}

// Show error message
function showError(message) {
    // You can implement a more user-friendly error display
    console.error('Error:', message);
}


// Save draw to database
async function saveDraw() {
    if (!currentDrawData) {
        alert('⚠️ No draw to save. Please generate a draw first.');
        return;
    }

    // Disable button and show loading
    saveDrawBtn.disabled = true;
    const originalText = saveDrawBtn.innerHTML;
    saveDrawBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        const { bracketData, category, players, seeds, createdAt } = currentDrawData;

        // Create a unique key for this category
        const categoryKey = `${category.ageGroup}_${category.gender}_${category.weight}`.replace(/\./g, '_');

        // Prepare draw data to save
        const drawToSave = {
            categoryKey: categoryKey,
            category: {
                ageGroup: category.ageGroup,
                gender: category.gender,
                weight: category.weight,
                ageGroupLabel: category.ageGroupLabel,
                weightLabel: category.weightLabel,
                genderLabel: category.genderLabel,
                displayName: `${category.ageGroupLabel} - ${category.genderLabel} - ${category.weightLabel}`
            },
            bracketData: bracketData,
            playerCount: players.length,
            seedCount: seeds.length,
            createdAt: createdAt,
            savedAt: firebase.database.ServerValue.TIMESTAMP,
            status: 'pending' // pending, in-progress, completed
        };

        // Save to tournament/draws/{categoryKey}
        await firebase.database().ref(`tournament/draws/${categoryKey}`).set(drawToSave);

        // Also save matches to tournament/matches/{categoryKey}
        console.log('💾 Saving matches to:', `tournament/matches/${categoryKey}`);
        console.log('💾 Bracket data:', bracketData);
        await tournamentDraw.matchesRef.child(categoryKey).set(bracketData);

        console.log('✅ Draw saved successfully:', categoryKey);
        console.log('✅ Matches saved to tournament/matches/' + categoryKey);
        
        // CRITICAL: Process BYE matches after saving
        console.log('🔄 Processing BYE auto-advancements for category:', categoryKey);
        try {
            if (typeof TournamentProgression !== 'undefined') {
                const progression = new TournamentProgression();
                await progression.processByes();
                console.log('✅ BYE processing complete for category:', categoryKey);
            } else if (window.TournamentProgression) {
                const progression = new window.TournamentProgression();
                await progression.processByes();
                console.log('✅ BYE processing complete for category:', categoryKey);
            } else {
                console.error('❌ TournamentProgression not available');
                alert('⚠️ Warning: BYE matches were not auto-processed. Please reload the page.');
            }
        } catch (error) {
            console.error('❌ Error processing BYEs:', error);
        }

        // Show success message
        alert(`✅ Draw saved successfully!\n\nCategory: ${category.ageGroupLabel} - ${category.genderLabel} - ${category.weightLabel}\nPlayers: ${players.length}\nSeeds: ${seeds.length}\n\nBYE matches have been auto-processed.`);

        // Hide save button and reset
        saveDrawBtn.style.display = 'none';
        currentDrawData = null;

    } catch (error) {
        console.error('❌ Error saving draw:', error);
        alert('❌ Failed to save draw. Please try again.');
    } finally {
        // Reset button
        saveDrawBtn.disabled = false;
        saveDrawBtn.innerHTML = originalText;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Initialize TournamentDraw system
    tournamentDraw = new TournamentDraw();

    // Load player list
    loadPlayers();

    // Setup filters
    setupEventListeners();

    // Bind Generate Draw button
    generateDrawBtn.addEventListener("click", animateGenerateDraw);

    // Bind Save Draw button
    if (saveDrawBtn) {
        saveDrawBtn.addEventListener("click", saveDraw);
    }
});


TournamentDraw.prototype.createBracket = function() {
  return this.generateDraw();
};


