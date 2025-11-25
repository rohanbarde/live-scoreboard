/**
 * Tournament Matches - Multi-Device Management UI
 */

let matchManager;
let currentMatches = [];
let currentDevices = [];

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎯 Initializing Tournament Matches Multi-Device...');
    
    // Wait for Firebase to be ready
    if (typeof firebase === 'undefined') {
        console.error('❌ Firebase not loaded');
        return;
    }

    // Initialize Match Manager
    matchManager = new MatchManager();
    
    // Show device setup modal on first load
    if (!localStorage.getItem('deviceName')) {
        showDeviceSetupModal();
    } else {
        initializeUI();
    }
});

/**
 * Show device setup modal
 */
function showDeviceSetupModal() {
    const modal = document.createElement('div');
    modal.className = 'modal fade show';
    modal.style.display = 'block';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    modal.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">🎯 Device Setup</h5>
                </div>
                <div class="modal-body">
                    <p>Please give this device a name (e.g., "Mat 1", "Mat 2", "Admin Desk")</p>
                    <input type="text" id="deviceNameInput" class="form-control" placeholder="Enter device name" autofocus>
                    <small class="text-muted mt-2 d-block">Device ID: ${window.DEVICE_ID}</small>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-primary" onclick="saveDeviceName()">Save & Continue</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Focus input
    setTimeout(() => {
        document.getElementById('deviceNameInput').focus();
    }, 100);
    
    // Allow Enter key to submit
    document.getElementById('deviceNameInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            saveDeviceName();
        }
    });
}

/**
 * Save device name
 */
async function saveDeviceName() {
    const input = document.getElementById('deviceNameInput');
    const name = input.value.trim();
    
    if (!name) {
        alert('Please enter a device name');
        return;
    }
    
    try {
        await matchManager.setDeviceName(name);
        
        // Remove modal
        const modal = document.querySelector('.modal');
        if (modal) {
            modal.remove();
        }
        
        // Initialize UI
        initializeUI();
        
    } catch (error) {
        console.error('Error saving device name:', error);
        alert('Error saving device name. Please try again.');
    }
}

/**
 * Initialize UI
 */
function initializeUI() {
    // Display device info
    displayDeviceInfo();
    
    // Load matches
    loadMatches();
    
    // Load devices for modal
    loadDevices();
    
    // Setup Show Devices button
    setupShowDevicesButton();
    
    // Set up event listeners
    setupEventListeners();
    
    console.log('✅ UI initialized');
}

/**
 * Display device info
 */
function displayDeviceInfo() {
    const deviceInfo = matchManager.getDeviceInfo();
    const deviceInfoEl = document.getElementById('deviceInfo');
    
    if (deviceInfoEl) {
        deviceInfoEl.innerHTML = `
            <div style="display: flex; gap: 10px; align-items: center;">
                <span style="font-size: 0.9rem; font-weight: 500; color: #6c757d;">
                    <i class="fas fa-desktop" style="margin-right: 5px;"></i>${deviceInfo.deviceName}
                </span>
                <button class="btn btn-outline" onclick="changeDeviceName()" style="padding: 10px 16px; font-size: 0.9rem;">
                    <i class="fas fa-edit"></i> Change Name
                </button>
            </div>
        `;
    }
}

/**
 * Change device name
 */
function changeDeviceName() {
    const newName = prompt('Enter new device name:', window.DEVICE_NAME);
    if (newName && newName.trim()) {
        matchManager.setDeviceName(newName.trim()).then(() => {
            displayDeviceInfo();
            alert('Device name updated!');
        });
    }
}

/**
 * Load matches
 */
function loadMatches() {
    console.log('🔄 Loading matches...');
    matchManager.onMatchesUpdate(matches => {
        console.log('📊 Matches received:', matches.length);
        console.log('Matches data:', matches);
        currentMatches = matches;
        renderMatches(matches);
    });
}

/**
 * Load devices
 */
function loadDevices() {
    setInterval(async () => {
        const devices = await matchManager.getDevices();
        currentDevices = devices;
        // Only render if modal is open
        const modal = document.getElementById('devicesModal');
        if (modal && modal.style.display === 'block') {
            renderDevicesModal(devices);
        }
    }, 5000);
}

/**
 * Setup Show Devices button
 */
function setupShowDevicesButton() {
    const btn = document.getElementById('showDevicesBtn');
    if (btn) {
        btn.addEventListener('click', showDevicesModal);
    }
}

