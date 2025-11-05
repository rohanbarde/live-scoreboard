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

// Listen for updates from Firebase
updateStatus('Setting up Firebase listener...');
try {
    const matchRef = database.ref('current_match');

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
            document.getElementById('scoreA').textContent = fighterA.score || 0;
        }

        // Update Fighter B
        if (data.fighterB) {
            const fighterB = data.fighterB;
            document.getElementById('fighterBName').textContent = fighterB.name || 'Fighter B';
            document.getElementById('fighterBClub').textContent = fighterB.club || 'Team B';
            document.getElementById('scoreB').textContent = fighterB.score || 0;
        }

        // Update timer if available
        if (data.timer) {
            document.getElementById('timerDisplay').textContent = data.timer;
        }

        // Update match info if available
        if (data.matchInfo) {
            document.getElementById('matchInfo').textContent = data.matchInfo;
        }

        // Update weight category if available
        if (data.weightCategory) {
            document.getElementById('weightCategory').textContent = data.weightCategory;
        }

        // Update weight category if available
        if (data.fighterA?.weight) {
            document.getElementById('weightCategory').textContent = data.fighterA.weight;
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