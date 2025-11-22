// Initialize Firebase
let database;
let players = [];
let weights = new Set();
let tournamentDraw;

// DOM Elements
const genderFilter = document.getElementById('drawGenderFilter');
const weightFilter = document.getElementById('drawWeightFilter');
const generateDrawBtn = document.getElementById('generateDrawBtn');
const drawsContent = document.getElementById('drawsContent');

// Tournament Draw System
class TournamentDraw {
  constructor() {
    this.database = firebase.database();
    this.playersRef = this.database.ref('registrations').orderByChild('userType').equalTo('player');
    this.matchesRef = this.database.ref('tournament/matches');
    this.players = [];
    this.matches = [];
  }

  // Load all registered players
  async loadPlayers() {
    try {
      const snapshot = await this.playersRef.once('value');
      this.players = [];
      snapshot.forEach(childSnapshot => {
        const player = childSnapshot.val();
        player.id = childSnapshot.key;
        this.players.push(player);
      });
      return this.players;
    } catch (error) {
      console.error('Error loading players:', error);
      throw error;
    }
  }

  // IJF Seeding: Seed players based on ranking/seed number
  seedPlayers(players, seeds = []) {
    // seeds array contains player IDs in order of seeding (seed 1, seed 2, seed 3, seed 4, etc.)
    const seededPlayers = [];
    const unseededPlayers = [...players];
    
    // Remove seeded players from unseeded list
    seeds.forEach(seedId => {
      const index = unseededPlayers.findIndex(p => p.id === seedId);
      if (index !== -1) {
        unseededPlayers.splice(index, 1);
      }
    });
    
    // Shuffle unseeded players
    const shuffledUnseeded = unseededPlayers.sort(() => Math.random() - 0.5);
    
    return { seeds, unseeded: shuffledUnseeded };
  }
  
  // Apply IJF bracket positioning rules
  applyIJFSeeding(players, seeds = []) {
    const bracketSize = this.getNextPowerOf2(players.length);
    const bracket = new Array(bracketSize).fill(null);
    
    // Get seeded and unseeded players
    const seededPlayers = seeds.map(id => players.find(p => p.id === id)).filter(p => p);
    const unseededPlayers = players.filter(p => !seeds.includes(p.id));
    const shuffledUnseeded = unseededPlayers.sort(() => Math.random() - 0.5);
    
    // IJF Seeding positions for different bracket sizes
    const seedPositions = this.getIJFSeedPositions(bracketSize);
    
    // Place seeded players
    seededPlayers.forEach((player, index) => {
      if (index < seedPositions.length) {
        const position = seedPositions[index];
        bracket[position] = player;
        console.log(`✅ Seed ${index + 1} (${player.fullName}) placed at position ${position}`);
      }
    });
    
    // Fill remaining positions with unseeded players
    let unseededIndex = 0;
    for (let i = 0; i < bracket.length; i++) {
      if (bracket[i] === null && unseededIndex < shuffledUnseeded.length) {
        bracket[i] = shuffledUnseeded[unseededIndex++];
      }
    }
    
    // Debug: Log complete bracket structure
    console.log('\n🔍 COMPLETE BRACKET POSITIONS:');
    bracket.forEach((player, idx) => {
      const name = player?.fullName || 'BYE';
      const seed = player?.seed ? `[Seed ${player.seed}]` : '';
      console.log(`Position ${idx}: ${name} ${seed}`);
    });
    console.log('');
    
    return bracket;
  }
  
  // Get IJF seed positions for bracket size
  getIJFSeedPositions(size) {
    // IJF standard seeding positions
    // Format: [Seed1_pos, Seed2_pos, Seed3_pos, Seed4_pos, Seed5_pos, ...]
    const positions = {
      4: [0, 3, 2, 1],  // Seed1=top, Seed2=bottom, Seed3=pos2, Seed4=pos1
      8: [0, 7, 4, 3, 2, 5, 1, 6],  // Seed1=0, Seed2=7, Seed3=4, Seed4=3
      16: [0, 15, 8, 7, 4, 11, 3, 12, 2, 13, 5, 10, 6, 9, 1, 14],
      32: [0, 31, 16, 15, 8, 23, 7, 24, 4, 27, 11, 20, 3, 28, 12, 19,
           2, 29, 13, 18, 5, 26, 10, 21, 6, 25, 9, 22, 1, 30, 14, 17],
      64: [0, 63, 32, 31, 16, 47, 15, 48, 8, 55, 23, 40, 7, 56, 24, 39,
           4, 59, 27, 36, 11, 52, 20, 43, 3, 60, 28, 35, 12, 51, 19, 44,
           2, 61, 29, 34, 13, 50, 18, 45, 5, 58, 26, 37, 10, 53, 21, 42,
           6, 57, 25, 38, 9, 54, 22, 41, 1, 62, 30, 33, 14, 49, 17, 46]
    };
    
    return positions[size] || positions[8]; // Default to 8 if size not found
  }
  
