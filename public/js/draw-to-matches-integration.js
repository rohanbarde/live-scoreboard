/**
 * Integration between Draw Generation and Match Manager
 * This script connects the draw generation system with the multi-device match manager
 * 
 * NOTE: This script is DISABLED. Matches are now created only when "Save Draw" is clicked.
 * The new category-based system saves matches directly in generate-draws.js
 */

// DISABLED - Matches are now saved via "Save Draw" button
(function() {
    'use strict';

    console.log('ℹ️ Draw-to-Matches integration is DISABLED. Use "Save Draw" button instead.');
    
    // This integration is disabled to prevent conflicts with the new category-based system
    // Matches are now saved when the admin clicks "Save Draw" button
    
    return; // Exit immediately
    
    // The code below is kept for reference but will not execute

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
            console.log('🔄 Creating matches from draw...');
            
            // Get all registered players
            const playersSnapshot = await firebase.database().ref('registrations').orderByChild('userType').equalTo('player').once('value');
            
            if (!playersSnapshot.exists()) {
                console.log('❌ No players found');
                showErrorNotification('No players registered. Please register players first.');
                return;
            }

            // Collect all players
            const allPlayers = [];
            playersSnapshot.forEach(childSnapshot => {
                const player = childSnapshot.val();
                player.id = childSnapshot.key;
                allPlayers.push(player);
            });

            console.log(`📊 Found ${allPlayers.length} registered players`);

            // Group players by weight and gender
            const matchesByCategory = {};

            allPlayers.forEach(player => {
                const weight = player.playerInfo?.weight || 'Unknown';
                const gender = player.playerInfo?.gender || 'Unknown';
                const key = `${weight}_${gender}`;

                if (!matchesByCategory[key]) {
                    matchesByCategory[key] = {
                        weight: weight,
                        gender: gender,
                        players: []
                    };
                }

                // Add player with proper structure (ensure no undefined values)
                matchesByCategory[key].players.push({
                    id: player.id,
                    fullName: player.fullName || '',
                    name: player.fullName || '',
                    team: player.playerInfo?.team || 'N/A',
                    weight: player.playerInfo?.weight || 0,
                    gender: player.playerInfo?.gender || '',
                    photoBase64: player.photoBase64 || ''
                });
            });

            // Convert to categories array
            const categories = Object.values(matchesByCategory).filter(cat => cat.players.length >= 2);

            if (categories.length === 0) {
                console.log('❌ No valid categories with 2+ players');
                showErrorNotification('Need at least 2 players in a weight/gender category to create matches.');
                return;
            }

            console.log(`📋 Creating matches for ${categories.length} categories`);

            // Create matches using Match Manager
            const drawData = { categories };
            await window.matchManagerInstance.createMatchesFromDraw(drawData);

            // Show success message
            showSuccessNotification('✅ Matches created successfully!');

        } catch (error) {
            console.error('❌ Error creating matches from draw:', error);
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
        `;
        document.body.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            notification.remove();
        }, 5000);
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
