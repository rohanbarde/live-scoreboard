// Initialize Firebase
let database;
let players = [];
let filteredPlayers = [];
let teams = new Set();
let weights = new Set();

// DOM Elements
const playersTableBody = document.getElementById('playersTableBody');
const searchInput = document.getElementById('searchInput');
const weightFilter = document.getElementById('weightFilter');
const teamFilter = document.getElementById('teamFilter');
const totalPlayersEl = document.getElementById('totalPlayers');
const totalTeamsEl = document.getElementById('totalTeams');
const weightCategoriesEl = document.getElementById('weightCategories');

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Firebase
    try {
        const firebaseConfig = window.firebaseConfig; // Make sure this is defined in firebase.js
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
        teams.clear();
        weights.clear();
        
        snapshot.forEach((childSnapshot) => {
            const player = childSnapshot.val();
            player.id = childSnapshot.key;
            
            // Only add players (not other user types)
            if (player.userType === 'player') {
                players.push(player);
                
                // Add team to teams set if it exists
                if (player.playerInfo?.team) {
                    teams.add(player.playerInfo.team);
                }
                
                // Add weight to weights set if it exists
                if (player.playerInfo?.weight) {
                    weights.add(player.playerInfo.weight);
                }
            }
        });
        
        // Sort players by name
        players.sort((a, b) => {
            const nameA = a.fullName?.toLowerCase() || '';
            const nameB = b.fullName?.toLowerCase() || '';
            return nameA.localeCompare(nameB);
        });
        
        // Update filters
        updateFilters();
        
        // Apply current filters and render
        filterAndRenderPlayers();
        
        // Update stats
        updateStats();
        
        showLoading(false);
    }, (error) => {
        console.error('Error loading players:', error);
        showError('Failed to load players. Please try again.');
        showLoading(false);
    });
}

// Set up event listeners
function setupEventListeners() {
    // Search input
    searchInput.addEventListener('input', debounce(() => {
        filterAndRenderPlayers();
    }, 300));
    
    // Filter dropdowns
    weightFilter.addEventListener('change', filterAndRenderPlayers);
    teamFilter.addEventListener('change', filterAndRenderPlayers);
}

// Update filter dropdowns
function updateFilters() {
    // Update weight filter
    updateFilterOptions(weightFilter, Array.from(weights).sort(), 'All Weights');
    
    // Update team filter
    updateFilterOptions(teamFilter, Array.from(teams).sort(), 'All Teams');
}

// Helper function to update filter options
function updateFilterOptions(selectElement, options, defaultOption) {
    // Save current value
    const currentValue = selectElement.value;
    
    // Clear existing options
    selectElement.innerHTML = `<option value="">${defaultOption}</option>`;
    
    // Add new options
    options.forEach(option => {
        if (option) { // Skip empty/null options
            const optionElement = document.createElement('option');
            optionElement.value = option;
            optionElement.textContent = option;
            selectElement.appendChild(optionElement);
        }
    });
    
    // Restore previous value if it still exists
    if (options.includes(currentValue)) {
        selectElement.value = currentValue;
    }
}

// Filter players based on search and filters
function filterAndRenderPlayers() {
    const searchTerm = searchInput.value.toLowerCase();
    const selectedWeight = weightFilter.value;
    const selectedTeam = teamFilter.value;
    
    filteredPlayers = players.filter(player => {
        // Filter by search term (name, email, or phone)
        const matchesSearch = !searchTerm || 
            (player.fullName && player.fullName.toLowerCase().includes(searchTerm)) ||
            (player.email && player.email.toLowerCase().includes(searchTerm)) ||
            (player.phone && player.phone.includes(searchTerm));
        
        // Filter by weight
        const matchesWeight = !selectedWeight || 
            (player.weight && player.weight.toString() === selectedWeight);
        
        // Filter by team
        const matchesTeam = !selectedTeam || 
            (player.team && player.team === selectedTeam);
        
        return matchesSearch && matchesWeight && matchesTeam;
    });
    
    renderPlayers();
}

// Render players in the table
function renderPlayers() {
    if (!playersTableBody) return;
    
    if (filteredPlayers.length === 0) {
        playersTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4">
                    <i class="fas fa-users-slash" style="font-size: 2rem; opacity: 0.3; margin-bottom: 10px; display: block;"></i>
                    <p>No players found matching your criteria</p>
                </td>
            </tr>
        `;
        return;
    }
    
    playersTableBody.innerHTML = filteredPlayers.map((player, index) => {
        return `
            <tr>
                <td>${index + 1}</td>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="avatar">${getInitials(player.fullName || '')}</div>
                        <div>
                            <div class="fw-500">${player.fullName || 'N/A'}</div>
                            <small class="text-muted">${player.email || ''}</small>
                        </div>
                    </div>
                </td>
                <td>${player.playerInfo?.weight ? player.playerInfo.weight + ' kg' : 'N/A'}</td>
                <td>${player.playerInfo?.team || 'N/A'}</td>
                <td>${player.playerInfo?.gender ? player.playerInfo.gender.charAt(0).toUpperCase() + player.playerInfo.gender.slice(1) : 'N/A'}</td>
                <td>${player.phone || 'N/A'}</td>
            </tr>
        `;
    }).join('');
}

// Update statistics
function updateStats() {
    // Total players
    totalPlayersEl.textContent = players.length;
    
    // Total teams
    totalTeamsEl.textContent = teams.size;
    
    // Weight categories
    weightCategoriesEl.textContent = weights.size;
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
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.style.display = show ? 'block' : 'none';
    }
}

// Show error message
function showError(message) {
    console.error(message);
    // You can implement a more user-friendly error display here
    alert(message);
}

// Debounce function to limit how often a function is called
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// Add CSS for the avatar
const style = document.createElement('style');
style.textContent = `
    .avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background-color: var(--primary-color);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 12px;
        font-size: 0.8rem;
        font-weight: 600;
    }
    
    .fw-500 {
        font-weight: 500;
    }
    
    .d-flex {
        display: flex;
    }
    
    .align-items-center {
        align-items: center;
    }
    
    .text-center {
        text-align: center;
    }
    
    .text-muted {
        color: #6c757d;
    }
`;
document.head.appendChild(style);

// Add loading indicator
const loadingElement = document.createElement('div');
loadingElement.id = 'loading';
loadingElement.className = 'loading';
loadingElement.innerHTML = '<i class="fas fa-spinner"></i><p>Loading players...</p>';
document.querySelector('.player-list-container').prepend(loadingElement);

// Show loading initially
showLoading(true);