  // Get next power of 2 for bracket size
  getNextPowerOf2(n) {
    let power = 2;
    while (power < n) {
      power *= 2;
    }
    return power;
  }

  // Generate matches based on number of players
  async generateDraw() {
    try {
      console.log('Starting to generate draw...');
      
      // Load fresh players data
      await this.loadPlayers();
      
      if (this.players.length < 2) {
        throw new Error('Need at least 2 players to create a draw');
      }

      console.log(`Generating draw for ${this.players.length} players`);
      
      // Extract seed information from players
      const seedIds = [];
      this.players.forEach(player => {
        if (player.seed) {
          // Store player ID at index (seed - 1) to maintain seed order
          seedIds[player.seed - 1] = player.id;
        }
      });
      
      // Remove undefined/null entries and get clean seed array
      const cleanSeedIds = seedIds.filter(id => id);
      
      console.log('Extracted seeds:', cleanSeedIds.map((id, idx) => {
        const player = this.players.find(p => p.id === id);
        return `Seed ${idx + 1}: ${player?.fullName}`;
      }));
      
      // Generate the bracket with seeds
      const matches = this.createBracket(this.players, cleanSeedIds);
      
      // Save to Firebase
      console.log('Saving matches to Firebase...');
      await this.matchesRef.set(matches);
      console.log('Matches saved successfully');
      
      // Update local matches
      this.matches = matches;
      
      return matches;
    } catch (error) {
      console.error('Error generating draw:', error);
      throw error;
    }
  }

  // Create bracket with IJF seeding and repechage
  createBracket(players, seeds = []) {
    console.log('Creating IJF bracket with', players.length, 'players and', seeds.length, 'seeds');
    
    const allMatches = {};
    const numPlayers = players.length;
    
    // Apply IJF seeding
    const seededBracket = this.applyIJFSeeding(players, seeds);
    
    // Create main bracket
    const mainBracket = this.createMainBracket(seededBracket);
    allMatches.main = mainBracket;
    
    // Create repechage brackets (will be populated after main bracket progresses)
    allMatches.repechage = {
      side1: [],
      side2: [],
      bronzeMatches: []
    };
    
    console.log('Created complete bracket structure');
    
    // Log bracket structure for verification
    console.log('\n📊 IJF BRACKET STRUCTURE (First Round):');
    console.log('═══════════════════════════════════════');
    const firstRound = mainBracket.filter(m => m.round === 1);
    firstRound.forEach((match, idx) => {
      const seedA = match.playerASeed ? `[Seed ${match.playerASeed}]` : '';
      const seedB = match.playerBSeed ? `[Seed ${match.playerBSeed}]` : '';
      console.log(`Match ${idx + 1}: ${match.playerAName} ${seedA} vs ${match.playerBName} ${seedB}`);
    });
    console.log('═══════════════════════════════════════');
    
    // Check for seed conflicts
    const seedConflicts = firstRound.filter(m => 
      m.playerASeed && m.playerBSeed && 
      (m.playerASeed <= 2 && m.playerBSeed <= 2)
    );
    if (seedConflicts.length > 0) {
      console.error('❌ SEEDING ERROR: Top 2 seeds meeting in first round!');
      seedConflicts.forEach(m => {
        console.error(`   ${m.playerAName} [Seed ${m.playerASeed}] vs ${m.playerBName} [Seed ${m.playerBSeed}]`);
      });
    }
    console.log('');
    
    return allMatches;
  }
  
