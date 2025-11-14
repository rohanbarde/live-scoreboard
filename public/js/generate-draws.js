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

  // Generate a random seed for players
  seedPlayers() {
    // Simple random shuffle
    return [...this.players].sort(() => Math.random() - 0.5);
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
      
      // Generate the bracket
      const seededPlayers = this.seedPlayers();
      const matches = this.createBracket(seededPlayers);
      
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

  // Create bracket based on number of players
  createBracket(players) {
//    console.log('Creating bracket with players:', players);
    const matches = [];
    const numPlayers = players.length;
    let round = 1;
    
    // Create first round matches
    const firstRoundMatches = [];
    for (let i = 0; i < Math.ceil(numPlayers / 2); i++) {
      const playerA = players[i * 2];
      const playerB = players[i * 2 + 1];
      
      const match = {
        id: this.generateId(),
        round,
        playerA: playerA?.id || null,
        playerB: playerB?.id || null,
        winner: null,
        completed: false,
        nextMatchId: null,
        playerAName: playerA?.fullName || null,
        playerBName: playerB?.fullName || null,
        playerAClub: playerA?.playerInfo?.team || null,
        playerBClub: playerB?.playerInfo?.team || null,
        weightCategory: playerA?.playerInfo?.weight ? `${playerA.playerInfo.weight}kg` : null
      };
      
//      console.log(`Created match ${match.id}: ${playerA?.fullName || 'BYE'} vs ${playerB?.fullName || 'BYE'}`);
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
          playerA: null,
          playerB: null,
          playerAName: 'Winner of match',
          playerBName: 'Winner of match',
          winner: null,
          completed: false,
          nextMatchId: null
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
    
    console.log('Created bracket with', matches.length, 'matches');
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

    // Show overlay spinner
    shuffleAnim.style.display = 'flex';
    const overlayText = shuffleAnim.querySelector('.mt-3');
    overlayText.textContent = 'Shuffling Players...';

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
        shuffleAnim.style.display = 'none';
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
  shuffle.textContent = 'Shuffling players...';
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

  // Optional: save generated matches to Firebase using tournamentDraw.generateDraw()
  // but to keep animation in sync, call generateDraw after animation
  try {
    // Convert shuffled into the format your generateDraw expects (set tournamentDraw.players before call)
    // We'll set tournamentDraw.players to the current visiblePlayers then call generateDraw()
    // Slight note: your TournamentDraw.generateDraw loads players from DB. If you want to persist this animated order,
    // you can call tournamentDraw.createBracket(shuffled) and then save matchesRef.set(matches).
    const matches = tournamentDraw.createBracket(shuffled);
    await tournamentDraw.matchesRef.set(matches);
    console.log('Animated matches saved to Firebase.');
    // optional reload or re-render
    // window.location.reload();
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
                        <div class="player-card" data-player-id="${player.id}">
                            <div class="player-avatar" style="background: ${getColorForString(player.fullName || '')}">
                                ${getInitials(player.fullName || '')}
                            </div>
                            <div class="player-info">
                                <h4>${player.fullName || 'N/A'}</h4>
                                <div class="player-details">
                                    ${player.playerInfo?.gender ? player.playerInfo.gender.charAt(0).toUpperCase() + player.playerInfo.gender.slice(1) : ''}
                                    ${player.playerInfo?.team ? ' • ' + player.playerInfo.team : ''}
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

