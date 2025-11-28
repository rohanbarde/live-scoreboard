// Firebase configuration - must match your main scoreboard
const firebaseConfig = {
    apiKey: "AIzaSyDTANQqo4uFuur5WzpeSgTBz3qUwnpx9_c",
    authDomain: "maha-judo-scorecard.firebaseapp.com",
    databaseURL: "https://maha-judo-scorecard-default-rtdb.firebaseio.com",
    projectId: "maha-judo-scorecard",
    storageBucket: "maha-judo-scorecard.firebasestorage.app",
    messagingSenderId: "802933098247",
    appId: "1:802933098247:web:6a651753eb6743e01fe7a2",
    measurementId: "G-KDLM8D3ZE1"
};

// Debug function to update UI
function updateStatus(message, isError = false) {
    console.log(message);
    if (typeof window.updateDebugInfo === 'function') {
        window.updateDebugInfo(message);
    }
    
    if (isError) {
        console.error(message);
    }
}

// Initialize Firebase if not already initialized
updateStatus('Checking Firebase initialization...');
try {
    if (!firebase.apps.length) {
        updateStatus('Initializing Firebase...');
        firebase.initializeApp(firebaseConfig);
        updateStatus('Firebase initialized successfully');
    } else {
        updateStatus('Using existing Firebase instance');
    }
} catch (error) {
    updateStatus(`Firebase init error: ${error.message}`, true);
    throw error;
}

// Get database reference
let database;
try {
    database = firebase.database();
    updateStatus('Firebase database reference created');
} catch (error) {
    updateStatus(`Database error: ${error.message}`, true);
    throw error;
}

// Monitor connection state
const connectedRef = database.ref(".info/connected");
connectedRef.on("value", function(snap) {
    const status = snap.val() === true ? 'Connected to Firebase' : 'Disconnected from Firebase';
    updateStatus(status);
});

// Cache for player photos to avoid repeated Firebase queries
const photoCache = {};
let photoCacheInitialized = false;

// Preload all player photos into cache on page load
function preloadAllPhotos() {
    if (photoCacheInitialized) return;
    photoCacheInitialized = true;
    
    console.log('🖼️ Preloading all player photos...');
    
    database.ref('registrations').orderByChild('userType').equalTo('player').once('value')
        .then(snapshot => {
            let loadedCount = 0;
            snapshot.forEach(childSnapshot => {
                const playerData = childSnapshot.val();
                if (playerData.photoBase64 && playerData.photoBase64.length > 50) {
                    const photoSrc = `data:image/png;base64,${playerData.photoBase64}`;
                    // Cache by fullName
                    if (playerData.fullName) {
                        photoCache[playerData.fullName] = photoSrc;
                        loadedCount++;
                    }
                    // Also cache by firstName + lastName for new format
                    if (playerData.firstName && playerData.lastName) {
                        const displayName = `${playerData.firstName} ${playerData.lastName}`;
                        photoCache[displayName] = photoSrc;
                    }
                }
            });
            console.log(`✓ Preloaded ${loadedCount} player photos into cache`);
        })
        .catch(error => {
            console.error('Error preloading photos:', error);
        });
}

// Function to load player photo from Firebase with caching
function loadPlayerPhoto(playerName, side) {
    const photoImg = document.getElementById(`photo${side}`);
    
    if (!photoImg || !playerName) {
        console.log(`No photo element or player name for side ${side}`);
        return;
    }
    
    // Check cache first
    if (photoCache[playerName]) {
        photoImg.src = photoCache[playerName];
        console.log(`✓ Photo loaded from cache for ${playerName}`);
        return;
    }
    
    console.log(`Loading photo for ${playerName} on side ${side}`);
    
    // Query Firebase for player data using correct path and field
    database.ref('registrations').orderByChild('fullName').equalTo(playerName).once('value')
        .then(snapshot => {
            if (snapshot.exists()) {
                snapshot.forEach(childSnapshot => {
                    const playerData = childSnapshot.val();
                    if (playerData.photoBase64 && playerData.photoBase64.length > 50) {
                        const photoSrc = `data:image/png;base64,${playerData.photoBase64}`;
                        photoImg.src = photoSrc;
                        // Cache the photo
                        photoCache[playerName] = photoSrc;
                        console.log(`✓ Photo loaded successfully for ${playerName}`);
                    } else {
                        console.warn(`Player ${playerName} has no photoBase64 data`);
                    }
                });
            } else {
                console.warn(`Player not found in database: ${playerName}`);
            }
        })
        .catch(error => {
            console.error(`Error loading photo for ${playerName}:`, error);
        });
}