  // Create main elimination bracket
  createMainBracket(players) {
    const matches = [];
    const numPlayers = players.filter(p => p !== null).length;
    let round = 1;
    
    // Create first round matches
    const firstRoundMatches = [];
    for (let i = 0; i < Math.ceil(players.length / 2); i++) {
      const playerA = players[i * 2];
      const playerB = players[i * 2 + 1];
      
      // Skip if both players are null (empty bracket positions)
      if (!playerA && !playerB) continue;
      
      const match = {
        id: this.generateId(),
        round,
        matchType: 'main',
        playerA: playerA?.id || null,
        playerB: playerB?.id || null,
        winner: null,
        loser: null,
        completed: false,
        nextMatchId: null,
        playerAName: playerA?.fullName || 'BYE',
        playerBName: playerB?.fullName || 'BYE',
        playerAClub: playerA?.playerInfo?.team || null,
        playerBClub: playerB?.playerInfo?.team || null,
        playerASeed: playerA?.seed || null,
        playerBSeed: playerB?.seed || null,
        weightCategory: playerA?.playerInfo?.weight ? `${playerA.playerInfo.weight}kg` : null,
        repechageEligible: true // Losers can enter repechage
      };
      
      // Auto-complete BYE matches
      if (!playerB && playerA) {
        match.winner = playerA.id;
        match.completed = true;
        match.playerBName = 'BYE';
      } else if (!playerA && playerB) {
        match.winner = playerB.id;
        match.completed = true;
        match.playerAName = 'BYE';
      }
      
      firstRoundMatches.push(match);
    }
    
    matches.push(...firstRoundMatches);

    // Create subsequent rounds
    let currentRound = firstRoundMatches;
    while (currentRound.length > 1) {
      round++;
      const nextRound = [];
      
      for (let i = 0; i < Math.ceil(currentRound.length / 2); i++) {
        const match = {
          id: this.generateId(),
          round,
          matchType: round === this.getMaxRounds(numPlayers) ? 'final' : 'main',
          playerA: null,
          playerB: null,
          playerAName: 'TBD',
          playerBName: 'TBD',
          winner: null,
          loser: null,
          completed: false,
          nextMatchId: null,
          repechageEligible: true
        };
        
        // Link previous matches to this one
        if (currentRound[i * 2]) {
          currentRound[i * 2].nextMatchId = match.id;
        }
        if (currentRound[i * 2 + 1]) {
          currentRound[i * 2 + 1].nextMatchId = match.id;
        }
        
        nextRound.push(match);
      }
      
      matches.push(...nextRound);
      currentRound = nextRound;
    }
    
    console.log('Created main bracket with', matches.length, 'matches');
    return matches;
  }
  
  // Calculate maximum rounds needed
  getMaxRounds(numPlayers) {
    return Math.ceil(Math.log2(numPlayers));
  }
  
  // Create repechage brackets after semifinals are complete
  createRepechageBrackets(mainMatches, finalists) {
    const repechage = {
      side1: [],
      side2: [],
      bronzeMatches: []
    };
    
    if (finalists.length !== 2) {
      console.warn('Need 2 finalists to create repechage');
      return repechage;
    }
    
    // Get all losers to each finalist
    const finalist1Losers = this.getLosersToPlayer(mainMatches, finalists[0]);
    const finalist2Losers = this.getLosersToPlayer(mainMatches, finalists[1]);
    
    // Create repechage matches for side 1
    if (finalist1Losers.length > 0) {
      repechage.side1 = this.createRepechageRounds(finalist1Losers, 'repechage-1');
    }
    
    // Create repechage matches for side 2
    if (finalist2Losers.length > 0) {
      repechage.side2 = this.createRepechageRounds(finalist2Losers, 'repechage-2');
    }
    
    // Create bronze medal matches
    if (repechage.side1.length > 0 && repechage.side2.length > 0) {
      const bronze1 = {
        id: this.generateId(),
        round: 'bronze',
        matchType: 'bronze',
        playerA: null,
        playerB: null,
        playerAName: 'Repechage 1 Winner',
        playerBName: 'Semifinal Loser',
        winner: null,
        completed: false
      };
      
      const bronze2 = {
        id: this.generateId(),
        round: 'bronze',
        matchType: 'bronze',
        playerA: null,
        playerB: null,
        playerAName: 'Repechage 2 Winner',
        playerBName: 'Semifinal Loser',
        winner: null,
        completed: false
      };
      
      repechage.bronzeMatches = [bronze1, bronze2];
    }
    
    return repechage;
  }
  
  // Get all players who lost to a specific player
  getLosersToPlayer(matches, playerId) {
    const losers = [];
    
    // Traverse the bracket backwards from the player
    const playerMatches = matches.filter(m => m.winner === playerId);
    
    playerMatches.forEach(match => {
      const loser = match.playerA === playerId ? match.playerB : match.playerA;
      if (loser) {
        losers.push(loser);
      }
    });
    
    return losers;
  }
  
