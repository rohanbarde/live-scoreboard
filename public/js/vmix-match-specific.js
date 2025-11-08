// vMix Card Rendering Functions
// This file extends the main vMix functionality to handle SHIDO penalty cards

// Function to render penalty cards in vMix
function renderVmixCards(containerId, shidoCount) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.warn(`Container ${containerId} not found`);
        return;
    }
    
    // Clear existing cards
    container.innerHTML = '';
    
    if (shidoCount === 0) {
        // Show "0" when no shidos
        const el = document.createElement('div');
        el.className = 'score-num';
        el.textContent = '0';
        el.style.fontSize = '5vw';
        el.style.fontWeight = '800';
        el.style.color = 'inherit';
        container.appendChild(el);
    } else if (shidoCount >= 3) {
        // Show red card for 3 or more shidos
        const el = document.createElement('div');
        el.className = 'vmix-card-pill red';
        el.textContent = 'R';
        container.appendChild(el);
    } else {
        // Show yellow cards for 1-2 shidos
        for (let i = 0; i < shidoCount; i++) {
            const el = document.createElement('div');
            el.className = 'vmix-card-pill yellow';
            el.textContent = 'Y';
            container.appendChild(el);
        }
    }
    
    console.log(`Rendered ${shidoCount} shido cards in ${containerId}`);
}

// Enhanced Firebase listener that includes SHIDO data
function setupEnhancedFirebaseListener() {
    if (typeof database === 'undefined') {
        console.error('Firebase database not available');
        return;
    }
    
    const matchRef = database.ref('current_match');
    
    matchRef.on('value', (snapshot) => {
        const data = snapshot.val();
        
        if (!data) {
            console.log('No enhanced data received from Firebase');
            return;
        }
        
        console.log('Enhanced Firebase update received:', data);
        
        // Update Fighter A SHIDO cards
        if (data.fighterA && data.fighterA.shido !== undefined) {
            renderVmixCards('shidoCardsA', data.fighterA.shido || 0);
        }
        
        // Update Fighter B SHIDO cards
        if (data.fighterB && data.fighterB.shido !== undefined) {
            renderVmixCards('shidoCardsB', data.fighterB.shido || 0);
        }
    }, (error) => {
        console.error('Enhanced Firebase read error:', error.message);
    });
    
    console.log('Enhanced Firebase listener active for SHIDO cards');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('vMix card system initializing...');
    
    // Initialize with zero cards
    renderVmixCards('shidoCardsA', 0);
    renderVmixCards('shidoCardsB', 0);
    
    // Set up enhanced listener after a short delay to ensure main vMix script loads first
    setTimeout(() => {
        setupEnhancedFirebaseListener();
    }, 1000);
    
    console.log('vMix card system initialized');
});

// Fallback: Also try to initialize if DOM is already loaded
if (document.readyState === 'loading') {
    // DOM is still loading, event listener will handle it
} else {
    // DOM already loaded, initialize immediately
    console.log('DOM already loaded, initializing vMix cards immediately');
    
    // Initialize with zero cards
    renderVmixCards('shidoCardsA', 0);
    renderVmixCards('shidoCardsB', 0);
    
    // Set up enhanced listener
    setTimeout(() => {
        setupEnhancedFirebaseListener();
    }, 1000);
}
