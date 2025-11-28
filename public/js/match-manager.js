/**
 * Match Manager - Multi-Device Tournament Management
 * Handles match locking, device synchronization, and real-time updates
 */

(function() {
    'use strict';

    // Generate unique device ID
    function getDeviceId() {
        let deviceId = localStorage.getItem('deviceId');
        if (!deviceId) {
            deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('deviceId', deviceId);
        }
        return deviceId;
    }

    // Device information
    const DEVICE_ID = getDeviceId();
    const DEVICE_NAME = localStorage.getItem('deviceName') || 'Unknown Device';

    /**
     * Match Manager Class
     */
    class MatchManager {
        constructor(tournamentId = null) {
            this.db = firebase.database();
            this.tournamentId = tournamentId;
            
            // Use tournament-specific paths if tournament ID is provided
            if (tournamentId) {
                this.matchesRef = this.db.ref(`tournaments/${tournamentId}/matches`);
                this.locksRef = this.db.ref(`tournaments/${tournamentId}/locks`);
                this.devicesRef = this.db.ref(`tournaments/${tournamentId}/devices`);
            } else {
                this.matchesRef = this.db.ref('tournament/matches');
                this.locksRef = this.db.ref('tournament/locks');
                this.devicesRef = this.db.ref('tournament/devices');
            }
            
            this.currentMatchId = null;
            this.heartbeatInterval = null;
            
            console.log('🏆 MatchManager initialized with tournament:', tournamentId || 'global');
            
            this.initializeDevice();
        }

        /**
         * Initialize device registration
         */
        initializeDevice() {
            const deviceRef = this.devicesRef.child(DEVICE_ID);
            
            // Register device
            deviceRef.set({
                deviceId: DEVICE_ID,
                deviceName: DEVICE_NAME,
                lastSeen: firebase.database.ServerValue.TIMESTAMP,
                status: 'online',
                currentMatch: null
            });

            // Update last seen every 5 seconds
            this.heartbeatInterval = setInterval(() => {
                deviceRef.update({
                    lastSeen: firebase.database.ServerValue.TIMESTAMP
                });
            }, 5000);

            // Clean up on disconnect
            deviceRef.onDisconnect().update({
                status: 'offline',
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            });

            // Clean up locks on disconnect
            this.locksRef.orderByChild('deviceId').equalTo(DEVICE_ID).once('value', snapshot => {
                snapshot.forEach(child => {
                    this.locksRef.child(child.key).onDisconnect().remove();
                });
            });
        }

        /**
         * Create matches from draw
         */
        async createMatchesFromDraw(drawData) {
            try {
                const matches = [];
                let matchNumber = 1;

                // Process each weight category and gender
                for (const category of drawData.categories) {
                    const { weight, gender, players } = category;

                    // Create matches based on bracket structure
                    const bracketMatches = this.generateBracketMatches(players, weight, gender, matchNumber);
                    matches.push(...bracketMatches);
                    matchNumber += bracketMatches.length;
                }

                // Save matches to Firebase
                const matchesData = {};
                matches.forEach(match => {
                    matchesData[match.id] = match;
                });

                await this.matchesRef.set(matchesData);
                console.log('✅ Matches created successfully:', matches.length);
                return matches;

            } catch (error) {
                console.error('❌ Error creating matches:', error);
                throw error;
            }
        }

        /**
         * Generate bracket matches
         */
        generateBracketMatches(players, weight, gender, startNumber) {
            const matches = [];
            const rounds = Math.ceil(Math.log2(players.length));
            
            // Helper function to sanitize player data
            const sanitizePlayer = (player) => {
                if (!player) return null;
                return {
                    id: player.id || '',
                    fullName: player.fullName || player.name || '',
                    name: player.name || player.fullName || '',
                    team: player.team || '',
                    weight: player.weight || 0,
                    gender: player.gender || '',
                    photoBase64: player.photoBase64 || ''
                };
            };
            
            // First round matches
            for (let i = 0; i < players.length; i += 2) {
                if (i + 1 < players.length) {
                    const matchId = `match_${Date.now()}_${startNumber + matches.length}`;
                    matches.push({
                        id: matchId,
                        matchNumber: startNumber + matches.length,
                        round: 1,
                        weight: weight,
                        gender: gender,
                        fighterA: sanitizePlayer(players[i]),
                        fighterB: sanitizePlayer(players[i + 1]),
                        status: 'pending', // pending, locked, in_progress, completed
                        winner: null,
                        mat: null,
                        deviceId: null,
                        startTime: null,
                        endTime: null,
                        createdAt: firebase.database.ServerValue.TIMESTAMP
                    });
                }
            }

            return matches;
        }

        /**
         * Find match index in array (handles both main and repechage, and category-based structure)
         */
        async findMatchIndex(matchId) {
            const snapshot = await this.matchesRef.once('value');
            const data = snapshot.val();
            
            if (!data) return { index: -1, isRepechage: false, categoryKey: null };
            
            // Check if category-based structure
            const firstKey = Object.keys(data)[0];
            const firstValue = data[firstKey];
            
            if (firstValue && typeof firstValue === 'object' && (firstValue.main || firstValue.repechage)) {
                console.log('🔍 Searching for match in category-based structure');
                
                // Search through all categories
                for (const categoryKey of Object.keys(data)) {
                    const categoryData = data[categoryKey];
                    
                    // Search in main matches
                    if (categoryData.main && Array.isArray(categoryData.main)) {
                        const index = categoryData.main.findIndex(m => m.id === matchId);
                        if (index !== -1) {
                            console.log(`✅ Match found in category ${categoryKey}, main matches, index ${index}`);
                            return { index, isRepechage: false, categoryKey };
                        }
                    }
                    
                    // Search in repechage matches
                    if (categoryData.repechage && Array.isArray(categoryData.repechage)) {
                        const index = categoryData.repechage.findIndex(m => m.id === matchId);
                        if (index !== -1) {
                            console.log(`✅ Match found in category ${categoryKey}, repechage matches, index ${index}`);
                            return { index, isRepechage: true, categoryKey };
                        }
                    }
                }
                
                console.log('❌ Match not found in any category');
                return { index: -1, isRepechage: false, categoryKey: null };
            }
            
            // Handle single category or old structure
            let matches = [];
            let repechageMatches = [];
            
            if (data.main && Array.isArray(data.main)) {
                matches = data.main;
                repechageMatches = data.repechage || [];
            } else if (Array.isArray(data)) {
                matches = data;
            } else {
                // Old object structure - match exists as child
                return { index: null, isRepechage: false, categoryKey: null }; // Use old method
            }
            
            // Search in main matches first
            let index = matches.findIndex(m => m.id === matchId);
            if (index !== -1) {
                return { index, isRepechage: false, categoryKey: null };
            }
            
            // Search in repechage matches
            index = repechageMatches.findIndex(m => m.id === matchId);
            if (index !== -1) {
                return { index, isRepechage: true, categoryKey: null };
            }
            
            return { index: -1, isRepechage: false, categoryKey: null };
        }
        
        /**
         * Get match reference (handles both array and object structures, repechage, and category-based structure)
         */
        async getMatchRef(matchId) {
            const result = await this.findMatchIndex(matchId);
            
            if (result.index === null) {
                // Old object structure
                return this.matchesRef.child(matchId);
            } else if (result.index >= 0) {
                // Array structure - check if category-based
                if (result.categoryKey) {
                    // Category-based structure
                    if (result.isRepechage) {
                        return this.matchesRef.child(`${result.categoryKey}/repechage/${result.index}`);
                    } else {
                        return this.matchesRef.child(`${result.categoryKey}/main/${result.index}`);
                    }
                } else {
                    // Single category structure
                    if (result.isRepechage) {
                        return this.matchesRef.child(`repechage/${result.index}`);
                    } else {
                        return this.matchesRef.child(`main/${result.index}`);
                    }
                }
            }
            
            return null;
        }
        
        /**
         * Try to lock a match
         */
        async lockMatch(matchId, matNumber = null) {
            try {
                console.log('🔒 Attempting to lock match:', matchId);
                if (matNumber) {
                    console.log('📍 Mat Number:', matNumber);
                }
                
                // Check Firebase connection first
                const connectedRef = firebase.database().ref('.info/connected');
                const connSnapshot = await connectedRef.once('value');
                if (!connSnapshot.val()) {
                    throw new Error('Not connected to Firebase. Please check your internet connection.');
                }
                
                const lockRef = this.locksRef.child(matchId);
                const matchRef = await this.getMatchRef(matchId);
                
                if (!matchRef) {
                    console.error('❌ Match not found:', matchId);
                    throw new Error('Match not found');
                }
                
                console.log('📍 Match path:', matchRef.toString());

                // Check if match exists and is available
                const matchSnapshot = await matchRef.once('value');
                console.log('📦 Match snapshot exists:', matchSnapshot.exists());
                
                if (!matchSnapshot.exists()) {
                    console.error('❌ Match not found at path:', matchRef.toString());
                    throw new Error('Match not found');
                }
                
                console.log('✅ Match found:', matchSnapshot.val());

                const matchData = matchSnapshot.val();
                
                // Handle both old draw format (no status field) and new format
                const currentStatus = matchData.status || (matchData.completed ? 'completed' : 'pending');
                
                if (currentStatus !== 'pending') {
                    throw new Error(`Match is ${currentStatus}`);
                }

                // Try to acquire lock using transaction with retry logic
                let lockResult;
                let retries = 3;
                
                while (retries > 0) {
                    try {
                        lockResult = await lockRef.transaction(currentLock => {
                            if (currentLock === null) {
                                // Lock is available
                                return {
                                    deviceId: DEVICE_ID,
                                    deviceName: DEVICE_NAME,
                                    lockedAt: Date.now(),
                                    matchId: matchId
                                };
                            } else {
                                // Lock is taken
                                return undefined; // Abort transaction
                            }
                        }, undefined, false); // applyLocally = false for better consistency
                        
                        break; // Success, exit retry loop
                    } catch (transactionError) {
                        retries--;
                        if (retries === 0) {
                            throw transactionError;
                        }
                        console.warn(`⚠️ Transaction failed, retrying... (${retries} attempts left)`);
                        await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retry
                    }
                }

                if (!lockResult.committed) {
                    throw new Error('Match is already locked by another device');
                }

                // Update match status with mat number
                const updateData = {
                    status: 'locked',
                    deviceId: DEVICE_ID,
                    deviceName: DEVICE_NAME,
                    lockedAt: firebase.database.ServerValue.TIMESTAMP
                };
                
                // Add mat number if provided
                if (matNumber) {
                    updateData.matNumber = matNumber;
                }
                
                await matchRef.update(updateData);

                // Update device current match
                await this.devicesRef.child(DEVICE_ID).update({
                    currentMatch: matchId
                });

                this.currentMatchId = matchId;
                console.log('✅ Match locked successfully:', matchId);
                return true;

            } catch (error) {
                console.error('❌ Error locking match:', error);
                throw error;
            }
        }

        /**
         * Unlock a match
         */
        async unlockMatch(matchId) {
            try {
                const lockRef = this.locksRef.child(matchId);
                const matchRef = await this.getMatchRef(matchId);
                
                if (!matchRef) {
                    throw new Error('Match not found');
                }

                // Verify we own the lock
                const lockSnapshot = await lockRef.once('value');
                if (lockSnapshot.exists()) {
                    const lockData = lockSnapshot.val();
                    if (lockData.deviceId !== DEVICE_ID) {
                        throw new Error('Cannot unlock match owned by another device');
                    }
                }

                // Remove lock
                await lockRef.remove();

                // Update match status back to pending
                await matchRef.update({
                    status: 'pending',
                    deviceId: null,
                    deviceName: null,
                    lockedAt: null
                });

                // Clear device current match
                await this.devicesRef.child(DEVICE_ID).update({
                    currentMatch: null
                });

                this.currentMatchId = null;
                console.log('✅ Match unlocked:', matchId);
                return true;

            } catch (error) {
                console.error('❌ Error unlocking match:', error);
                throw error;
            }
        }

        /**
         * Start a match
         */
        async startMatch(matchId, matNumber) {
            try {
                // Verify we have the lock
                const lockSnapshot = await this.locksRef.child(matchId).once('value');
                if (!lockSnapshot.exists() || lockSnapshot.val().deviceId !== DEVICE_ID) {
                    throw new Error('You must lock the match before starting it');
                }

                const matchRef = await this.getMatchRef(matchId);
                
                if (!matchRef) {
                    throw new Error('Match not found');
                }
                
                // Update match status
                await matchRef.update({
                    status: 'in_progress',
                    mat: matNumber,
                    startTime: firebase.database.ServerValue.TIMESTAMP
                });

                console.log('✅ Match started:', matchId);
                
                // Open scoreboard in new window
                this.openScoreboard(matchId);
                
                return true;

            } catch (error) {
                console.error('❌ Error starting match:', error);
                throw error;
            }
        }

        /**
         * Complete a match
         */
        async completeMatch(matchId, winner, scoreData) {
            try {
                const matchRef = await this.getMatchRef(matchId);
                
                if (!matchRef) {
                    throw new Error('Match not found');
                }
                
                // Update match status
                await matchRef.update({
                    status: 'completed',
                    completed: true,
                    winner: winner,
                    scoreData: scoreData,
                    endTime: firebase.database.ServerValue.TIMESTAMP
                });

                // Remove lock
                await this.locksRef.child(matchId).remove();

                // Clear device current match
                await this.devicesRef.child(DEVICE_ID).update({
                    currentMatch: null
                });

                this.currentMatchId = null;
                console.log('✅ Match completed:', matchId, 'Winner:', winner);
                
                // Trigger tournament progression - Use IJF Tournament Manager if available
                if (window.IJFTournamentManager) {
                    console.log('🔄 Using IJF Tournament Manager for tournament progression...');
                    const tournamentManager = new IJFTournamentManager();
                    await tournamentManager.progressTournament(matchId, winner);
                    await tournamentManager.checkAndCreateRepechage(matchId);
                    console.log('✅ IJF Tournament progression complete');
                } else if (window.TournamentProgression) {
                    console.log('🔄 Using legacy TournamentProgression...');
                    const progression = new TournamentProgression();
                    await progression.onMatchComplete(matchId, winner);
                    console.log('✅ Legacy tournament progression complete');
                }
                
                return true;

            } catch (error) {
                console.error('❌ Error completing match:', error);
                throw error;
            }
        }

        /**
         * Open scoreboard for match
         */
        async openScoreboard(matchId) {
            const matchRef = await this.getMatchRef(matchId);
            
            if (!matchRef) {
                console.error('Match not found:', matchId);
                return;
            }
            
            matchRef.once('value', snapshot => {
                const match = snapshot.val();
                if (!match) return;

                // Handle both old and new match formats
                // Use firstName + lastName if available, otherwise fallback to fullName
                const fighterAName = (match.fighterA?.firstName && match.fighterA?.lastName)
                    ? `${match.fighterA.firstName} ${match.fighterA.lastName}`
                    : (match.fighterA?.fullName || match.fighterA?.name || match.playerAName || 'Fighter A');
                const fighterBName = (match.fighterB?.firstName && match.fighterB?.lastName)
                    ? `${match.fighterB.firstName} ${match.fighterB.lastName}`
                    : (match.fighterB?.fullName || match.fighterB?.name || match.playerBName || 'Fighter B');
                const fighterAClub = match.fighterA?.team || match.playerAClub || '';
                const fighterBClub = match.fighterB?.team || match.playerBClub || '';
                const fighterAPhoto = match.fighterA?.photoBase64 || match.playerAPhoto || '';
                const fighterBPhoto = match.fighterB?.photoBase64 || match.playerBPhoto || '';
                const weightCategory = match.weightCategory || match.weight || match.category || '';
                const matchNumber = match.matchNumber || match.round || '';
                const matNumber = match.matNumber || match.mat || '';

                // Build scoreboard URL with match data
                const params = new URLSearchParams({
                    matchId: matchId,
                    fighterAName: fighterAName,
                    fighterBName: fighterBName,
                    fighterAClub: fighterAClub,
                    fighterBClub: fighterBClub,
                    weightCategory: weightCategory,
                    matchNumber: matchNumber,
                    matNumber: matNumber
                });
                
                // Add tournament ID if available
                if (this.tournamentId) {
                    params.set('tournamentId', this.tournamentId);
                }
                
                // Add photos if available (don't add to URL if too large, let it load from DB)
                if (fighterAPhoto && fighterAPhoto.length < 50000) {
                    params.set('fighterAPhoto', fighterAPhoto);
                }
                if (fighterBPhoto && fighterBPhoto.length < 50000) {
                    params.set('fighterBPhoto', fighterBPhoto);
                }

                const scoreboardUrl = `/views/scoreboard.html?${params.toString()}`;
                
                // Open in new window/tab
                window.open(scoreboardUrl, '_blank', 'noopener,noreferrer');
                console.log('📺 Scoreboard opened:', scoreboardUrl);
            });
        }

        /**
         * Listen for match updates
         */
        async onMatchUpdate(matchId, callback) {
            const matchRef = await this.getMatchRef(matchId);
            
            if (!matchRef) {
                console.error('Match not found:', matchId);
                return null;
            }
            
            return matchRef.on('value', snapshot => {
                callback(snapshot.val());
            });
        }

        /**
         * Listen for all matches
         */
        onMatchesUpdate(callback) {
            console.log('👂 Setting up matches listener on:', this.matchesRef.toString());
            return this.matchesRef.on('value', snapshot => {
                console.log('🔥 Firebase snapshot received, exists:', snapshot.exists());
                let matches = [];
                
                const data = snapshot.val();
                
                if (!data) {
                    console.log('⚠️ No match data found');
                    callback(matches);
                    return;
                }
                
                // Handle new category-based structure: { SENIOR_male_60: {main: [...], repechage: [...]}, ... }
                // Check if data has category keys (e.g., SENIOR_male_60)
                const firstKey = Object.keys(data)[0];
                const firstValue = data[firstKey];
                
                if (firstValue && typeof firstValue === 'object' && (firstValue.main || firstValue.repechage)) {
                    console.log('📊 Loading matches from category-based structure');
                    // Iterate through all categories
                    Object.keys(data).forEach(categoryKey => {
                        const categoryData = data[categoryKey];
                        
                        // Load main matches
                        if (categoryData.main && Array.isArray(categoryData.main)) {
                            const categoryMatches = categoryData.main.map(match => ({
                                ...match,
                                id: match.id || this.generateMatchId(),
                                category: categoryKey
                            }));
                            matches.push(...categoryMatches);
                        }
                        
                        // Load repechage matches
                        if (categoryData.repechage && Array.isArray(categoryData.repechage)) {
                            const repechageMatches = categoryData.repechage.map(match => ({
                                ...match,
                                id: match.id || this.generateMatchId(),
                                isRepechage: true,
                                category: categoryKey
                            }));
                            matches.push(...repechageMatches);
                        }
                    });
                    console.log('✅ Loaded', matches.length, 'matches from', Object.keys(data).length, 'categories');
                }
                // Handle single category structure: { main: [...], repechage: [...] }
                else if (data.main && Array.isArray(data.main)) {
                    console.log('📊 Loading matches from single category structure (main array)');
                    matches = data.main.map(match => ({
                        ...match,
                        id: match.id || this.generateMatchId()
                    }));
                    
                    // Also load repechage matches if they exist
                    if (data.repechage && Array.isArray(data.repechage)) {
                        console.log('🥉 Loading repechage matches:', data.repechage.length);
                        const repechageMatches = data.repechage.map(match => ({
                            ...match,
                            id: match.id || this.generateMatchId(),
                            isRepechage: true
                        }));
                        matches.push(...repechageMatches);
                    }
                }
                // Handle direct array structure (legacy)
                else if (Array.isArray(data)) {
                    console.log('📊 Loading matches from array structure');
                    matches = data.map(match => ({
                        ...match,
                        id: match.id || this.generateMatchId()
                    }));
                }
                // Handle object structure (very old format)
                else {
                    console.log('📊 Loading matches from object structure');
                    snapshot.forEach(child => {
                        const matchData = child.val();
                        matches.push({ 
                            ...matchData,
                            id: child.key,
                            originalId: matchData.id
                        });
                    });
                }
                
                console.log('📦 Parsed matches from Firebase:', matches.length);
                if (matches.length > 0) {
                    console.log('📋 Sample match:', matches[0]);
                }
                callback(matches);
            });
        }
        
        /**
         * Generate a unique match ID
         */
        generateMatchId() {
            return 'match_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }

        /**
         * Get all devices
         */
        async getDevices() {
            const snapshot = await this.devicesRef.once('value');
            const devices = [];
            snapshot.forEach(child => {
                devices.push({ id: child.key, ...child.val() });
            });
            return devices;
        }

        /**
         * Set device name
         */
        async setDeviceName(name) {
            localStorage.setItem('deviceName', name);
            await this.devicesRef.child(DEVICE_ID).update({
                deviceName: name
            });
            console.log('✅ Device name updated:', name);
        }

        /**
         * Cleanup
         */
        cleanup() {
            if (this.heartbeatInterval) {
                clearInterval(this.heartbeatInterval);
            }
            
            // Mark device as offline
            this.devicesRef.child(DEVICE_ID).update({
                status: 'offline',
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            });
        }

        /**
         * Get current device info
         */
        getDeviceInfo() {
            return {
                deviceId: DEVICE_ID,
                deviceName: DEVICE_NAME
            };
        }
    }

    // Export to global scope
    window.MatchManager = MatchManager;
    window.DEVICE_ID = DEVICE_ID;
    window.DEVICE_NAME = DEVICE_NAME;

    console.log('✅ Match Manager initialized');
    console.log('📱 Device ID:', DEVICE_ID);
    console.log('📱 Device Name:', DEVICE_NAME);

})();