/**
 * Show devices modal
 */
function showDevicesModal() {
    const modal = document.getElementById('devicesModal');
    if (modal) {
        modal.style.display = 'block';
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        
        // Add backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop fade show';
        backdrop.id = 'devicesModalBackdrop';
        document.body.appendChild(backdrop);
        
        // Load and render devices immediately
        matchManager.getDevices().then(devices => {
            renderDevicesModal(devices);
        });
    }
}

/**
 * Close devices modal
 */
function closeDevicesModal() {
    const modal = document.getElementById('devicesModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('show');
        document.body.style.overflow = '';
        
        // Remove backdrop
        const backdrop = document.getElementById('devicesModalBackdrop');
        if (backdrop) {
            backdrop.remove();
        }
    }
}

/**
 * Render matches
 */
function renderMatches(matches) {
    console.log('🎨 Rendering matches:', matches.length);
    const container = document.getElementById('matchesContainer');
    if (!container) {
        console.error('❌ matchesContainer not found in DOM');
        return;
    }
    
    if (matches.length === 0) {
        console.log('⚠️ No matches to display');
        container.innerHTML = `
            <div class="alert alert-warning">
                <i class="fas fa-info-circle"></i> No matches available. 
                <a href="/views/generate-draws.html" class="alert-link">Generate draws first</a>
            </div>
        `;
        return;
    }
    
    // Separate main bracket and repechage matches
    const mainMatches = matches.filter(m => !m.isRepechage && m.matchType !== 'repechage' && m.matchType !== 'bronze');
    const repechageMatches = matches.filter(m => m.isRepechage || m.matchType === 'repechage' || m.matchType === 'bronze');
    
    // Group matches by status - handle both old and new format
    const pending = mainMatches.filter(m => {
        const status = m.status || (m.completed ? 'completed' : 'pending');
        const isCompleted = m.completed === true || m.status === 'completed';
        return status === 'pending' && !isCompleted;
    });
    const locked = mainMatches.filter(m => m.status === 'locked');
    const inProgress = mainMatches.filter(m => m.status === 'in_progress');
    const completed = mainMatches.filter(m => {
        return m.status === 'completed' || m.completed === true;
    });
    
    // Repechage matches by status
    const repechagePending = repechageMatches.filter(m => {
        const status = m.status || (m.completed ? 'completed' : 'pending');
        const isCompleted = m.completed === true || m.status === 'completed';
        return status === 'pending' && !isCompleted;
    });
    const repechageInProgress = repechageMatches.filter(m => m.status === 'in_progress');
    const repechageCompleted = repechageMatches.filter(m => m.status === 'completed' || m.completed === true);
    
    console.log('📋 Grouped matches:', {
        main: { pending: pending.length, locked: locked.length, inProgress: inProgress.length, completed: completed.length },
        repechage: { pending: repechagePending.length, inProgress: repechageInProgress.length, completed: repechageCompleted.length }
    });
    
    let html = '';
    
    // MAIN BRACKET SECTION
    html += '<h3 class="mt-3 mb-3"><i class="fas fa-trophy"></i> Main Bracket</h3>';
    
    // Pending matches
    if (pending.length > 0) {
        html += `<h4 class="mt-4">⏳ Pending Matches (${pending.length})</h4>`;
        html += '<div class="row g-3">';
        pending.forEach(match => {
            html += renderMatchCard(match);
        });
        html += '</div>';
    }
    
    // Locked matches
    if (locked.length > 0) {
        html += `<h4 class="mt-4">🔒 Locked Matches (${locked.length})</h4>`;
        html += '<div class="row g-3">';
        locked.forEach(match => {
            html += renderMatchCard(match);
        });
        html += '</div>';
    }
    
    // In progress matches
    if (inProgress.length > 0) {
        html += `<h4 class="mt-4">▶️ In Progress (${inProgress.length})</h4>`;
        html += '<div class="row g-3">';
        inProgress.forEach(match => {
            html += renderMatchCard(match);
        });
        html += '</div>';
    }
    
    // Completed matches
    if (completed.length > 0) {
        html += `<h4 class="mt-4">✅ Completed (${completed.length})</h4>`;
        html += '<div class="row g-3">';
        completed.forEach(match => {
            html += renderMatchCard(match);
        });
        html += '</div>';
    }
    
    // REPECHAGE SECTION
    if (repechageMatches.length > 0) {
        html += '<hr class="my-5">';
        html += '<h3 class="mt-4 mb-3"><i class="fas fa-medal"></i> Repechage & Bronze Medals</h3>';
        
        // Repechage pending
        if (repechagePending.length > 0) {
            html += `<h4 class="mt-4">⏳ Pending Repechage (${repechagePending.length})</h4>`;
            html += '<div class="row g-3">';
            repechagePending.forEach(match => {
                html += renderMatchCard(match);
            });
            html += '</div>';
        }
        
        // Repechage in progress
        if (repechageInProgress.length > 0) {
            html += `<h4 class="mt-4">▶️ In Progress (${repechageInProgress.length})</h4>`;
            html += '<div class="row g-3">';
            repechageInProgress.forEach(match => {
                html += renderMatchCard(match);
            });
            html += '</div>';
        }
        
        // Repechage completed
        if (repechageCompleted.length > 0) {
            html += `<h4 class="mt-4">✅ Completed (${repechageCompleted.length})</h4>`;
            html += '<div class="row g-3">';
            repechageCompleted.forEach(match => {
                html += renderMatchCard(match);
            });
            html += '</div>';
        }
    }
    
    console.log('📝 Final HTML length:', html.length);
    console.log('📝 Setting innerHTML to container...');
    container.innerHTML = html;
    console.log('✅ innerHTML set successfully');
}

