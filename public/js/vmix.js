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

// Cache for player district data
const districtCache = {};

// Map district names to flag image files (with multiple variations)
const districtFlagMap = {
    // Akola variations
    'akola': 'Akola.jpg',
    'akola district': 'Akola.jpg',
    'akola judo': 'Akola.jpg',
    
    // Amaravati variations
    'amaravati': 'Amaravati.jpg',
    'amravati': 'Amaravati.jpg',
    'amaravati district': 'Amaravati.jpg',
    'amravati district': 'Amaravati.jpg',
    
    // Ch.Sambhajinagar (Aurangabad) variations
    'ch.sambhajinagar': 'Ch.Sambhajinagar.jpg',
    'ch sambhajinagar': 'Ch.Sambhajinagar.jpg',
    'sambhajinagar': 'Ch.Sambhajinagar.jpg',
    'aurangabad': 'Ch.Sambhajinagar.jpg',
    'aurangabad district': 'Ch.Sambhajinagar.jpg',
    
    // Dhule variations
    'dhule': 'Dhule.jpg',
    'dhule district': 'Dhule.jpg',
    'dhule judo': 'Dhule.jpg',
    
    // Gondia variations
    'gondia': 'Gondia.jpg',
    'gondia district': 'Gondia.jpg',
    'gondia judo': 'Gondia.jpg',
    
    // Jalgaon variations
    'jalgaon': 'Jalgaon.jpg',
    'jalgaon district': 'Jalgaon.jpg',
    'jalgaon judo': 'Jalgaon.jpg',
    
    // Kolhapur variations
    'kolhapur': 'Kolhapur.png',
    'kolhapur district': 'Kolhapur.png',
    'kolhapur judo': 'Kolhapur.png',
    
    // Latur variations
    'latur': 'Latur.jpg',
    'latur district': 'Latur.jpg',
    'latur judo': 'Latur.jpg',
    
    // Mumbai variations
    'mumbai': 'Mumbai.jpg',
    'mumbai district': 'Mumbai.jpg',
    'mumbai judo': 'Mumbai.jpg',
    'mumbai city': 'Mumbai.jpg',
    'greater mumbai': 'Mumbai.jpg',
    
    // Nagpur variations
    'nagpur': 'Nagpur.jpg',
    'nagpur district': 'Nagpur.jpg',
    'nagpur judo': 'Nagpur.jpg',
    'nagpur city': 'Nagpur.jpg',
    
    // Nanded variations
    'nanded': 'Nanded.jpg',
    'nanded district': 'Nanded.jpg',
    'nanded judo': 'Nanded.jpg',
    
    // Nandurbar variations
    'nandurbar': 'Nandurbar.jpg',
    'nandurbar district': 'Nandurbar.jpg',
    'nandurbar judo': 'Nandurbar.jpg',
    
    // Nashik variations
    'nashik': 'Nashik.jpg',
    'nashik district': 'Nashik.jpg',
    'nashik judo': 'Nashik.jpg',
    'nasik': 'Nashik.jpg',
    
    // Sangli variations
    'sangli': 'Sangli.jpg',
    'sangli district': 'Sangli.jpg',
    'sangli judo': 'Sangli.jpg',
    
    // Satara variations
    'satara': 'Satara.jpg',
    'satara district': 'Satara.jpg',
    'satara judo': 'Satara.jpg',
    
    // Sindhudurg variations
    'sindhudurg': 'Sindhudurg.jpg',
    'sindhudurg district': 'Sindhudurg.jpg',
    'sindhudurg judo': 'Sindhudurg.jpg',
    
    // Solapur variations
    'solapur': 'Solapur.jpg',
    'solapur district': 'Solapur.jpg',
    'solapur judo': 'Solapur.jpg',
    'sholapur': 'Solapur.jpg',
    
    // Thane variations
    'thane': 'Thane.jpg',
    'thane district': 'Thane.jpg',
    'thane judo': 'Thane.jpg',
    'thane city': 'Thane.jpg',
    
    // Yeotmal/Yavatmal variations
    'yeotmal': 'Yeotmal.jpg',
    'yavatmal': 'Yeotmal.jpg',
    'yeotmal district': 'Yeotmal.jpg',
    'yavatmal district': 'Yeotmal.jpg',
    'yeotmal judo': 'Yeotmal.jpg',
    'yavatmal judo': 'Yeotmal.jpg',
    
    // Special organizations
    'pdja': 'PDJA.jpg',
    'pune district judo association': 'PDJA.jpg',
    'pune district': 'PDJA.jpg',
    'pune': 'PDJA.jpg',
    
    'krida prabhodhini': 'Krida Prabhodhini.jpg',
    'krida': 'Krida Prabhodhini.jpg',
    
    'maharashtra': 'Maharashtra.png',
    'maharashtra judo': 'Maharashtra.png'
};

