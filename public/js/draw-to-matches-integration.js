/**
 * Integration between Draw Generation and Match Manager
 * This script connects the draw generation system with the multi-device match manager
 */

// Override the generate draw function to use Match Manager
(function() {
    'use strict';

    // Wait for both systems to be ready
    function waitForSystems() {
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (typeof MatchManager !== 'undefined' && typeof tournamentDraw !== 'undefined') {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
        });
    }

    // Initialize integration
    waitForSystems().then(() => {
        console.log('✅ Draw-to-Matches integration ready');
        
        // Create match manager instance
        window.matchManagerInstance = new MatchManager();
        
        // Override the generate draw completion
        enhanceDrawGeneration();
    });

    /**
     * Enhance draw generation to create matches in Match Manager
     */
    function enhanceDrawGeneration() {
        // Store original generate draw button handler
        const generateDrawBtn = document.getElementById('generateDrawBtn');
        if (!generateDrawBtn) return;

        // Add additional handler to create matches after draw
        const originalHandler = generateDrawBtn.onclick;
        
        generateDrawBtn.addEventListener('click', async function(e) {
            // Wait for draw animation to complete
            setTimeout(async () => {
                try {
                    await createMatchesFromCurrentDraw();
                } catch (error) {
                    console.error('Error creating matches:', error);
                }
            }, 3000); // Wait for animation
        });
    }

    /**
     * Create matches from current draw
     */
    async function createMatchesFromCurrentDraw() {
        try {
            // Get the current draw data from Firebase
            const matchesSnapshot = await firebase.database().ref('tournament/matches').once('value');
            const drawMatches = matchesSnapshot.val();
            
            if (!drawMatches) {
                console.log('No draw matches found');
                return;
            }

            // Convert draw matches to Match Manager format
            const categories = [];
            const matchesByCategory = {};

            // Group matches by weight and gender
            Object.values(drawMatches).forEach(match => {
                const key = `${match.weight}_${match.gender}`;
                if (!matchesByCategory[key]) {
                    matchesByCategory[key] = {
                        weight: match.weight,
                        gender: match.gender,
                        players: []
                    };
                }
                
                // Add players if not already added
                if (match.fighterA && !matchesByCategory[key].players.find(p => p.id === match.fighterA.id)) {
                    matchesByCategory[key].players.push(match.fighterA);
                }
                if (match.fighterB && !matchesByCategory[key].players.find(p => p.id === match.fighterB.id)) {
                    matchesByCategory[key].players.push(match.fighterB);
                }
            });

            // Convert to categories array
            Object.values(matchesByCategory).forEach(category => {
                categories.push(category);
            });

            // Create matches using Match Manager
            const drawData = { categories };
            await window.matchManagerInstance.createMatchesFromDraw(drawData);

            // Show success message
            showSuccessNotification('✅ Matches created successfully! Go to Tournament Matches page to manage them.');

        } catch (error) {
            console.error('Error creating matches from draw:', error);
            showErrorNotification('❌ Error creating matches: ' + error.message);
        }
    }

    /**
     * Show success notification
     */
    function showSuccessNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'alert alert-success alert-dismissible fade show position-fixed';
        notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            <div class="mt-2">
                <a href="/views/tournament-matches.html" class="btn btn-sm btn-primary">
                    Go to Tournament Matches
                </a>
            </div>
        `;
        document.body.appendChild(notification);

        // Auto remove after 10 seconds
        setTimeout(() => {
            notification.remove();
        }, 10000);
    }

    /**
     * Show error notification
     */
    function showErrorNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'alert alert-danger alert-dismissible fade show position-fixed';
        notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

})();
