// vMix Card Rendering Functions
// This file extends the main vMix functionality to handle SHIDO penalty cards

// Function to render penalty cards in vMix
function renderVmixCards(containerId, shidoCount, hasRedCard = false) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.warn(`Container ${containerId} not found`);
        return;
    }
    
    // Clear existing cards
    container.innerHTML = '';
    
    // Check if fighter has a manual red card
    if (hasRedCard) {
        // Show red card for manual red card
        const el = document.createElement('div');
        el.className = 'vmix-card-pill red';
        el.textContent = '';
        container.appendChild(el);
        console.log(`Rendered manual red card in ${containerId}`);
    } else if (shidoCount === 0) {
        // Show "0" when no shidos
        const el = document.createElement('div');
        el.className = 'score-num';
        el.textContent = '0';
        el.style.fontSize = '5vw';
        el.style.fontWeight = '800';
        el.style.lineHeight = '1';
        el.style.margin = '0';
        el.style.padding = '0';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.color = 'inherit';
        container.appendChild(el);
        console.log(`Rendered 0 shido in ${containerId}`);
    } else if (shidoCount >= 3) {
        // Show red card for 3 or more shidos
        const el = document.createElement('div');
        el.className = 'vmix-card-pill red';
        el.textContent = '';
        container.appendChild(el);
        console.log(`Rendered red card (3+ shidos) in ${containerId}`);
    } else {
        // Show yellow cards for 1-2 shidos
        for (let i = 0; i < shidoCount; i++) {
            const el = document.createElement('div');
            el.className = 'vmix-card-pill yellow';
            el.textContent = '';
            container.appendChild(el);
        }
        console.log(`Rendered ${shidoCount} yellow cards in ${containerId}`);
    }
}

// Function to update osaekomi timer display in vMix
function updateVmixHoldTimer(holdTimerData) {
    const display = document.getElementById('holdTimerDisplay');
    const timeDisplay = document.getElementById('holdTimerTime');
    const playerDisplay = document.getElementById('holdTimerPlayer');
    
    if (!display || !timeDisplay || !playerDisplay) {
        console.warn('Osaekomi timer elements not found in vMix');
        return;
    }
    
    if (holdTimerData && holdTimerData.active) {
        display.style.display = 'block';
        const elapsedSeconds = holdTimerData.elapsedSec || 0;
        timeDisplay.textContent = elapsedSeconds;
        
        // Determine player info
        const playerColor = holdTimerData.player === 'A' ? 'White' : 'Blue';
        const holdType = holdTimerData.type === 'waza-ari' ? ' (Waza-ari)' : '';
        playerDisplay.textContent = `${playerColor}${holdType}`;
        
        // Update label based on type
        const labelElement = document.querySelector('.hold-timer-label');
        if (labelElement) {
            labelElement.textContent = holdTimerData.type === 'waza-ari' ? 'OSAEKOMI (W)' : 'OSAEKOMI';
        }
        
        // Apply color states based on elapsed time and type
        const warningThreshold = holdTimerData.type === 'waza-ari' ? 7 : 15; // 7s for waza-ari (10s total), 15s for normal (20s total)
        const cautionThreshold = holdTimerData.type === 'waza-ari' ? 5 : 10;  // 5s for waza-ari, 10s for normal
        
        // Remove existing state classes and reset styles
        display.classList.remove('warning', 'critical');
        timeDisplay.style.color = ''; // Reset to default
        
        if (elapsedSeconds >= warningThreshold) {
            display.classList.add('critical');
            timeDisplay.style.color = '#ff4444'; // Red for final seconds
        } else if (elapsedSeconds >= cautionThreshold) {
            display.classList.add('warning');
            timeDisplay.style.color = '#ffaa00'; // Orange for caution
        } else {
            timeDisplay.style.color = '#00ff00'; // Green for normal time
        }
        
        console.log(`Hold timer updated: ${elapsedSeconds}s elapsed, ${playerColor}, ${holdTimerData.type}`);
    } else {
        display.style.display = 'none';
        console.log('Hold timer hidden');
    }
}

// Enhanced Firebase listener that includes SHIDO data
function setupEnhancedFirebaseListener() {
    if (typeof database === 'undefined') {
        console.error('Firebase database not available');
        return;
    }
    
    // Get matchId from URL parameters (same as main vmix.js)
    const urlParams = new URLSearchParams(window.location.search);
    const matchId = urlParams.get('matchId');
    
    // Use match-specific path if matchId is available, otherwise fall back to current_match
    const firebasePath = matchId ? `matches/${matchId}/scoreData` : 'current_match';
    const matchRef = database.ref(firebasePath);
    
    console.log(`🎯 Enhanced vMix listening to: ${firebasePath}`);
    
    matchRef.on('value', (snapshot) => {
        const data = snapshot.val();
        
        if (!data) {
            console.log('No enhanced data received from Firebase');
            return;
        }
        
//        console.log('Enhanced Firebase update received:', data);
        
        // Update Fighter A SHIDO cards
        if (data.fighterA && data.fighterA.shido !== undefined) {
            const hasRedCardA = data.fighterA.redCard || false;
            renderVmixCards('shidoCardsA', data.fighterA.shido || 0, hasRedCardA);
        }
        
        // Update Fighter B SHIDO cards
        if (data.fighterB && data.fighterB.shido !== undefined) {
            const hasRedCardB = data.fighterB.redCard || false;
            renderVmixCards('shidoCardsB', data.fighterB.shido || 0, hasRedCardB);
        }
        
        // Update Hold Timer
        if (data.holdTimer !== undefined) {
            updateVmixHoldTimer(data.holdTimer);
        }
    }, (error) => {
        console.error('Enhanced Firebase read error:', error.message);
    });
    
    console.log('Enhanced Firebase listener active for SHIDO cards and hold timer');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('vMix enhanced system initializing (cards + hold timer)...');
    
    // Initialize with zero cards
    renderVmixCards('shidoCardsA', 0);
    renderVmixCards('shidoCardsB', 0);
    
    // Initialize hold timer as hidden
    updateVmixHoldTimer({ active: false });
    
    // Set up enhanced listener after a short delay to ensure main vMix script loads first
    setTimeout(() => {
        setupEnhancedFirebaseListener();
    }, 1000);
    
    console.log('vMix enhanced system initialized (cards + hold timer)');
});

// Fallback: Also try to initialize if DOM is already loaded
if (document.readyState === 'loading') {
    // DOM is still loading, event listener will handle it
} else {
    // DOM already loaded, initialize immediately
    console.log('DOM already loaded, initializing vMix enhanced system immediately');
    
    // Initialize with zero cards
    renderVmixCards('shidoCardsA', 0);
    renderVmixCards('shidoCardsB', 0);
    
    // Initialize hold timer as hidden
    updateVmixHoldTimer({ active: false });
    
    // Set up enhanced listener
    setTimeout(() => {
        setupEnhancedFirebaseListener();
    }, 1000);
}