  // Create repechage rounds
  createRepechageRounds(players, side) {
    const matches = [];
    let round = 1;
    
    // Create matches for repechage
    let currentPlayers = [...players];
    
    while (currentPlayers.length > 1) {
      const roundMatches = [];
      
      for (let i = 0; i < Math.floor(currentPlayers.length / 2); i++) {
        const match = {
          id: this.generateId(),
          round: `${side}-R${round}`,
          matchType: 'repechage',
          playerA: currentPlayers[i * 2],
          playerB: currentPlayers[i * 2 + 1],
          playerAName: 'TBD',
          playerBName: 'TBD',
          winner: null,
          completed: false,
          nextMatchId: null
        };
        
        roundMatches.push(match);
      }
      
      matches.push(...roundMatches);
      currentPlayers = roundMatches.map(() => null); // Winners will fill next round
      round++;
    }
    
    return matches;
  }

  // Get all matches
  async getAllMatches() {
    try {
      const snapshot = await this.matchesRef.once('value');
      const matches = [];
      
      snapshot.forEach(childSnapshot => {
        matches.push({
          id: childSnapshot.key,
          ...childSnapshot.val()
        });
      });
      
      return matches.sort((a, b) => a.round - b.round);
    } catch (error) {
      console.error('Error getting matches:', error);
      throw error;
    }
  }

  // Update a match
  async updateMatch(updatedMatch) {
    try {
      await this.matchesRef.child(updatedMatch.id).update(updatedMatch);
      return true;
    } catch (error) {
      console.error('Error updating match:', error);
      throw error;
    }
  }

  // Helper to generate unique ID
  generateId() {
    return 'match_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}

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
    // Filter dropdowns
    genderFilter.addEventListener('change', filterAndRenderDraws);
    weightFilter.addEventListener('change', filterAndRenderDraws);
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

  // shuffle array
  const shuffled = [...visiblePlayers].sort(() => Math.random() - 0.5);

  // Create placeholder match slots (half of players rounded up)
  const numMatches = Math.ceil(shuffled.length / 2);
  const matchSlots = [];
  for (let i = 0; i < numMatches; i++) {
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

  // For each pair, animate two clones from the player-card to the slot positions
  for (let i = 0; i < shuffled.length; i += 2) {
    const pA = shuffled[i];
    const pB = shuffled[i + 1]; // may be undefined -> BYE

    // Determine source DOM elements using the rendered player-cards (they are in the players-grid)
    // We gave player cards no id earlier — match by data attribute or by text content
    // So ensure renderDraws sets data-player-id attribute on .player-card. If not present, fallback to search by name.

    const sourceA = document.querySelector(`.player-card[data-player-id="${pA.id}"]`) ||
                    document.querySelector(`.player-card h4:contains("${pA.fullName}")`) ||
                    document.querySelector(`.player-card`); // fallback
    const sourceB = pB ? (document.querySelector(`.player-card[data-player-id="${pB.id}"]`) ||
                    document.querySelector(`.player-card h4:contains("${pB.fullName}")`)) : null;

    // target slot
    const slot = matchSlots[Math.floor(i / 2)];

    // compute target positions (slot left and right)
    const slotLeftEl = slot.querySelector('.slot-left .slot-name');
    const slotRightEl = slot.querySelector('.slot-right .slot-name');

    // animate player A -> slot left
    if (sourceA) {
      await animatePlayerToSlot(sourceA, slotLeftEl, pA);
    } else {
      // directly populate if source not found
      slotLeftEl.textContent = pA.fullName || 'N/A';
    }

    // animate player B -> slot right (or BYE)
    if (pB) {
      if (sourceB) {
        await animatePlayerToSlot(sourceB, slotRightEl, pB);
      } else {
        slotRightEl.textContent = pB.fullName || 'N/A';
      }
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

  // Save generated matches to Firebase with IJF seeding
  try {
    // Get seeds from player data (if they have seed property)
    const seeds = shuffled
      .filter(p => p.seed)
      .sort((a, b) => a.seed - b.seed)
      .map(p => p.id);
    
    // Create bracket with IJF seeding
    const bracketData = tournamentDraw.createBracket(shuffled, seeds);
    
    // Save main bracket matches
    await tournamentDraw.matchesRef.set(bracketData.main);
    
    console.log('IJF-compliant matches saved to Firebase with', seeds.length, 'seeds');
  } catch (err) {
    console.error('Error saving animated draw:', err);
  }
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


document.addEventListener('DOMContentLoaded', () => {
    // Initialize TournamentDraw system
    tournamentDraw = new TournamentDraw();

    // Load player list
    loadPlayers();

    // Setup filters
    setupEventListeners();

    // Bind Generate Draw button
    generateDrawBtn.addEventListener("click", animateGenerateDraw);
});

