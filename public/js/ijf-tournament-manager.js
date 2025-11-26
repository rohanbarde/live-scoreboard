/**
 * IJF Tournament Management System
 * 
 * Comprehensive tournament manager that handles:
 * - Match locking and starting from tournament bracket
 * - Automatic status updates (pending → locked → in_progress → completed)
 * - Winner declaration triggers automatic match completion
 * - Automatic scheduling of next round matches based on IJF rules
 * - Full repechage system for bronze medal contests
 * - Dynamic player support (works with any number of players)
 * 
 * Example: 8 players = 11 matches total:
 * - 4 quarterfinal matches (Round 1)
 * - 2 semifinal matches (Round 2)
 * - 1 final match (Round 3)
 * - 2 repechage matches (QF losers compete)
 * - 2 bronze medal matches (Repechage winners vs SF losers)
 * 
 * @version 2.0
 * @author Judo Tournament System
 */

class IJFTournamentManager {
    constructor() {
        this.database = firebase.database();
        this.matchesRef = this.database.ref('tournament/matches');
        this.locksRef = this.database.ref('tournament/locks');
        this.devicesRef = this.database.ref('tournament/devices');
    }

    /**
     * Complete a match and progress the tournament
     * This is called when a winner is declared in the scoreboard
     * 
     * @param {string} matchId - The ID of the completed match
     * @param {string} winnerId - The ID of the winning player
     * @param {object} scoreData - Score details from the match
     */
    async completeMatch(matchId, winnerId, scoreData = null) {
        try {
            console.log('🏆 IJF Tournament Manager: Processing match completion');
            console.log('   Match ID:', matchId);
            console.log('   Winner ID:', winnerId);

            // Step 1: Update match status to completed
            await this.updateMatchStatus(matchId, 'completed', winnerId, scoreData);

            // Step 2: Progress tournament (advance winner to next match)
            await this.progressTournament(matchId, winnerId);


            // Step 3: Check if repechage should be triggered
            await this.checkAndCreateRepechage(matchId);

            console.log('✅ Match completion and tournament progression successful');
            return { success: true };

        } catch (error) {
            console.error('❌ Error in completeMatch:', error);
            throw error;
        }
    }

    /**
     * Update match status in Firebase
     * Automatically changes status from "in_progress" to "completed"
     */
    async updateMatchStatus(matchId, status, winnerId = null, scoreData = null) {
        try {
            console.log('📝 Updating match status:', matchId, '→', status);

            const snapshot = await this.matchesRef.once('value');
            const data = snapshot.val();

            if (!data) {
                throw new Error('No tournament data found');
            }

            // Find match in category-based structure
            let matchPath = null;
            let matchData = null;

            for (const categoryKey of Object.keys(data)) {
                const category = data[categoryKey];

                // Check main matches
                if (category.main && Array.isArray(category.main)) {
                    const matchIndex = category.main.findIndex(m => m.id === matchId);
                    if (matchIndex !== -1) {
                        matchPath = `${categoryKey}/main/${matchIndex}`;
                        matchData = category.main[matchIndex];
                        break;
                    }
                }

                // Check repechage matches
                if (category.repechage && Array.isArray(category.repechage)) {
                    const matchIndex = category.repechage.findIndex(m => m.id === matchId);
                    if (matchIndex !== -1) {
                        matchPath = `${categoryKey}/repechage/${matchIndex}`;
                        matchData = category.repechage[matchIndex];
                        break;
                    }
                }
            }

            if (!matchPath) {
                throw new Error(`Match ${matchId} not found in tournament structure`);
            }

            // Prepare update data
            const updates = {
                status: status,
                completed: status === 'completed',
                endTime: firebase.database.ServerValue.TIMESTAMP
            };

            if (winnerId) {
                updates.winner = winnerId;
                // Record loser for repechage
                const loserId = (winnerId === matchData.playerA) ? matchData.playerB : matchData.playerA;
                updates.loser = loserId;
            }

            if (scoreData) {
                updates.scoreData = scoreData;
            }

            // Update in Firebase
            await this.matchesRef.child(matchPath).update(updates);

            // Remove lock if exists
            await this.locksRef.child(matchId).remove();

            console.log('✅ Match status updated successfully');

        } catch (error) {
            console.error('❌ Error updating match status:', error);
            throw error;
        }
    }

