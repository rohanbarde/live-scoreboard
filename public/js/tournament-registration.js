/**
 * Tournament Registration Logic
 * Handles player registration for specific tournaments with DOB matching
 */

let currentTournament = null;
let tournamentPlayers = [];
let allPlayers = [];

// Get tournament ID from URL
const urlParams = new URLSearchParams(window.location.search);
const tournamentId = urlParams.get('tournamentId');

// Check authentication and load tournament
window.addEventListener('DOMContentLoaded', () => {
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            if (!tournamentId) {
                alert('No tournament selected');
                window.location.href = '/views/tournament-dashboard.html';
                return;
            }
            loadTournament();
        } else {
            window.location.href = '/views/log-in.html';
        }
    });
});

/**
 * Load tournament details
 */
async function loadTournament() {
    try {
        const snapshot = await firebase.database().ref(`tournaments/${tournamentId}`).once('value');
        currentTournament = snapshot.val();
        
        if (!currentTournament) {
            alert('Tournament not found');
            window.location.href = '/views/tournament-dashboard.html';
            return;
        }
        
        currentTournament.id = tournamentId;
        displayTournamentInfo();
        loadAllPlayers();
        loadTournamentPlayers();
        
    } catch (error) {
        console.error('Error loading tournament:', error);
        alert('Error loading tournament');
    }
}

/**
 * Display tournament information
 */
function displayTournamentInfo() {
    document.getElementById('tournamentName').textContent = currentTournament.name;
    
    const metaContainer = document.getElementById('tournamentMeta');
    metaContainer.innerHTML = `
        <span><i class="fas fa-calendar"></i> ${formatDate(currentTournament.date)}</span>
        <span><i class="fas fa-map-marker-alt"></i> ${currentTournament.location}</span>
        ${currentTournament.host ? `<span><i class="fas fa-building"></i> ${currentTournament.host}</span>` : ''}
        <span><i class="fas fa-list"></i> ${currentTournament.categories.length} Categories</span>
    `;
}

/**
 * Format date
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

/**
 * Load all players from database for matching
 */
async function loadAllPlayers() {
    try {
        const snapshot = await firebase.database().ref('registrations')
            .orderByChild('userType')
            .equalTo('player')
            .once('value');
        
        const data = snapshot.val();
        allPlayers = data ? Object.keys(data).map(key => ({
            id: key,
            ...data[key]
        })) : [];
        
        console.log(`Loaded ${allPlayers.length} players from database`);
        
    } catch (error) {
        console.error('Error loading players:', error);
    }
}

/**
 * Load players registered for this tournament (for stats only)
 */
async function loadTournamentPlayers() {
    try {
        const snapshot = await firebase.database()
            .ref(`tournament_registrations/${tournamentId}`)
            .once('value');
        
        const data = snapshot.val();
        tournamentPlayers = data ? Object.keys(data).map(key => ({
            registrationId: key,
            ...data[key]
        })) : [];
        
        console.log(`Loaded ${tournamentPlayers.length} players for this tournament`);
        updateStats();
        
    } catch (error) {
        console.error('Error loading tournament players:', error);
    }
}

/**
 * Update statistics
 */
function updateStats() {
    const total = tournamentPlayers.length;
    const male = tournamentPlayers.filter(p => p.playerInfo?.gender === 'male').length;
    const female = tournamentPlayers.filter(p => p.playerInfo?.gender === 'female').length;
    
    document.getElementById('totalPlayers').textContent = total;
    document.getElementById('maleCount').textContent = male;
    document.getElementById('femaleCount').textContent = female;
}

/**
 * Calculate age from DOB
 */
function calculateAge(dob) {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    
    return age;
}

/**
 * Update weight categories based on gender and tournament categories
 */
function updateWeightCategories() {
    const gender = document.getElementById('gender').value;
    const weightInput = document.getElementById('weight').value;
    const categorySelect = document.getElementById('weightCategory');
    
    categorySelect.innerHTML = '<option value="">Select weight category</option>';
    
    if (!gender || !currentTournament) return;
    
    // Get categories for this tournament
    currentTournament.categories.forEach(categoryKey => {
        const categories = getWeightCategories(categoryKey, gender);
        
        if (categories && categories.length > 0) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = WEIGHT_CATEGORIES[categoryKey].name;
            
            categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = `${categoryKey}_${cat.value}`;
                option.textContent = cat.label;
                optgroup.appendChild(option);
            });
            
            categorySelect.appendChild(optgroup);
        }
    });
    
    // Auto-select based on weight if provided
    if (weightInput && gender) {
        autoSelectWeightCategory(parseFloat(weightInput), gender);
    }
}

