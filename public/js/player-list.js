// Initialize Firebase
let database;
let players = [];
let filteredPlayers = [];
let teams = new Set();
let weights = new Set();

// DOM Elements
const playersTableBody = document.getElementById('playersTableBody');
const searchBox = document.querySelector('.search-box');
const searchInput = document.getElementById('searchInput');
const weightFilter = document.getElementById('weightFilter');
const teamFilter = document.getElementById('teamFilter');
const genderFilter = document.getElementById('genderFilter');
const printButton = document.getElementById('printButton');
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
    genderFilter.addEventListener('change', filterAndRenderPlayers);
    
    // Print button
    if (printButton) {
        printButton.addEventListener('click', handlePrint);
    }
}

// Handle print functionality
function handlePrint() {
    // Create a print-friendly version of the player list
    const printWindow = window.open('', '_blank');
    const currentDate = new Date().toLocaleDateString();
    
    // Get the filtered players data
    const playersToPrint = filteredPlayers.length > 0 ? filteredPlayers : players;
    
    // Group players by weight category for better organization
    const playersByWeight = {};
    playersToPrint.forEach(player => {
        const weight = player.playerInfo?.weight || 'No Weight';
        if (!playersByWeight[weight]) {
            playersByWeight[weight] = [];
        }
        playersByWeight[weight].push(player);
    });
    
    // Generate the HTML for the print view
    let printHTML = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Player List - ${currentDate}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { text-align: center; margin-bottom: 20px; }
            .print-header { margin-bottom: 20px; text-align: center; }
            .print-header p { margin: 5px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .weight-category { margin-top: 30px; font-size: 1.2em; font-weight: bold; }
            .no-print { display: none; }
            .print-footer { margin-top: 30px; text-align: right; font-size: 0.9em; color: #666; }
        </style>
    </head>
    <body>
        <div class="print-header">
            <h1>Player List</h1>
            <p>Date: ${currentDate}</p>
            <p>Total Players: ${playersToPrint.length}</p>
        </div>
    `;
    
    // Add filter information if any filter is active
    const activeFilters = [];
    if (weightFilter.value) activeFilters.push(`Weight: ${weightFilter.options[weightFilter.selectedIndex].text}`);
    if (teamFilter.value) activeFilters.push(`Team: ${teamFilter.value}`);
    if (genderFilter.value) activeFilters.push(`Gender: ${genderFilter.options[genderFilter.selectedIndex].text}`);
    
    if (activeFilters.length > 0) {
        printHTML += `
        <div class="filters">
            <p><strong>Filters Applied:</strong> ${activeFilters.join(', ')}</p>
        </div>
        `;
    }
    
    // Add players grouped by weight category
    Object.entries(playersByWeight).forEach(([weight, playersInWeight]) => {
        printHTML += `
        <div class="weight-category">
            Weight: ${weight} kg (${playersInWeight.length} players)
        </div>
        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Gender</th>
                    <th>Team</th>
                    <th>Weight</th>
                    <th>Contact</th>
                </tr>
            </thead>
            <tbody>
        `;
        
        playersInWeight.forEach((player, index) => {
            printHTML += `
            <tr>
                <td>${index + 1}</td>
                <td>${player.fullName || 'N/A'}</td>
                <td>${player.playerInfo?.gender ? player.playerInfo.gender.charAt(0).toUpperCase() + player.playerInfo.gender.slice(1) : 'N/A'}</td>
                <td>${player.playerInfo?.team || 'N/A'}</td>
                <td>${player.playerInfo?.weight ? player.playerInfo.weight + ' kg' : 'N/A'}</td>
                <td>${player.phone || player.email || 'N/A'}</td>
            </tr>
            `;
        });
        
        printHTML += `
            </tbody>
        </table>
        `;
    });
    
    // Add footer
    printHTML += `
        <div class="print-footer">
            <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
    </body>
    </html>`;
    
    // Write the content and trigger print
    printWindow.document.open();
    printWindow.document.write(printHTML);
    printWindow.document.close();
    
    // Wait for content to load before printing
    printWindow.onload = function() {
        setTimeout(() => {
            printWindow.print();
            printWindow.onafterprint = function() {
                printWindow.close();
            };
        }, 500);
    };
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
    const selectedGender = genderFilter.value;
    
    filteredPlayers = players.filter(player => {
        // Filter by search term (name, email, or phone)
        const matchesSearch = !searchTerm || 
            (player.fullName && player.fullName.toLowerCase().includes(searchTerm)) ||
            (player.email && player.email.toLowerCase().includes(searchTerm)) ||
            (player.phone && player.phone.includes(searchTerm));
        
        // Filter by weight (using playerInfo.weight)
        const matchesWeight = !selectedWeight || 
            (player.playerInfo?.weight && player.playerInfo.weight.toString() === selectedWeight);
        
        // Filter by team (using playerInfo.team)
        const matchesTeam = !selectedTeam || 
            (player.playerInfo?.team && player.playerInfo.team === selectedTeam);
        
        // Filter by gender (using playerInfo.gender)
        const matchesGender = !selectedGender || 
            (player.playerInfo?.gender && player.playerInfo.gender.toLowerCase() === selectedGender.toLowerCase());
        
        return matchesSearch && matchesWeight && matchesTeam && matchesGender;
    });
    
    renderPlayers();
}

// Render players in the table
function renderPlayers() {
    if (!playersTableBody) return;
    
    if (filteredPlayers.length === 0) {
        playersTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4">
                    <i class="fas fa-users-slash" style="font-size: 2rem; opacity: 0.3; margin-bottom: 10px; display: block;"></i>
                    <p>No players found matching your criteria</p>
                </td>
            </tr>
        `;
        return;
    }
    
    playersTableBody.innerHTML = filteredPlayers.map((player, index) => {
        // Prepare photo HTML if available
        let photoHtml = '';
        if (player.photoBase64) {
            photoHtml = `<img src="data:image/jpeg;base64,${player.photoBase64}" alt="Player Photo" class="player-photo" style="width:36px;height:36px;border-radius:50%;object-fit:cover;">`;
        } else {
            photoHtml = `<div class="avatar">${getInitials(player.fullName || '')}</div>`;
        }
        return `
            <tr>
                <td>${index + 1}</td>
                <td>${photoHtml}</td>
                <td>
                    <div class="d-flex align-items-center">
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
