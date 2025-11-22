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
        constructor() {
            this.db = firebase.database();
            this.matchesRef = this.db.ref('tournament/matches');
            this.locksRef = this.db.ref('tournament/locks');
            this.devicesRef = this.db.ref('tournament/devices');
            this.currentMatchId = null;
            this.heartbeatInterval = null;
            
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
                        fighterA: players[i],
                        fighterB: players[i + 1],
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
         * Try to lock a match
         */
        async lockMatch(matchId) {
            try {
                console.log('🔒 Attempting to lock match:', matchId);
                console.log('📍 Looking in path:', this.matchesRef.toString() + '/' + matchId);
                
                const lockRef = this.locksRef.child(matchId);
                const matchRef = this.matchesRef.child(matchId);

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

                // Try to acquire lock using transaction
                const lockResult = await lockRef.transaction(currentLock => {
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
                });

                if (!lockResult.committed) {
                    throw new Error('Match is already locked by another device');
                }

                // Update match status
                await matchRef.update({
                    status: 'locked',
                    deviceId: DEVICE_ID,
                    deviceName: DEVICE_NAME,
                    lockedAt: firebase.database.ServerValue.TIMESTAMP
                });

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
                const matchRef = this.matchesRef.child(matchId);

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

                const matchRef = this.matchesRef.child(matchId);
                
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
                const matchRef = this.matchesRef.child(matchId);
                
                // Update match status
                await matchRef.update({
                    status: 'completed',
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
                console.log('✅ Match completed:', matchId);
                return true;

            } catch (error) {
                console.error('❌ Error completing match:', error);
                throw error;
            }
        }

        /**
         * Open scoreboard for match
         */
        openScoreboard(matchId) {
            const matchRef = this.matchesRef.child(matchId);
            
            matchRef.once('value', snapshot => {
                const match = snapshot.val();
                if (!match) return;

                // Handle both old and new match formats
                const fighterAName = match.fighterA?.fullName || match.fighterA?.name || match.playerAName || 'Fighter A';
                const fighterBName = match.fighterB?.fullName || match.fighterB?.name || match.playerBName || 'Fighter B';
                const fighterAClub = match.fighterA?.team || match.playerAClub || 'N/A';
                const fighterBClub = match.fighterB?.team || match.playerBClub || 'N/A';
                const weightCategory = match.weight || match.weightCategory || 'N/A';
                const matchNumber = match.matchNumber || match.round || '1';

                // Build scoreboard URL with match data
                const params = new URLSearchParams({
                    matchId: matchId,
                    fighterAName: fighterAName,
                    fighterBName: fighterBName,
                    fighterAClub: fighterAClub,
                    fighterBClub: fighterBClub,
                    weightCategory: weightCategory,
                    matchNumber: matchNumber,
                    mat: match.mat || ''
                });

                const scoreboardUrl = `/views/scoreboard.html?${params.toString()}`;
                
                // Open in new window/tab
                window.open(scoreboardUrl, '_blank', 'noopener,noreferrer');
                console.log('📺 Scoreboard opened:', scoreboardUrl);
            });
        }

        /**
         * Listen for match updates
         */
        onMatchUpdate(matchId, callback) {
            return this.matchesRef.child(matchId).on('value', snapshot => {
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
                const matches = [];
                snapshot.forEach(child => {
                    const matchData = child.val();
                    // Use Firebase key as the ID, store original ID as originalId if it exists
                    matches.push({ 
                        ...matchData,
                        id: child.key,  // Always use Firebase key as ID
                        originalId: matchData.id  // Preserve original ID if it exists
                    });
                });
                console.log('📦 Parsed matches from Firebase:', matches.length);
                if (matches.length > 0) {
                    console.log('📋 Sample match ID:', matches[0].id);
                }
                callback(matches);
            });
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