/**
 * Render match card
 */
function renderMatchCard(match) {
    const isOwnedByThisDevice = match.deviceId === window.DEVICE_ID;
    const isLocked = match.status === 'locked' || match.status === 'in_progress';
    
    // Handle both old draw format and new match manager format
    const isCompleted = match.completed === true || match.status === 'completed';
    const status = isCompleted ? 'completed' : (match.status || 'pending');
    const canLock = status === 'pending' && !isCompleted;
    
    // Get fighter names - support both old and new format
    const fighterAName = match.fighterA?.fullName || match.fighterA?.name || match.playerAName || 'TBD';
    const fighterBName = match.fighterB?.fullName || match.fighterB?.name || match.playerBName || 'TBD';
    const fighterATeam = match.fighterA?.team || match.playerAClub || 'N/A';
    const fighterBTeam = match.fighterB?.team || match.playerBClub || 'N/A';
    
    // Get match details
    const weight = match.weight || match.weightCategory || 'N/A';
    const gender = match.gender || 'N/A';
    const matchNumber = match.matchNumber || match.round || '?';
    
    let statusBadge = '';
    let actionButtons = '';
    
    // Match type badge
    let matchTypeBadge = '';
    if (match.matchType === 'final') {
        matchTypeBadge = '<span class="badge bg-danger me-1">🏆 FINAL</span>';
    } else if (match.matchType === 'bronze') {
        matchTypeBadge = '<span class="badge bg-warning me-1">🥉 BRONZE</span>';
    } else if (match.matchType === 'repechage') {
        matchTypeBadge = '<span class="badge bg-info me-1">🔄 REPECHAGE</span>';
    }
    
    // Status badge
    switch(status) {
        case 'pending':
            statusBadge = '<span class="badge bg-secondary">Pending</span>';
            break;
        case 'locked':
            statusBadge = `<span class="badge bg-warning">🔒 Locked by ${match.deviceName}</span>`;
            break;
        case 'in_progress':
            statusBadge = `<span class="badge bg-primary">▶️ In Progress on ${match.deviceName}</span>`;
            break;
        case 'completed':
            statusBadge = `<span class="badge bg-success">✅ Completed</span>`;
            break;
    }
    
    // Winner display for completed matches
    let winnerDisplay = '';
    if (isCompleted && match.winner) {
        const winnerName = match.winner === match.playerA ? fighterAName : fighterBName;
        winnerDisplay = `<div class="alert alert-success mt-2 mb-0 py-2"><strong>🏆 Winner:</strong> ${winnerName}</div>`;
    }
    
    // Action buttons - only show for matches with actual players and not completed
    const hasPlayers = fighterAName !== 'TBD' && fighterBName !== 'TBD' && 
                       fighterAName !== 'Winner of match' && fighterBName !== 'Winner of match';
    
    if (canLock && hasPlayers && !isCompleted) {
        actionButtons = `
            <button class="btn btn-sm btn-primary" onclick="lockAndStartMatch('${match.id}')">
                <i class="fas fa-lock"></i> Lock & Start
            </button>
        `;
    } else if (isOwnedByThisDevice && status === 'locked') {
        actionButtons = `
            <button class="btn btn-sm btn-success" onclick="startMatch('${match.id}')">
                <i class="fas fa-play"></i> Start Match
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="unlockMatch('${match.id}')">
                <i class="fas fa-unlock"></i> Unlock
            </button>
        `;
    } else if (isOwnedByThisDevice && status === 'in_progress') {
        actionButtons = `
            <button class="btn btn-sm btn-info" onclick="openMatchScoreboard('${match.id}')">
                <i class="fas fa-external-link-alt"></i> Open Scoreboard
            </button>
        `;
    }
    
    return `
        <div class="col-md-6 col-lg-3">
            <div class="card ${isOwnedByThisDevice ? 'border-primary' : ''} ${isCompleted ? 'opacity-75' : ''}">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h6 class="card-title mb-0">
                            ${matchTypeBadge}
                            Match #${matchNumber} ${match.round ? `(Round ${match.round})` : ''}
                        </h6>
                        ${statusBadge}
                    </div>
                    <p class="text-muted small mb-2">
                        ${weight} ${gender !== 'N/A' ? `• ${gender}` : ''} ${match.mat ? `• Mat ${match.mat}` : ''}
                    </p>
                    <div class="match-fighters">
                        <div class="fighter mb-2">
                            <strong>🥋 ${fighterAName}</strong>
                            <br><small class="text-muted">${fighterATeam}</small>
                        </div>
                        <div class="text-center my-2"><strong>VS</strong></div>
                        <div class="fighter mb-3">
                            <strong>🥋 ${fighterBName}</strong>
                            <br><small class="text-muted">${fighterBTeam}</small>
                        </div>
                    </div>
                    ${winnerDisplay}
                    ${actionButtons}
                </div>
            </div>
        </div>
    `;
}