// Preload all player photos and district data into cache on page load
function preloadAllPhotos() {
    if (photoCacheInitialized) return;
    photoCacheInitialized = true;
    
    console.log('🖼️ Preloading all player photos and district data...');
    
    database.ref('registrations').orderByChild('userType').equalTo('player').once('value')
        .then(snapshot => {
            let loadedCount = 0;
            const uniqueTeams = new Set();
            
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
                // Cache district/team data
                const playerName = playerData.fullName || `${playerData.firstName || ''} ${playerData.lastName || ''}`.trim();
                if (playerName) {
                    districtCache[playerName] = {
                        team: playerData.team || '',
                        district: playerData.team || '' // team field contains district name
                    };
                    
                    // Collect unique team names for debugging
                    if (playerData.team && playerData.team.trim()) {
                        uniqueTeams.add(playerData.team.trim());
                    }
                }
            });
            
            console.log(`✓ Preloaded ${loadedCount} player photos and district data into cache`);
            
            // Log all unique team names found in database
            if (uniqueTeams.size > 0) {
                console.log('📋 Unique team/district names in database:');
                Array.from(uniqueTeams).sort().forEach(team => {
                    const normalized = team.toLowerCase().trim();
                    const hasMatch = districtFlagMap[normalized] !== undefined;
                    const matchIcon = hasMatch ? '✓' : '⚠️';
                    console.log(`  ${matchIcon} "${team}" (normalized: "${normalized}")`);
                });
            } else {
                console.warn('⚠️ No team/district data found in any player registrations!');
            }
        })
        .catch(error => {
            console.error('Error preloading photos:', error);
        });
}

// Function to get district flag path from team/district name
function getDistrictFlagPath(teamName) {
    // Default fallback to Maharashtra flag
    const defaultFlag = '/public/assets/Maharashtra.png';
    
    if (!teamName) {
        console.log('⚠️ No team name provided, using Maharashtra flag');
        return defaultFlag;
    }
    
    const normalizedTeam = teamName.toLowerCase().trim();
    console.log(`🔍 Looking for flag for team: "${teamName}" (normalized: "${normalizedTeam}")`);
    
    const flagFile = districtFlagMap[normalizedTeam];
    
    if (flagFile) {
        console.log(`✓ Exact match found: ${flagFile}`);
        return `/public/assets/${flagFile}`;
    }
    
    // Try partial match
    for (const [key, file] of Object.entries(districtFlagMap)) {
        if (normalizedTeam.includes(key) || key.includes(normalizedTeam)) {
            console.log(`✓ Partial match found: "${key}" → ${file}`);
            return `/public/assets/${file}`;
        }
    }
    
    // Return Maharashtra flag as fallback
    console.log(`⚠️ No match found for "${teamName}", using Maharashtra flag`);
    return defaultFlag;
}