    /**
     * Progress tournament by advancing winner to next match
     * Follows IJF bracket structure
     */
    async progressTournament(matchId, winnerId) {
        try {
            console.log('🔄 Progressing tournament...');

            const snapshot = await this.matchesRef.once('value');
            const data = snapshot.val();

            if (!data) {
                throw new Error('No tournament data found');
            }

            // Find the completed match
            let completedMatch = null;
            let categoryKey = null;
            let isRepechage = false;

            for (const catKey of Object.keys(data)) {
                const category = data[catKey];

                // Search main matches
                if (category.main && Array.isArray(category.main)) {
                    const match = category.main.find(m => m.id === matchId);
                    if (match) {
                        completedMatch = match;
                        categoryKey = catKey;
                        break;
                    }
                }

                // Search repechage matches
                if (category.repechage && Array.isArray(category.repechage)) {
                    const match = category.repechage.find(m => m.id === matchId);
                    if (match) {
                        completedMatch = match;
                        categoryKey = catKey;
                        isRepechage = true;
                        break;
                    }
                }
            }

            if (!completedMatch) {
                throw new Error('Completed match not found');
            }

            // Check if there's a next match
            const nextMatchId = completedMatch.nextMatchId;
            if (!nextMatchId) {
                console.log('🏁 This is a final/bronze match - no progression needed');
                return;
            }

            // Find next match
            const category = data[categoryKey];
            let nextMatch = null;
            let nextMatchPath = null;
            let nextIsRepechage = false;

            // Search in main matches
            if (category.main && Array.isArray(category.main)) {
                const matchIndex = category.main.findIndex(m => m.id === nextMatchId);
                if (matchIndex !== -1) {
                    nextMatch = category.main[matchIndex];
                    nextMatchPath = `${categoryKey}/main/${matchIndex}`;
                }
            }

            // Search in repechage matches
            if (!nextMatch && category.repechage && Array.isArray(category.repechage)) {
                const matchIndex = category.repechage.findIndex(m => m.id === nextMatchId);
                if (matchIndex !== -1) {
                    nextMatch = category.repechage[matchIndex];
                    nextMatchPath = `${categoryKey}/repechage/${matchIndex}`;
                    nextIsRepechage = true;
                }
            }

            if (!nextMatch) {
                throw new Error('Next match not found');
            }

            // Get winner details
            let winnerName, winnerClub, winnerSeed, winnerCountry, winnerPlayerId;

            if (winnerId === completedMatch.playerA) {
                winnerPlayerId = completedMatch.playerA;
                winnerName = completedMatch.playerAName;
                winnerClub = completedMatch.playerAClub;
                winnerSeed = completedMatch.playerASeed;
                winnerCountry = completedMatch.playerACountry;
            } else {
                winnerPlayerId = completedMatch.playerB;
                winnerName = completedMatch.playerBName;
                winnerClub = completedMatch.playerBClub;
                winnerSeed = completedMatch.playerBSeed;
                winnerCountry = completedMatch.playerBCountry;
            }

            // Determine position in next match (A or B)
            const position = completedMatch.winnerTo || 'A';

            // Update next match with winner
            const updates = {};
            if (position === 'A') {
                updates.playerA = winnerPlayerId;
                updates.playerAName = winnerName;
                updates.playerAClub = winnerClub || '';
                updates.playerASeed = winnerSeed || null;
                updates.playerACountry = winnerCountry || '';
            } else {
                updates.playerB = winnerPlayerId;
                updates.playerBName = winnerName;
                updates.playerBClub = winnerClub || '';
                updates.playerBSeed = winnerSeed || null;
                updates.playerBCountry = winnerCountry || '';
            }

            await this.matchesRef.child(nextMatchPath).update(updates);

            console.log(`✅ Winner ${winnerName} advanced to match ${nextMatchId}`);

        } catch (error) {
            console.error('❌ Error progressing tournament:', error);
            throw error;
        }
    }