/**
 * Render devices in modal
 */
function renderDevicesModal(devices) {
    const container = document.getElementById('devicesModalContainer');
    if (!container) return;
    
    const onlineDevices = devices.filter(d => d.status === 'online');
    const offlineDevices = devices.filter(d => d.status === 'offline');
    
    let html = '';
    
    // Online devices section
    html += `
        <div class="mb-4">
            <h5 class="mb-3">
                <i class="fas fa-circle text-success" style="font-size: 0.8em;"></i> 
                Online Devices <span class="badge bg-success">${onlineDevices.length}</span>
            </h5>
    `;
    
    if (onlineDevices.length === 0) {
        html += '<div class="alert alert-info"><i class="fas fa-info-circle me-2"></i>No devices currently online</div>';
    } else {
        html += '<div class="list-group">';
        onlineDevices.forEach(device => {
            const isThisDevice = device.deviceId === window.DEVICE_ID;
            const lastSeen = device.lastSeen ? new Date(device.lastSeen).toLocaleTimeString() : 'Unknown';
            
            html += `
                <div class="list-group-item ${isThisDevice ? 'list-group-item-success' : ''}">
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="flex-grow-1">
                            <div class="d-flex align-items-center mb-1">
                                <i class="fas fa-desktop text-success me-2"></i>
                                <strong style="font-size: 1.1em;">${device.deviceName}</strong>
                                ${isThisDevice ? '<span class="badge bg-primary ms-2">This Device</span>' : ''}
                            </div>
                            <div class="text-muted" style="font-size: 0.9em;">
                                <i class="fas fa-clock me-1"></i> Last seen: ${lastSeen}
                            </div>
                            ${device.currentMatch ? `
                                <div class="text-info mt-1" style="font-size: 0.9em;">
                                    <i class="fas fa-trophy me-1"></i> Currently managing a match
                                </div>
                            ` : ''}
                        </div>
                        <div class="d-flex align-items-center gap-2">
                            <span class="badge bg-success" style="font-size: 1em; padding: 0.5em 1em;">
                                <i class="fas fa-check-circle"></i> Online
                            </span>
                            <button class="btn btn-sm btn-danger" onclick="deleteDevice('${device.deviceId}', '${device.deviceName}')" title="Delete Device">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
    }
    
    html += '</div>';
    
    // Offline devices section
    if (offlineDevices.length > 0) {
        html += `
            <div>
                <h5 class="mb-3">
                    <i class="fas fa-circle text-secondary" style="font-size: 0.8em;"></i> 
                    Offline Devices <span class="badge bg-secondary">${offlineDevices.length}</span>
                </h5>
                <div class="list-group">
        `;
        
        offlineDevices.forEach(device => {
            const lastSeen = device.lastSeen ? new Date(device.lastSeen).toLocaleTimeString() : 'Unknown';
            html += `
                <div class="list-group-item list-group-item-light">
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="flex-grow-1">
                            <div class="d-flex align-items-center mb-1">
                                <i class="fas fa-desktop text-secondary me-2"></i>
                                <strong style="font-size: 1.1em; color: #6c757d;">${device.deviceName}</strong>
                            </div>
                            <div class="text-muted" style="font-size: 0.9em;">
                                <i class="fas fa-clock me-1"></i> Last seen: ${lastSeen}
                            </div>
                        </div>
                        <div class="d-flex align-items-center gap-2">
                            <span class="badge bg-secondary" style="font-size: 1em; padding: 0.5em 1em;">
                                <i class="fas fa-times-circle"></i> Offline
                            </span>
                            <button class="btn btn-sm btn-danger" onclick="deleteDevice('${device.deviceId}', '${device.deviceName}')" title="Delete Device">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div></div>';
    }
    
    container.innerHTML = html;
}

/**
 * Lock and start match
 */
async function lockAndStartMatch(matchId) {
    try {
        console.log('🎯 lockAndStartMatch called with matchId:', matchId);
        console.log('🎯 matchId type:', typeof matchId);
        
        // Prompt for mat number
        const matNumber = prompt('Enter Mat Number:', '1');
        if (!matNumber) return;
        
        // Lock the match
        console.log('🔒 Calling matchManager.lockMatch...');
        await matchManager.lockMatch(matchId);
        
        // Start the match
        console.log('▶️ Calling matchManager.startMatch...');
        await matchManager.startMatch(matchId, matNumber);
        
        alert('Match started! Scoreboard opened in new window.');
        
    } catch (error) {
        console.error('Error:', error);
        alert('Error: ' + error.message);
    }
}

/**
 * Start match (already locked)
 */
async function startMatch(matchId) {
    try {
        const matNumber = prompt('Enter Mat Number:', '1');
        if (!matNumber) return;
        
        await matchManager.startMatch(matchId, matNumber);
        alert('Match started! Scoreboard opened in new window.');
        
    } catch (error) {
        console.error('Error:', error);
        alert('Error: ' + error.message);
    }
}

/**
 * Unlock match
 */
async function unlockMatch(matchId) {
    if (!confirm('Are you sure you want to unlock this match?')) return;
    
    try {
        await matchManager.unlockMatch(matchId);
        alert('Match unlocked successfully');
        
    } catch (error) {
        console.error('Error:', error);
        alert('Error: ' + error.message);
    }
}

/**
 * Open match scoreboard
 */
function openMatchScoreboard(matchId) {
    matchManager.openScoreboard(matchId);
}

/**
 * Delete device
 */
async function deleteDevice(deviceId, deviceName) {
    if (!confirm(`Are you sure you want to delete device "${deviceName}"?\n\nThis action cannot be undone.`)) {
        return;
    }
    
    try {
        // Delete device from Firebase
        const deviceRef = firebase.database().ref(`tournament/devices/${deviceId}`);
        await deviceRef.remove();
        
        console.log(`✅ Device deleted: ${deviceName} (${deviceId})`);
        
        // Refresh the devices list
        const devices = await matchManager.getDevices();
        renderDevicesModal(devices);
        
        // Show success message
//        alert(`Device "${deviceName}" has been deleted successfully.`);
        
    } catch (error) {
        console.error('❌ Error deleting device:', error);
        alert('Error deleting device. Please try again.');
    }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (matchManager) {
            matchManager.cleanup();
        }
    });
}

// Export functions to global scope
window.saveDeviceName = saveDeviceName;
window.changeDeviceName = changeDeviceName;
window.lockAndStartMatch = lockAndStartMatch;
window.startMatch = startMatch;
window.unlockMatch = unlockMatch;
window.openMatchScoreboard = openMatchScoreboard;
window.showDevicesModal = showDevicesModal;
window.closeDevicesModal = closeDevicesModal;
window.deleteDevice = deleteDevice;
window.renderMatches = renderMatches;