// Initialize photo preloading when Firebase is ready
setTimeout(() => {
    preloadAllPhotos();
}, 1500);

// Get matchId from URL parameters
const urlParams = new URLSearchParams(window.location.search);
const matchId = urlParams.get('matchId');

if (!matchId) {
    updateStatus('⚠️ No matchId in URL - vMix will not display match data', true);
    console.warn('vMix opened without matchId parameter. URL should include ?matchId=...');
}

// Listen for updates from Firebase
updateStatus('Setting up Firebase listener...');
try {
    // Use match-specific path if matchId is available, otherwise fall back to current_match
    const firebasePath = matchId ? `matches/${matchId}/scoreData` : 'current_match';
    const matchRef = database.ref(firebasePath);
    
    updateStatus(`Listening to: ${firebasePath}`);
    console.log(`🎯 vMix listening to Firebase path: ${firebasePath}`);

    matchRef.on('value', (snapshot) => {
        updateStatus('Received update from Firebase');
        const data = snapshot.val();

        if (!data) {
            updateStatus('No data received from Firebase');
            return;
        }

        console.log('Received update from Firebase:', data);

        // Update Fighter A
        if (data.fighterA) {
            const fighterA = data.fighterA;
            document.getElementById('fighterAName').textContent = fighterA.name || 'Fighter A';
            document.getElementById('fighterAClub').textContent = fighterA.club || 'Team A';
            
            // Load player photo
            if (fighterA.name) {
                loadPlayerPhoto(fighterA.name, 'A');
            }
            
            // Update score indicators
            if (fighterA.ippon !== undefined) document.getElementById('ipponA').textContent = fighterA.ippon || 0;
            if (fighterA.waza !== undefined) document.getElementById('wazaA').textContent = fighterA.waza || 0;
            if (fighterA.yuko !== undefined) document.getElementById('yukoA').textContent = fighterA.yuko || 0;
        }

        // Update Fighter B
        if (data.fighterB) {
            const fighterB = data.fighterB;
            document.getElementById('fighterBName').textContent = fighterB.name || 'Fighter B';
            document.getElementById('fighterBClub').textContent = fighterB.club || 'Team B';
            
            // Load player photo
            if (fighterB.name) {
                loadPlayerPhoto(fighterB.name, 'B');
            }
            
            // Update score indicators
            if (fighterB.ippon !== undefined) document.getElementById('ipponB').textContent = fighterB.ippon || 0;
            if (fighterB.waza !== undefined) document.getElementById('wazaB').textContent = fighterB.waza || 0;
            if (fighterB.yuko !== undefined) document.getElementById('yukoB').textContent = fighterB.yuko || 0;
        }

        // Update timer if available
        if (data.timer) {
            document.getElementById('timerDisplay').textContent = data.timer;
        }

        // Update match info if available
        if (data.matchInfo) {
            document.getElementById('matchInfo').textContent = data.matchInfo;
        }

        // Update weight category and mat number
        const weightCategoryEl = document.getElementById('weightCategory');
        if (weightCategoryEl) {
            // Priority: data.weightCategory > data.fighterA.weight
            const weight = data.weightCategory || data.fighterA?.weight || '';
            const mat = data.matNumber ? ` • Mat ${data.matNumber}` : '';
            weightCategoryEl.textContent = weight + mat;
        }
    }, (error) => {
        updateStatus(`Firebase read error: ${error.message}`, true);
    });

    updateStatus('Firebase listener active and waiting for updates...');
} catch (error) {
    updateStatus(`Error setting up Firebase listener: ${error.message}`, true);
}

    // Helper function to update shido indicators
    function updateShidoIndicators(side, count) {
        const container = document.getElementById(`shido${side}`);
        if (!container) return;

        const indicators = container.getElementsByClassName('shido-indicator');
        for (let i = 0; i < indicators.length; i++) {
            indicators[i].classList.toggle('active', i < count);
        }
    }

    // Auto-refresh the page every 30 minutes to prevent any potential memory leaks
    setInterval(() => {
        window.location.reload();
    }, 30 * 60 * 1000);