    /**
     * Check if repechage should be created (when semifinals complete)
     * Creates repechage matches according to IJF rules
     */
    async checkAndCreateRepechage(matchId) {
        try {
            const snapshot = await this.matchesRef.once('value');
            const data = snapshot.val();

            if (!data) return;

            // Check each category
            for (const categoryKey of Object.keys(data)) {
                const category = data[categoryKey];

                if (!category.main || !Array.isArray(category.main)) continue;

                const mainMatches = category.main;

                // Find final match
                const finalMatch = mainMatches.find(m => m.matchType === 'final');
                if (!finalMatch) continue;

                // Check if both finalists are determined
                if (!finalMatch.playerA || !finalMatch.playerB) continue;

                // Check if repechage already exists
                if (category.repechage && category.repechage.length > 0) {
                    console.log(`✓ Repechage already exists for category ${categoryKey}`);
                    continue;
                }

                // Create repechage for this category
                console.log(`🥉 Creating repechage for category ${categoryKey}`);
                await this.createRepechageForCategory(categoryKey, mainMatches);
            }

        } catch (error) {
            console.error('❌ Error checking/creating repechage:', error);
        }
    }

    /**
     * Create repechage matches for a specific category
     * IJF 8-player structure:
     * - Repechage 1: QF losers from Pool A compete
     * - Repechage 2: QF losers from Pool B compete
     * - Bronze 1: SF2 (Pool B) loser vs Repechage1 (Pool A) winner
     * - Bronze 2: SF1 (Pool A) loser vs Repechage2 (Pool B) winner
     */
    async createRepechageForCategory(categoryKey, mainMatches) {
        try {
            console.log('🥉 Creating IJF repechage for category:', categoryKey);

            // Find final and semifinals
            const finalMatch = mainMatches.find(m => m.matchType === 'final');
            if (!finalMatch) {
                console.error('No final match found');
                return;
            }

            const semifinals = mainMatches.filter(m => m.nextMatchId === finalMatch.id);
            if (semifinals.length !== 2) {
                console.error('Expected 2 semifinals, found:', semifinals.length);
                return;
            }

            // Find quarterfinals
            const quarterfinals = mainMatches.filter(m =>
                semifinals.some(sf => sf.id === m.nextMatchId)
            );

            if (quarterfinals.length !== 4) {
                console.error('Expected 4 quarterfinals, found:', quarterfinals.length);
                return;
            }

            const repechageMatches = [];

            // Group quarterfinals by semifinal
            const sf1QFs = quarterfinals.filter(qf => qf.nextMatchId === semifinals[0].id);
            const sf2QFs = quarterfinals.filter(qf => qf.nextMatchId === semifinals[1].id);

            // Create Repechage 1 (Pool A - QF losers feeding into SF1)
            if (sf1QFs.length === 2) {
                const qf1Loser = this.getMatchLoser(sf1QFs[0]);
                const qf2Loser = this.getMatchLoser(sf1QFs[1]);

                if (qf1Loser && qf2Loser) {
                    const weight = categoryKey ? categoryKey.split('_').pop() : '';
                    const repechage1 = {
                        id: `repechage_1_${categoryKey}_${Date.now()}`,
                        round: 'repechage',
                        matchType: 'repechage',
                        side: 'side1',
                        playerA: qf1Loser.id,
                        playerAName: qf1Loser.name,
                        playerAClub: qf1Loser.club || '',
                        playerASeed: qf1Loser.seed || null,
                        playerACountry: qf1Loser.country || '',
                        playerB: qf2Loser.id,
                        playerBName: qf2Loser.name,
                        playerBClub: qf2Loser.club || '',
                        playerBSeed: qf2Loser.seed || null,
                        playerBCountry: qf2Loser.country || '',
                        winner: null,
                        loser: null,
                        completed: false,
                        status: 'pending',
                        nextMatchId: null, // Set when creating bronze matches
                        category: categoryKey,
                        weight: weight,
                        weightCategory: weight
                    };
                    repechageMatches.push(repechage1);
                    console.log('✅ Created Repechage 1 (Pool A)');
                }
            }

            // Create Repechage 2 (Pool B - QF losers feeding into SF2)
            if (sf2QFs.length === 2) {
                const qf3Loser = this.getMatchLoser(sf2QFs[0]);
                const qf4Loser = this.getMatchLoser(sf2QFs[1]);

                if (qf3Loser && qf4Loser) {
                    const weight = categoryKey ? categoryKey.split('_').pop() : '';
                    const repechage2 = {
                        id: `repechage_2_${categoryKey}_${Date.now()}`,
                        round: 'repechage',
                        matchType: 'repechage',
                        side: 'side2',
                        playerA: qf3Loser.id,
                        playerAName: qf3Loser.name,
                        playerAClub: qf3Loser.club || '',
                        playerASeed: qf3Loser.seed || null,
                        playerACountry: qf3Loser.country || '',
                        playerB: qf4Loser.id,
                        playerBName: qf4Loser.name,
                        playerBClub: qf4Loser.club || '',
                        playerBSeed: qf4Loser.seed || null,
                        playerBCountry: qf4Loser.country || '',
                        winner: null,
                        loser: null,
                        completed: false,
                        status: 'pending',
                        nextMatchId: null, // Set when creating bronze matches
                        category: categoryKey,
                        weight: weight,
                        weightCategory: weight
                    };
                    repechageMatches.push(repechage2);
                    console.log('✅ Created Repechage 2 (Pool B)');
                }
            }

            // Create bronze medal matches with IJF cross-pool pairing
            const bronzeMatches = this.createBronzeMatches(semifinals, repechageMatches, categoryKey);
            repechageMatches.push(...bronzeMatches);

            // Save repechage matches to Firebase
            await this.matchesRef.child(`${categoryKey}/repechage`).set(repechageMatches);

            console.log(`✅ Created ${repechageMatches.length} repechage/bronze matches for ${categoryKey}`);

        } catch (error) {
            console.error('❌ Error creating repechage:', error);
            throw error;
        }
    }

