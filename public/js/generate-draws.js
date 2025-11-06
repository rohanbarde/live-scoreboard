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
    console.log('Creating bracket with players:', players);
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
      
      console.log(`Created match ${match.id}: ${playerA?.fullName || 'BYE'} vs ${playerB?.fullName || 'BYE'}`);
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
    try {
        // Initialize Firebase
        const firebaseConfig = window.firebaseConfig;
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        database = firebase.database();
        
        // Initialize TournamentDraw
        tournamentDraw = new TournamentDraw();
        
        // Load players
        loadPlayers();
        
        // Set up event listeners
        setupEventListeners();
        
        // Set up generate draw button
        if (generateDrawBtn) {
            generateDrawBtn.addEventListener('click', async () => {
                try {
                    const confirmGenerate = confirm('Are you sure you want to generate a new draw? This will replace any existing draw.');
                    if (!confirmGenerate) return;
                    
                    generateDrawBtn.disabled = true;
                    const originalText = generateDrawBtn.innerHTML;
                    generateDrawBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
                    
                    await tournamentDraw.generateDraw();
                    alert('Tournament draw generated successfully!');
                    
                    // Refresh the page to show the updated draw
                    window.location.reload();
                } catch (error) {
                    console.error('Error generating draw:', error);
                    alert('Error generating draw: ' + error.message);
                } finally {
                    if (generateDrawBtn) {
                        generateDrawBtn.disabled = false;
                        generateDrawBtn.innerHTML = originalText;
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error initializing application:', error);
        showError('Failed to initialize the application. Please check your internet connection.');
    }
});

// Load players from Firebase
function loadPlayers() {
    showLoading(true);
    
    const playersRef = database.ref('registrations');
    
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
        
        console.log('Loaded players:', players);
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

// Render the draws
function renderDraws(players) {
    if (!players || players.length === 0) {
        drawsContent.innerHTML = `
            <div class="no-players">
                <i class="fas fa-users-slash" style="font-size: 2rem; opacity: 0.5; margin-bottom: 10px; display: block;"></i>
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
            <div class="draws-section">
                <h3>${weightTitle} (${weightPlayers.length} players)</h3>
                <div class="players-grid">
                    ${weightPlayers.map(player => `
                        <div class="player-card">
                            <div class="player-avatar">
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
    
    drawsContent.innerHTML = html;
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
    alert(message);
}
