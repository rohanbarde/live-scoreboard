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
                    <small class="text-muted mt-2 d-block">Device ID: ${DEVICE_ID}</small>
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
    
    // Load devices
    loadDevices();
    
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
            <div class="alert alert-info">
                <strong>📱 This Device:</strong> ${deviceInfo.deviceName}
                <button class="btn btn-sm btn-outline-primary ms-2" onclick="changeDeviceName()">
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
    const newName = prompt('Enter new device name:', DEVICE_NAME);
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
    matchManager.onMatchesUpdate(matches => {
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
        renderDevices(devices);
    }, 5000);
}

/**
 * Render matches
 */
function renderMatches(matches) {
    const container = document.getElementById('matchesContainer');
    if (!container) return;
    
    if (matches.length === 0) {
        container.innerHTML = `
            <div class="alert alert-warning">
                <i class="fas fa-info-circle"></i> No matches available. 
                <a href="/views/generate-draws.html" class="alert-link">Generate draws first</a>
            </div>
        `;
        return;
    }
    
    // Group matches by status
    const pending = matches.filter(m => m.status === 'pending');
    const locked = matches.filter(m => m.status === 'locked');
    const inProgress = matches.filter(m => m.status === 'in_progress');
    const completed = matches.filter(m => m.status === 'completed');
    
    let html = '';
    
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
    
    container.innerHTML = html;
}

/**
 * Render match card
 */
function renderMatchCard(match) {
    const isOwnedByThisDevice = match.deviceId === DEVICE_ID;
    const isLocked = match.status === 'locked' || match.status === 'in_progress';
    const canLock = match.status === 'pending';
    
    let statusBadge = '';
    let actionButtons = '';
    
    // Status badge
    switch(match.status) {
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
    
    // Action buttons
    if (canLock) {
        actionButtons = `
            <button class="btn btn-sm btn-primary" onclick="lockAndStartMatch('${match.id}')">
                <i class="fas fa-lock"></i> Lock & Start
            </button>
        `;
    } else if (isOwnedByThisDevice && match.status === 'locked') {
        actionButtons = `
            <button class="btn btn-sm btn-success" onclick="startMatch('${match.id}')">
                <i class="fas fa-play"></i> Start Match
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="unlockMatch('${match.id}')">
                <i class="fas fa-unlock"></i> Unlock
            </button>
        `;
    } else if (isOwnedByThisDevice && match.status === 'in_progress') {
        actionButtons = `
            <button class="btn btn-sm btn-info" onclick="openMatchScoreboard('${match.id}')">
                <i class="fas fa-external-link-alt"></i> Open Scoreboard
            </button>
        `;
    }
    
    return `
        <div class="col-md-6 col-lg-4">
            <div class="card ${isOwnedByThisDevice ? 'border-primary' : ''}">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h6 class="card-title mb-0">Match #${match.matchNumber}</h6>
                        ${statusBadge}
                    </div>
                    <p class="text-muted small mb-2">
                        ${match.weight} • ${match.gender} ${match.mat ? `• Mat ${match.mat}` : ''}
                    </p>
                    <div class="match-fighters">
                        <div class="fighter mb-2">
                            <strong>🥋 ${match.fighterA.fullName || match.fighterA.name}</strong>
                            <br><small class="text-muted">${match.fighterA.team || 'N/A'}</small>
                        </div>
                        <div class="text-center my-2"><strong>VS</strong></div>
                        <div class="fighter mb-3">
                            <strong>🥋 ${match.fighterB.fullName || match.fighterB.name}</strong>
                            <br><small class="text-muted">${match.fighterB.team || 'N/A'}</small>
                        </div>
                    </div>
                    ${actionButtons}
                </div>
            </div>
        </div>
    `;
}

/**
 * Render devices
 */
function renderDevices(devices) {
    const container = document.getElementById('devicesContainer');
    if (!container) return;
    
    const onlineDevices = devices.filter(d => d.status === 'online');
    const offlineDevices = devices.filter(d => d.status === 'offline');
    
    let html = `<h5>📱 Online Devices (${onlineDevices.length})</h5><div class="list-group mb-3">`;
    
    onlineDevices.forEach(device => {
        const isThisDevice = device.deviceId === DEVICE_ID;
        const lastSeen = device.lastSeen ? new Date(device.lastSeen).toLocaleTimeString() : 'Unknown';
        
        html += `
            <div class="list-group-item ${isThisDevice ? 'list-group-item-primary' : ''}">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${device.deviceName}</strong> ${isThisDevice ? '(This Device)' : ''}
                        <br><small class="text-muted">Last seen: ${lastSeen}</small>
                        ${device.currentMatch ? `<br><small class="text-info">Currently managing a match</small>` : ''}
                    </div>
                    <span class="badge bg-success">Online</span>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    
    if (offlineDevices.length > 0) {
        html += `<h6 class="text-muted">Offline Devices (${offlineDevices.length})</h6><div class="list-group">`;
        offlineDevices.forEach(device => {
            const lastSeen = device.lastSeen ? new Date(device.lastSeen).toLocaleTimeString() : 'Unknown';
            html += `
                <div class="list-group-item list-group-item-secondary">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <strong>${device.deviceName}</strong>
                            <br><small class="text-muted">Last seen: ${lastSeen}</small>
                        </div>
                        <span class="badge bg-secondary">Offline</span>
                    </div>
                </div>
            `;
        });
        html += '</div>';
    }
    
    container.innerHTML = html;
}

/**
 * Lock and start match
 */
async function lockAndStartMatch(matchId) {
    try {
        // Prompt for mat number
        const matNumber = prompt('Enter Mat Number:', '1');
        if (!matNumber) return;
        
        // Lock the match
        await matchManager.lockMatch(matchId);
        
        // Start the match
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