    /**
     * Create bronze medal matches with IJF cross-pool pairing
     */
    createBronzeMatches(semifinals, repechageMatches, categoryKey) {
        const bronzeMatches = [];

        if (semifinals.length !== 2) {
            console.warn('Cannot create bronze matches: need 2 semifinals');
            return bronzeMatches;
        }

        const semifinal1 = semifinals[0]; // Pool A
        const semifinal2 = semifinals[1]; // Pool B

        // Get semifinal losers
        const sf1Loser = this.getMatchLoser(semifinal1);
        const sf2Loser = this.getMatchLoser(semifinal2);

        if (!sf1Loser || !sf2Loser) {
            console.warn('Cannot create bronze matches: semifinal losers not determined');
            return bronzeMatches;
        }

        const repechage1 = repechageMatches.find(m => m.side === 'side1'); // Pool A
        const repechage2 = repechageMatches.find(m => m.side === 'side2'); // Pool B

        // Extract weight from categoryKey
        const weight = categoryKey ? categoryKey.split('_').pop() : '';
        
        // Bronze Match 1: SF2 (Pool B) Loser vs Repechage1 (Pool A) Winner
        const bronze1 = {
            id: `bronze_1_${categoryKey}_${Date.now()}`,
            round: 'bronze',
            matchType: 'bronze',
            playerA: sf2Loser.id,
            playerAName: sf2Loser.name,
            playerAClub: sf2Loser.club || '',
            playerASeed: sf2Loser.seed || null,
            playerACountry: sf2Loser.country || '',
            playerB: null,
            playerBName: 'Repechage 1 Winner',
            playerBClub: '',
            playerBSeed: null,
            playerBCountry: '',
            winner: null,
            loser: null,
            completed: false,
            status: 'pending',
            category: categoryKey,
            weight: weight,
            weightCategory: weight
        };

        // Bronze Match 2: SF1 (Pool A) Loser vs Repechage2 (Pool B) Winner
        const bronze2 = {
            id: `bronze_2_${categoryKey}_${Date.now()}`,
            round: 'bronze',
            matchType: 'bronze',
            playerA: sf1Loser.id,
            playerAName: sf1Loser.name,
            playerAClub: sf1Loser.club || '',
            playerASeed: sf1Loser.seed || null,
            playerACountry: sf1Loser.country || '',
            playerB: null,
            playerBName: 'Repechage 2 Winner',
            playerBClub: '',
            playerBSeed: null,
            playerBCountry: '',
            winner: null,
            loser: null,
            completed: false,
            status: 'pending',
            category: categoryKey,
            weight: weight,
            weightCategory: weight
        };

        // Link repechage to bronze matches (cross-pool pairing)
        if (repechage1) {
            repechage1.nextMatchId = bronze1.id;
            repechage1.winnerTo = 'B';
            console.log('🔗 Linked Repechage 1 (Pool A) → Bronze Match 1');
        }

        if (repechage2) {
            repechage2.nextMatchId = bronze2.id;
            repechage2.winnerTo = 'B';
            console.log('🔗 Linked Repechage 2 (Pool B) → Bronze Match 2');
        }

        bronzeMatches.push(bronze1, bronze2);
        console.log('✅ Created 2 bronze medal matches with IJF cross-pool pairing');

        return bronzeMatches;
    }

