// Initialize Firebase
let database;
let players = [];
let weights = new Set();

// DOM Elements
const genderFilter = document.getElementById('drawGenderFilter');
const weightFilter = document.getElementById('drawWeightFilter');
const drawsContent = document.getElementById('drawsContent');

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Initialize Firebase
        const firebaseConfig = window.firebaseConfig;
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        database = firebase.database();
        
        // Load players
        loadPlayers();
        
        // Set up event listeners
        setupEventListeners();
    } catch (error) {
        console.error('Error initializing Firebase:', error);
        showError('Failed to initialize the application. Please check your internet connection.');
    }
});

// Load players from Firebase
function loadPlayers() {
    showLoading(true);
    
    const playersRef = database.ref('registrations').orderByChild('userType').equalTo('player');
    
    playersRef.on('value', (snapshot) => {
        players = [];
        weights.clear();
        
        snapshot.forEach((childSnapshot) => {
            const player = childSnapshot.val();
            player.id = childSnapshot.key;
            
            if (player.userType === 'player') {
                players.push(player);
                
                // Add weight to weights set if it exists
                if (player.playerInfo?.weight) {
                    weights.add(player.playerInfo.weight);
                }
            }
        });
        
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
    const currentValue = weightFilterEl.value;
    
    // Clear existing options except the first one
    weightFilterEl.innerHTML = '<option value="">All Weights</option>';
    
    // Add weight options
    Array.from(weights).sort().forEach(weight => {
        if (weight) {
            const option = document.createElement('option');
            option.value = weight;
            option.textContent = `${weight} kg`;
            weightFilterEl.appendChild(option);
        }
    });
    
    // Restore previous value if it still exists
    if (Array.from(weights).includes(currentValue)) {
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
    const selectedGender = genderFilter.value;
    const selectedWeight = weightFilter.value;
    
    // Filter players
    const filteredPlayers = players.filter(player => {
        // Filter by gender
        const matchesGender = !selectedGender || 
            (player.playerInfo?.gender && 
             player.playerInfo.gender.toLowerCase() === selectedGender.toLowerCase());
        
        // Filter by weight
        const matchesWeight = !selectedWeight || 
            (player.playerInfo?.weight && 
             player.playerInfo.weight.toString() === selectedWeight);
        
        return matchesGender && matchesWeight;
    });
    
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
