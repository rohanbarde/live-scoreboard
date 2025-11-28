/**
 * Tournament Dashboard Logic
 * Handles tournament creation, selection, and management
 */

let currentUser = null;
let tournaments = [];

// Check authentication on page load
window.addEventListener('DOMContentLoaded', () => {
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            console.log('User authenticated:', user.email);
            initializeDashboard();
        } else {
            // Redirect to login if not authenticated
            window.location.href = '/views/log-in.html';
        }
    });
});

/**
 * Initialize dashboard
 */
function initializeDashboard() {
    loadCategories();
    loadTournaments();
}

/**
 * Load categories into create tournament modal
 */
function loadCategories() {
    const categoryCheckboxes = document.getElementById('categoryCheckboxes');
    const ageGroups = getAgeGroups();
    
    categoryCheckboxes.innerHTML = '';
    
    ageGroups.forEach(group => {
        const col = document.createElement('div');
        col.className = 'col-md-6 mb-2';
        
        col.innerHTML = `
            <div class="form-check">
                <input class="form-check-input" type="checkbox" value="${group.key}" 
                       id="category_${group.key}">
                <label class="form-check-label" for="category_${group.key}">
                    <strong>${group.name}</strong> <small class="text-muted">(${group.ageRange})</small>
                </label>
            </div>
        `;
        
        categoryCheckboxes.appendChild(col);
    });
}

/**
 * Load existing tournaments
 */
async function loadTournaments() {
    const container = document.getElementById('tournamentListContainer');
    
    // Show loading indicator
    container.innerHTML = `
        <div class="text-center py-4">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-2">Loading tournaments...</p>
        </div>
    `;
    
    try {
        // Use limitToLast to get recent tournaments only (optimize for large datasets)
        const snapshot = await firebase.database().ref('tournaments')
            .orderByChild('date')
            .limitToLast(50) // Load last 50 tournaments
            .once('value');
        const data = snapshot.val();
        
        if (!data) {
            container.innerHTML = `
                <div class="no-tournaments">
                    <i class="fas fa-inbox"></i>
                    <p>No tournaments found. Create your first tournament to get started!</p>
                </div>
            `;
            return;
        }
        
        // Convert to array and sort by date (newest first)
        tournaments = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
        })).sort((a, b) => new Date(b.date) - new Date(a.date));
        
        console.log(`✅ Loaded ${tournaments.length} tournaments`);
        renderTournaments();
        
    } catch (error) {
        console.error('Error loading tournaments:', error);
        container.innerHTML = `
            <div class="no-tournaments">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error loading tournaments. Please try again.</p>
            </div>
        `;
    }
}

/**
 * Render tournaments list
 */
function renderTournaments() {
    const container = document.getElementById('tournamentListContainer');
    
    if (tournaments.length === 0) {
        container.innerHTML = `
            <div class="no-tournaments">
                <i class="fas fa-inbox"></i>
                <p>No tournaments found. Create your first tournament to get started!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '<div class="tournament-list"></div>';
    const listContainer = container.querySelector('.tournament-list');
    
    tournaments.forEach(tournament => {
        const status = getTournamentStatus(tournament.date);
        const item = document.createElement('div');
        item.className = 'tournament-item';
        item.onclick = () => openTournament(tournament.id);
        
        item.innerHTML = `
            <div class="tournament-info">
                <h4>${tournament.name}</h4>
                <div class="tournament-meta">
                    <span><i class="fas fa-calendar"></i> ${formatDate(tournament.date)}</span>
                    <span><i class="fas fa-map-marker-alt"></i> ${tournament.location}</span>
                    <span class="badge badge-${status.class}">${status.label}</span>
                </div>
            </div>
            <i class="fas fa-chevron-right" style="color: #667eea;"></i>
        `;
        
        listContainer.appendChild(item);
    });
}

/**
 * Get tournament status based on date
 */
function getTournamentStatus(dateString) {
    const tournamentDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    tournamentDate.setHours(0, 0, 0, 0);
    
    if (tournamentDate.getTime() === today.getTime()) {
        return { class: 'active', label: 'Active' };
    } else if (tournamentDate > today) {
        return { class: 'upcoming', label: 'Upcoming' };
    } else {
        return { class: 'completed', label: 'Completed' };
    }
}

/**
 * Format date for display
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

/**
 * Create new tournament
 */
async function createTournament() {
    const name = document.getElementById('tournamentName').value.trim();
    const date = document.getElementById('tournamentDate').value;
    const location = document.getElementById('tournamentLocation').value.trim();
    const host = document.getElementById('tournamentHost').value.trim();
    const organizer = document.getElementById('tournamentOrganizer').value.trim();
    const sponsor = document.getElementById('tournamentSponsor').value.trim();
    
    // Get selected categories
    const categoryCheckboxes = document.querySelectorAll('#categoryCheckboxes input[type="checkbox"]:checked');
    const categories = Array.from(categoryCheckboxes).map(cb => cb.value);
    
    // Validation
    if (!name || !date || !location) {
        alert('Please fill in all required fields (Tournament Name, Date, Location)');
        return;
    }
    
    if (categories.length === 0) {
        alert('Please select at least one category for this tournament');
        return;
    }
    
    try {
        // Generate tournament ID
        const tournamentId = `tournament_${Date.now()}`;
        
        // Prepare tournament data
        const tournamentData = {
            name: name,
            date: date,
            location: location,
            host: host || '',
            organizer: organizer || '',
            sponsor: sponsor || '',
            categories: categories,
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            createdBy: currentUser.uid,
            status: 'upcoming'
        };
        
        // Save to Firebase
        await firebase.database().ref(`tournaments/${tournamentId}`).set(tournamentData);
        
        console.log('✅ Tournament created:', tournamentId);
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('createTournamentModal'));
        modal.hide();
        
        // Reset form
        document.getElementById('createTournamentForm').reset();
        
        // Reload tournaments
        await loadTournaments();
        
        // Show success message
        alert(`Tournament "${name}" created successfully!`);
        
    } catch (error) {
        console.error('Error creating tournament:', error);
        alert('Error creating tournament. Please try again.');
    }
}

/**
 * Open tournament for management
 */
function openTournament(tournamentId) {
    // Store selected tournament in session storage
    sessionStorage.setItem('currentTournament', tournamentId);
    
    // Redirect to tournament registration page
    window.location.href = `/views/tournament-registration.html?tournamentId=${tournamentId}`;
}

/**
 * View all players (clear any tournament filter)
 */
function viewAllPlayers() {
    sessionStorage.removeItem('filterByTournament');
    sessionStorage.removeItem('currentTournament');
    window.location.href = '/views/player-list.html';
}

/**
 * Logout user
 */
function logout() {
    firebase.auth().signOut().then(() => {
        window.location.href = '/views/log-in.html';
    }).catch((error) => {
        console.error('Logout error:', error);
        alert('Error logging out. Please try again.');
    });
}

// Make functions available globally
window.createTournament = createTournament;
window.openTournament = openTournament;
window.viewAllPlayers = viewAllPlayers;
window.logout = logout;