    /**
     * Get loser details from a match
     */
    getMatchLoser(match) {
        if (!match.loser && !match.winner) return null;

        const loserId = match.loser || (match.winner === match.playerA ? match.playerB : match.playerA);

        if (!loserId) return null;

        let loserName, loserClub, loserSeed, loserCountry;

        if (match.playerA === loserId) {
            loserName = match.playerAName;
            loserClub = match.playerAClub;
            loserSeed = match.playerASeed;
            loserCountry = match.playerACountry;
        } else {
            loserName = match.playerBName;
            loserClub = match.playerBClub;
            loserSeed = match.playerBSeed;
            loserCountry = match.playerBCountry;
        }

        return {
            id: loserId,
            name: loserName,
            club: loserClub,
            seed: loserSeed,
            country: loserCountry
        };
    }

    /**
     * Process BYE matches automatically
     * Players with BYE advance automatically
     */
    async processByes() {
        try {
            console.log('🔄 Processing BYE matches...');

            const snapshot = await this.matchesRef.once('value');
            const data = snapshot.val();

            if (!data) return;

            // Process each category
            for (const categoryKey of Object.keys(data)) {
                const category = data[categoryKey];

                if (!category.main || !Array.isArray(category.main)) continue;

                const matches = category.main;

                // Find BYE matches
                const byeMatches = matches.filter(m =>
                    (m.playerAName === 'BYE' || m.playerBName === 'BYE') &&
                    m.status !== 'completed' && !m.completed
                );

                if (byeMatches.length === 0) continue;

                console.log(`🔄 Processing ${byeMatches.length} BYE matches in ${categoryKey}`);

                for (const match of byeMatches) {
                    // Determine winner (the non-BYE player)
                    let winnerId, winnerName;

                    if (match.playerAName === 'BYE') {
                        winnerId = match.playerB;
                        winnerName = match.playerBName;
                    } else {
                        winnerId = match.playerA;
                        winnerName = match.playerAName;
                    }

                    // Mark as completed and progress
                    await this.updateMatchStatus(match.id, 'completed', winnerId);
                    await this.progressTournament(match.id, winnerId);

                    console.log(`✅ BYE processed: ${winnerName} advances automatically`);
                }
            }

            console.log('✅ All BYE matches processed');

        } catch (error) {
            console.error('❌ Error processing BYEs:', error);
        }
    }

    /**
     * Get tournament statistics
     */
    async getTournamentStats() {
        try {
            const snapshot = await this.matchesRef.once('value');
            const data = snapshot.val();

            if (!data) return null;

            const stats = {
                categories: {},
                overall: {
                    total: 0,
                    completed: 0,
                    inProgress: 0,
                    pending: 0
                }
            };

            for (const categoryKey of Object.keys(data)) {
                const category = data[categoryKey];
                const allMatches = [
                    ...(category.main || []),
                    ...(category.repechage || [])
                ];

                const categoryStats = {
                    total: allMatches.length,
                    completed: allMatches.filter(m => m.status === 'completed' || m.completed).length,
                    inProgress: allMatches.filter(m => m.status === 'in_progress').length,
                    pending: allMatches.filter(m => m.status === 'pending' && !m.completed).length
                };

                stats.categories[categoryKey] = categoryStats;

                // Add to overall
                stats.overall.total += categoryStats.total;
                stats.overall.completed += categoryStats.completed;
                stats.overall.inProgress += categoryStats.inProgress;
                stats.overall.pending += categoryStats.pending;
            }

            return stats;

        } catch (error) {
            console.error('Error getting tournament stats:', error);
            return null;
        }
    }
}

// Export to global scope
window.IJFTournamentManager = IJFTournamentManager;

console.log('✅ IJF Tournament Manager loaded');