/**
 * Auto-select weight category based on weight
 */
function autoSelectWeightCategory(weight, gender) {
    const categorySelect = document.getElementById('weightCategory');
    
    for (const categoryKey of currentTournament.categories) {
        const categories = getWeightCategories(categoryKey, gender);
        
        for (const cat of categories) {
            if (cat.max && weight <= cat.max) {
                categorySelect.value = `${categoryKey}_${cat.value}`;
                return;
            } else if (!cat.max && cat.min && weight > cat.min) {
                categorySelect.value = `${categoryKey}_${cat.value}`;
                return;
            }
        }
    }
}

/**
 * Preview uploaded photo
 */
function previewPhoto(event) {
    const file = event.target.files[0];
    if (file) {
        if (file.size > 2 * 1024 * 1024) {
            alert('File size must be less than 2MB');
            event.target.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById('photoPreview');
            preview.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
}

/**
 * Find existing player by name and DOB
 */
function findExistingPlayer(firstName, lastName, dob) {
    return allPlayers.find(player => {
        const playerFirstName = player.firstName?.toLowerCase().trim();
        const playerLastName = player.lastName?.toLowerCase().trim();
        const playerDob = player.dob;
        
        return playerFirstName === firstName.toLowerCase().trim() &&
               playerLastName === lastName.toLowerCase().trim() &&
               playerDob === dob;
    });
}

/**
 * Generate unique registration ID (MJA/2025/XX format)
 */
async function generateRegistrationId() {
    try {
        const snapshot = await firebase.database().ref('registrations').once('value');
        let maxNum = 0;
        
        snapshot.forEach(child => {
            const p = child.val();
            if (p.registrationId && /^MJA\/2025\/(\d+)$/.test(p.registrationId)) {
                const num = parseInt(p.registrationId.split('/').pop(), 10);
                if (num > maxNum) maxNum = num;
            }
        });
        
        return `MJA/2025/${String(maxNum + 1).padStart(3, '0')}`;
    } catch (error) {
        console.error('Error generating registration ID:', error);
        return `MJA/2025/${Date.now()}`;
    }
}

/**
 * Handle form submission
 */
document.getElementById('playerRegistrationForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const firstName = document.getElementById('firstName').value.trim();
    const middleName = document.getElementById('middleName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const dob = document.getElementById('dob').value;
    const gender = document.getElementById('gender').value;
    const weight = document.getElementById('weight').value;
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const team = document.getElementById('team').value.trim();
    const weightCategory = document.getElementById('weightCategory').value;
    const photoInput = document.getElementById('photoInput');
    
    // Construct full name
    const fullName = middleName 
        ? `${firstName} ${middleName} ${lastName}`
        : `${firstName} ${lastName}`;
    
    try {
        // Check if player already exists
        const existingPlayer = findExistingPlayer(firstName, lastName, dob);
        
        let playerId;
        let playerData;
        let registrationId;
        
        if (existingPlayer) {
            // Use existing player
            playerId = existingPlayer.id;
            playerData = existingPlayer;
            
            // Generate new registration ID if not exists
            if (!playerData.registrationId) {
                registrationId = await generateRegistrationId();
                playerData.registrationId = registrationId;
                // Update existing player with registration ID
                await firebase.database().ref(`registrations/${playerId}/registrationId`).set(registrationId);
                await firebase.database().ref(`users/${playerId}/registrationId`).set(registrationId);
            } else {
                registrationId = playerData.registrationId;
            }
            
            console.log('✅ Found existing player:', playerId, 'Reg ID:', registrationId);
        } else {
            // Create new player
            playerId = `player_${Date.now()}`;
            
            // Generate registration ID
            registrationId = await generateRegistrationId();
            
            // Convert photo to base64 if provided
            let photoBase64 = '';
            if (photoInput.files && photoInput.files[0]) {
                photoBase64 = await convertToBase64(photoInput.files[0]);
            }
            
            playerData = {
                firstName: firstName,
                middleName: middleName,
                lastName: lastName,
                fullName: fullName,
                dob: dob,
                email: email,
                phone: phone,
                registrationId: registrationId,
                userType: 'player',
                playerInfo: {
                    gender: gender,
                    weight: weight,
                    team: team,
                    weightCategory: weightCategory
                },
                photoBase64: photoBase64,
                createdAt: firebase.database.ServerValue.TIMESTAMP
            };
            
            // Save to registrations
            await firebase.database().ref(`registrations/${playerId}`).set(playerData);
            await firebase.database().ref(`users/${playerId}`).set(playerData);
            
            console.log('✅ Created new player:', playerId, 'Reg ID:', registrationId);
            
            // Add to allPlayers array
            allPlayers.push({ id: playerId, ...playerData });
        }
        
        // Register player for this tournament
        const tournamentRegId = `reg_${Date.now()}`;
        const tournamentRegistration = {
            playerId: playerId,
            tournamentId: tournamentId,
            registrationId: registrationId,
            ...playerData,
            registeredAt: firebase.database.ServerValue.TIMESTAMP
        };
        
        await firebase.database()
            .ref(`tournament_registrations/${tournamentId}/${tournamentRegId}`)
            .set(tournamentRegistration);
        
        console.log('✅ Player registered for tournament');
        
        // Show success message
        alert(`Player "${fullName}" registered successfully!\nRegistration ID: ${registrationId}`);
        
        // Reset form and reload
        resetForm();
        await loadTournamentPlayers();
        
    } catch (error) {
        console.error('Error registering player:', error);
        alert('Error registering player. Please try again.');
    }
});

/**
 * Convert file to base64
 */
function convertToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            resolve(result.split(',')[1]); // Remove data:image prefix
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Reset form
 */
function resetForm() {
    document.getElementById('playerRegistrationForm').reset();
    document.getElementById('photoPreview').style.display = 'none';
    document.getElementById('weightCategory').innerHTML = '<option value="">Select gender and weight first</option>';
}

/**
 * Navigate to import players page with tournament context
 */
function goToImportPlayers() {
    sessionStorage.setItem('currentTournament', tournamentId);
    window.location.href = `/views/import-players.html?tournamentId=${tournamentId}`;
}

/**
 * Navigate to generate draws page with tournament context
 */
function navigateToGenerateDraws() {
    if (tournamentId) {
        sessionStorage.setItem('currentTournament', tournamentId);
        sessionStorage.setItem('filterByTournament', 'true');
        window.location.href = `/views/generate-draws.html?tournamentId=${tournamentId}`;
    } else {
        alert('No tournament selected');
    }
}

/**
 * Navigate to scheduled matches page with tournament context
 */
function navigateToScheduledMatches() {
    if (tournamentId) {
        sessionStorage.setItem('currentTournament', tournamentId);
        window.open(`/views/tournament-matches.html?tournamentId=${tournamentId}`, '_blank');
    } else {
        alert('No tournament selected');
    }
}

/**
 * Navigate to import players page with tournament context
 */
function navigateToImportPlayers() {
    if (tournamentId) {
        sessionStorage.setItem('currentTournament', tournamentId);
        window.location.href = `/views/import-players.html?tournamentId=${tournamentId}`;
    } else {
        alert('No tournament selected');
    }
}

/**
 * Navigate to player list with tournament context
 */
function navigateToPlayerList() {
    if (tournamentId) {
        sessionStorage.setItem('currentTournament', tournamentId);
        sessionStorage.setItem('filterByTournament', 'true');
        window.location.href = `/views/player-list.html?tournamentId=${tournamentId}`;
    } else {
        alert('No tournament selected');
    }
}

/**
 * View tournament players using existing player-list.html
 */
function viewTournamentPlayers() {
    sessionStorage.setItem('currentTournament', tournamentId);
    sessionStorage.setItem('filterByTournament', 'true');
    window.location.href = `/views/player-list.html?tournamentId=${tournamentId}`;
}

// Make functions available globally
window.previewPhoto = previewPhoto;
window.resetForm = resetForm;
window.updateWeightCategories = updateWeightCategories;
window.goToImportPlayers = goToImportPlayers;
window.viewTournamentPlayers = viewTournamentPlayers;
window.goToGenerateDraws = goToGenerateDraws;
window.navigateToGenerateDraws = navigateToGenerateDraws;
window.navigateToScheduledMatches = navigateToScheduledMatches;
window.navigateToImportPlayers = navigateToImportPlayers;
window.navigateToPlayerList = navigateToPlayerList;