// Function to load player photo and district flag from Firebase with caching
function loadPlayerPhoto(playerName, side, skipFlagUpdate = false) {
    const photoImg = document.getElementById(`photo${side}`);
    const flagImg = document.getElementById(`flag${side}`);
    
    if (!photoImg || !playerName) {
        console.log(`No photo element or player name for side ${side}`);
        return;
    }
    
    // Check cache first for photo
    if (photoCache[playerName]) {
        photoImg.src = photoCache[playerName];
        console.log(`✓ Photo loaded from cache for ${playerName}`);
        
        // If we should skip flag update (already set from match data) and photo is cached, return early
        if (skipFlagUpdate) {
            console.log(`⏭️ Skipping flag update for ${playerName} (already set from match data)`);
            return;
        }
    }
    
    // Only update flag if not skipping and we have cached data
    if (!skipFlagUpdate && flagImg && districtCache[playerName]) {
        const flagPath = getDistrictFlagPath(districtCache[playerName].district);
        flagImg.src = flagPath;
        flagImg.style.width = '3vw';
        flagImg.style.height = 'auto';
        flagImg.style.maxHeight = '2.5vw';
        flagImg.style.objectFit = 'contain';
        flagImg.style.borderRadius = '0.2vw';
        flagImg.style.boxShadow = '0 0.1vw 0.3vw rgba(0,0,0,0.3)';
        console.log(`✓ District flag loaded from cache for ${playerName}: ${districtCache[playerName].district || 'Maharashtra (default)'}`);
        
        // If we have cached photo, we can return early
        if (photoCache[playerName]) {
            return;
        }
    }
    
    console.log(`Loading photo and district data for ${playerName} on side ${side}`);
    
    // Query Firebase for player data using correct path and field
    database.ref('registrations').orderByChild('fullName').equalTo(playerName).once('value')
        .then(snapshot => {
            if (snapshot.exists()) {
                snapshot.forEach(childSnapshot => {
                    const playerData = childSnapshot.val();
                    
                    // Load photo
                    if (playerData.photoBase64 && playerData.photoBase64.length > 50) {
                        const photoSrc = `data:image/png;base64,${playerData.photoBase64}`;
                        photoImg.src = photoSrc;
                        // Cache the photo
                        photoCache[playerName] = photoSrc;
                        console.log(`✓ Photo loaded successfully for ${playerName}`);
                    } else {
                        console.warn(`Player ${playerName} has no photoBase64 data`);
                    }
                    
                    // Load district flag only if not skipping (not already set from match data)
                    if (!skipFlagUpdate && flagImg) {
                        const flagPath = getDistrictFlagPath(playerData.team || '');
                        flagImg.src = flagPath;
                        flagImg.style.width = '3vw';
                        flagImg.style.height = 'auto';
                        flagImg.style.maxHeight = '2.5vw';
                        flagImg.style.objectFit = 'contain';
                        flagImg.style.borderRadius = '0.2vw';
                        flagImg.style.boxShadow = '0 0.1vw 0.3vw rgba(0,0,0,0.3)';
                        console.log(`✓ District flag loaded from database for ${playerName}: ${playerData.team || 'Maharashtra (default)'}`);
                        
                        // Cache district data
                        districtCache[playerName] = {
                            team: playerData.team || '',
                            district: playerData.team || ''
                        };
                    } else if (skipFlagUpdate) {
                        console.log(`⏭️ Skipping flag update from database for ${playerName} (already set from match data)`);
                        
                        // Still cache the district data for future reference (but don't overwrite existing cache)
                        if (!districtCache[playerName]) {
                            districtCache[playerName] = {
                                team: playerData.team || '',
                                district: playerData.team || ''
                            };
                        }
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
            
            // Update district flag if club/team data is available
            if (fighterA.club) {
                const flagImg = document.getElementById('flagA');
                if (flagImg) {
                    const flagPath = getDistrictFlagPath(fighterA.club);
                    flagImg.src = flagPath;
                    console.log(`✓ Fighter A flag updated from Firebase match data: ${fighterA.club}`);
                    
                    // Cache this team data to prevent loadPlayerPhoto from overwriting
                    if (fighterA.name) {
                        districtCache[fighterA.name] = {
                            team: fighterA.club,
                            district: fighterA.club
                        };
                    }
                }
            }
            
            // Load player photo (will skip flag update since we already set it)
            if (fighterA.name) {
                loadPlayerPhoto(fighterA.name, 'A', true); // Pass true to skip flag update
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
            
            // Update district flag if club/team data is available
            if (fighterB.club) {
                const flagImg = document.getElementById('flagB');
                if (flagImg) {
                    const flagPath = getDistrictFlagPath(fighterB.club);
                    flagImg.src = flagPath;
                    console.log(`✓ Fighter B flag updated from Firebase match data: ${fighterB.club}`);
                    
                    // Cache this team data to prevent loadPlayerPhoto from overwriting
                    if (fighterB.name) {
                        districtCache[fighterB.name] = {
                            team: fighterB.club,
                            district: fighterB.club
                        };
                    }
                }
            }
            
            // Load player photo (will skip flag update since we already set it)
            if (fighterB.name) {
                loadPlayerPhoto(fighterB.name, 'B', true); // Pass true to skip flag update
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
            const weight = (data.weightCategory && data.weightCategory.trim() !== '') 
                ? data.weightCategory.trim() 
                : ((data.fighterA?.weight && data.fighterA.weight.trim() !== '') ? data.fighterA.weight.trim() : '');
            const mat = (data.matNumber && data.matNumber.trim() !== '') ? ` • Mat ${data.matNumber.trim()}` : '';
            
            // Only show if we have actual data
            if (weight || mat) {
                weightCategoryEl.textContent = weight + mat;
            } else {
                weightCategoryEl.textContent = '';
            }
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