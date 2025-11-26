/**
 * IJF (International Judo Federation) Pooling System
 * 
 * Comprehensive tournament structure generator for 2-32 players
 * Implements IJF rules for seeding, bracket generation, and repechage
 * 
 * Features:
 * - Dynamic bracket sizing (2, 3, 4, 5, 6, 7, 8, 12, 16, 24, 32 players)
 * - IJF-compliant seeding based on player rankings
 * - Automatic pool formation when necessary
 * - Proper repechage rounds following IJF rules
 * - Correct match count at each stage
 * - Seamless tournament phase transitions
 * 
 * @version 3.0
 * @author IJF Tournament System
 */

class IJFPoolingSystem {
    constructor() {
        this.database = firebase.database();
        this.matchesRef = this.database.ref('tournament/matches');
    }

    /**
     * Main entry point: Generate complete IJF tournament structure
     * 
     * @param {Array} players - Array of player objects
     * @param {Array} seeds - Array of player IDs in seed order
     * @param {string} categoryKey - Category identifier
     * @returns {Object} Complete tournament structure
     */
    generateTournament(players, seeds = [], categoryKey = 'default') {
        console.log(`\n🏆 IJF POOLING SYSTEM: Generating tournament for ${players.length} players`);
        console.log(`📊 Category: ${categoryKey}`);
        console.log(`🎯 Seeds: ${seeds.length}`);

        const numPlayers = players.length;

        // Validate player count
        if (numPlayers < 1) {
            throw new Error('Minimum 1 player required for tournament');
        }
        if (numPlayers > 64) {
            throw new Error('Maximum 64 players supported');
        }

        // Determine tournament structure based on player count
        const structure = this.determineTournamentStructure(numPlayers);
        console.log(`\n📋 Tournament Structure:`, structure);

        // Apply IJF seeding
        const seededBracket = this.applyIJFSeeding(players, seeds, structure.bracketSize);
        
        // Validate and fix BYE vs BYE matches
        const validatedBracket = this.validateNoByeVsBye(seededBracket);
        
        console.log('\n📋 Bracket Validation:');
        this.printBracketSlots(validatedBracket);

        // Generate matches based on structure
        let tournament;
        if (structure.usesPools) {
            tournament = this.generatePoolTournament(seededBracket, structure, categoryKey);
        } else {
            tournament = this.generateDirectEliminationTournament(seededBracket, structure, categoryKey);
        }

        // Add tournament metadata
        tournament.metadata = {
            numPlayers,
            bracketSize: structure.bracketSize,
            totalMatches: structure.totalMatches,
            usesPools: structure.usesPools,
            repechageEnabled: structure.repechageEnabled,
            categoryKey,
            generatedAt: Date.now()
        };

        console.log(`\n✅ Tournament generated successfully`);
        console.log(`   Total matches: ${structure.totalMatches}`);
        console.log(`   Main bracket: ${tournament.main.length}`);
        console.log(`   Pools: ${structure.usesPools ? 'Yes' : 'No'}`);
        console.log(`   Repechage: ${structure.repechageEnabled ? 'Yes' : 'No'}\n`);

        return tournament;
    }

    /**
     * Determine tournament structure based on player count
     * 
     * IJF Rules:
     * - 2-5 players: Direct elimination, no repechage
     * - 6-32 players: Direct elimination with repechage
     * - Pools may be used for specific formats
     */
    determineTournamentStructure(numPlayers) {
        const structure = {
            numPlayers,
            bracketSize: this.getNextPowerOf2(numPlayers),
            usesPools: false,
            repechageEnabled: numPlayers >= 6,
            rounds: [],
            totalMatches: 0
        };

        // Calculate rounds
        const bracketSize = structure.bracketSize;
        let currentSize = bracketSize;
        let roundNum = 1;

        while (currentSize > 1) {
            const matchesInRound = currentSize / 2;
            const roundName = this.getRoundName(currentSize, bracketSize);
            
            structure.rounds.push({
                round: roundNum,
                name: roundName,
                matches: matchesInRound,
                playersRemaining: currentSize
            });

            currentSize /= 2;
            roundNum++;
        }

        // Calculate total main bracket matches
        structure.totalMatches = bracketSize - 1;

        // Add repechage matches if enabled
        if (structure.repechageEnabled) {
            const repechageMatches = this.calculateRepechageMatches(bracketSize);
            structure.repechageMatches = repechageMatches;
            structure.totalMatches += repechageMatches;
        }

        return structure;
    }

    /**
     * Calculate number of repechage matches based on bracket size
     * 
     * IJF Repechage Rules:
     * - All players who lose to a finalist enter repechage
     * - Two repechage brackets (one for each finalist's path)
     * - Two bronze medal matches
     */
    calculateRepechageMatches(bracketSize) {
        if (bracketSize < 8) return 0;

        // Number of quarterfinals determines repechage structure
        const quarterfinalsCount = bracketSize / 4;
        
        // Each side has (quarterfinalsCount / 2) losers
        // They compete in repechage: (quarterfinalsCount / 2) - 1 matches per side
        const repechagePerSide = (quarterfinalsCount / 2) - 1;
        
        // Total: 2 repechage sides + 2 bronze matches
        return (repechagePerSide * 2) + 2;
    }

    /**
     * Get round name based on position in bracket
     */
    getRoundName(playersRemaining, bracketSize) {
        if (playersRemaining === 2) return 'Final';
        if (playersRemaining === 4) return 'Semifinals';
        if (playersRemaining === 8) return 'Quarterfinals';
        if (playersRemaining === 16) return 'Round of 16';
        if (playersRemaining === 32) return 'Round of 32';
        return `Round ${Math.log2(bracketSize) - Math.log2(playersRemaining) + 1}`;
    }

    /**
     * Apply IJF seeding to players
     * 
     * IJF Seeding Rules:
     * - Seed 1 at position 0 (top)
     * - Seed 2 at last position (bottom)
     * - Seed 3 and 4 in opposite quarters
     * - Seeds 5-8 distributed to avoid early meetings
     */
    applyIJFSeeding(players, seeds, bracketSize) {
        const bracket = new Array(bracketSize).fill(null);
        
        // Get seeded players
        const seededPlayers = seeds.map(id => players.find(p => p.id === id)).filter(p => p);
        const unseededPlayers = players.filter(p => !seeds.includes(p.id));
        
        // Shuffle unseeded players
        const shuffledUnseeded = this.shuffleArray([...unseededPlayers]);
        
        // Get IJF seed positions
        const seedPositions = this.getIJFSeedPositions(bracketSize);
        
        // Place seeded players
        seededPlayers.forEach((player, index) => {
            if (index < seedPositions.length) {
                const position = seedPositions[index];
                bracket[position] = { ...player, seed: index + 1 };
                console.log(`   Seed ${index + 1}: ${player.fullName} → Position ${position}`);
            }
        });
        
        // Fill remaining positions with unseeded players
        let unseededIndex = 0;
        for (let i = 0; i < bracket.length; i++) {
            if (bracket[i] === null && unseededIndex < shuffledUnseeded.length) {
                bracket[i] = shuffledUnseeded[unseededIndex++];
            }
        }
        
        return bracket;
    }

    /**
     * Get IJF seed positions for bracket size
     * 
     * Standard IJF positioning ensures:
     * - Top seeds don't meet until later rounds
     * - Bracket balance
     * - Fair competition
     */
    getIJFSeedPositions(size) {
        const positions = {
            2: [0, 1],
            4: [0, 3, 2, 1],
            8: [0, 7, 4, 3, 2, 5, 6, 1],
            16: [0, 15, 8, 7, 4, 11, 12, 3, 2, 13, 10, 5, 6, 9, 14, 1],
            32: [0, 31, 16, 15, 8, 23, 24, 7, 4, 27, 20, 11, 12, 19, 28, 3,
                 2, 29, 18, 13, 10, 21, 26, 5, 6, 25, 22, 9, 14, 17, 30, 1],
            64: [0, 63, 32, 31, 16, 47, 48, 15, 8, 55, 40, 23, 24, 39, 56, 7,
                 4, 59, 36, 27, 20, 43, 52, 11, 12, 51, 44, 19, 28, 35, 60, 3,
                 2, 61, 34, 29, 18, 45, 50, 13, 10, 53, 42, 21, 26, 37, 58, 5,
                 6, 57, 38, 25, 22, 41, 54, 9, 14, 49, 46, 17, 30, 33, 62, 1]
        };
        
        return positions[size] || positions[8];
    }

    /**
     * Generate direct elimination tournament (no pools)
     */
    generateDirectEliminationTournament(seededBracket, structure, categoryKey) {
        const matches = [];
        let matchCounter = 1;
        
        // Create first round matches
        const firstRoundMatches = [];
        for (let i = 0; i < seededBracket.length / 2; i++) {
            const playerA = seededBracket[i * 2];
            const playerB = seededBracket[i * 2 + 1];
            
            if (!playerA && !playerB) {
              matches.push({
                id: this.generateMatchId(),
                round: 1,
                matchType: 'empty',
                status: 'skipped',
                completed: true
              });
              continue;
            }


            
            const match = this.createMatch({
                round: 1,
                matchNumber: matchCounter++,
                playerA,
                playerB,
                categoryKey,
                pool: this.getPoolForPosition(i * 2, seededBracket.length)
            });
            
            firstRoundMatches.push(match);
        }
        
        matches.push(...firstRoundMatches);
        
        // Create subsequent rounds
        let currentRound = firstRoundMatches;
        let roundNumber = 2;
        
        while (currentRound.length > 1) {
            const nextRound = [];
            
            for (let i = 0; i < currentRound.length / 2; i++) {
                const match = this.createMatch({
                    round: roundNumber,
                    matchNumber: matchCounter++,
                    playerA: null,
                    playerB: null,
                    categoryKey,
                    isFinal: currentRound.length === 2
                });
                
                // Link previous matches
                if (currentRound[i * 2]) {
                    currentRound[i * 2].nextMatchId = match.id;
                    currentRound[i * 2].winnerTo = 'A';
                }
                if (currentRound[i * 2 + 1]) {
                    currentRound[i * 2 + 1].nextMatchId = match.id;
                    currentRound[i * 2 + 1].winnerTo = 'B';
                }
                
                nextRound.push(match);
            }
            
            matches.push(...nextRound);
            currentRound = nextRound;
            roundNumber++;
        }
        
        return {
            main: matches,
            repechage: [] // Will be created automatically after semifinals
        };
    }

    /**
     * Generate pool-based tournament
     * Used for specific formats (e.g., team competitions)
     */
//    generatePoolTournament(seededBracket, structure, categoryKey) {
//        // For now, use direct elimination
//        // Pool system can be expanded later for team competitions
//        return this.generateDirectEliminationTournament(seededBracket, structure, categoryKey);
//    }

    /**
     * Get pool assignment for a position in the bracket
     */
    getPoolForPosition(position, bracketSize) {
        // IJF Rule: Always 4 pools (A, B, C, D)
        const perPool = bracketSize / 4;
        const poolIndex = Math.floor(position / perPool);
        return ["A", "B", "C", "D"][poolIndex] || "D";
    }

    /**
     * Create a match object
     */
    createMatch({ round, matchNumber, playerA, playerB, categoryKey, isFinal = false, pool = null }) {
        const match = {
            id: this.generateMatchId(),
            round,
            matchNumber,
            matchType: isFinal ? 'final' : 'main',
            pool: pool,
            playerA: playerA?.id || null,
            playerB: playerB?.id || null,
            playerAName: playerA?.fullName || (playerB ? 'BYE' : 'TBD'),
            playerBName: playerB?.fullName || (playerA ? 'BYE' : 'TBD'),
            playerAClub: playerA?.playerInfo?.team || playerA?.team || '',
            playerBClub: playerB?.playerInfo?.team || playerB?.team || '',
            playerASeed: playerA?.seed || null,
            playerBSeed: playerB?.seed || null,
            playerACountry: playerA?.playerInfo?.country || playerA?.country || '',
            playerBCountry: playerB?.playerInfo?.country || playerB?.country || '',
            winner: null,
            loser: null,
            completed: false,
            status: 'pending',
            nextMatchId: null,
            winnerTo: null,
            category: categoryKey
        };
        
        // Auto-complete BYE matches
        if (playerA && !playerB) {
          match.winner = playerA.id;
          match.completed = true;
          match.status = 'completed';
          match.winByBye = true;
        }

        if (playerB && !playerA) {
          match.winner = playerB.id;
          match.completed = true;
          match.status = 'completed';
          match.winByBye = true;
        }
        
        return match;
    }

    /**
     * Get next power of 2 for bracket size
     */
    getNextPowerOf2(n) {
        let power = 2;
        while (power < n) {
            power *= 2;
        }
        return power;
    }

    /**
     * Shuffle array (Fisher-Yates algorithm)
     */
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    /**
     * Generate unique match ID
     */
    generateMatchId() {
        return 'match_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Get tournament statistics
     */
    getTournamentStats(numPlayers) {
        const structure = this.determineTournamentStructure(numPlayers);
        
        return {
            players: numPlayers,
            bracketSize: structure.bracketSize,
            byes: structure.bracketSize - numPlayers,
            rounds: structure.rounds,
            mainMatches: structure.bracketSize - 1,
            repechageMatches: structure.repechageMatches || 0,
            totalMatches: structure.totalMatches,
            repechageEnabled: structure.repechageEnabled
        };
    }

    /**
     * Validate and fix BYE vs BYE matches
     */
    validateNoByeVsBye(bracket) {
        let maxAttempts = 100;
        let attempt = 0;
        
        while (attempt < maxAttempts) {
            let hasDoublebye = false;
            
            // Check all pairs
            for (let i = 0; i < bracket.length; i += 2) {
                if (!bracket[i] && !bracket[i + 1]) {
                    hasDoublebye = true;
                    
                    // Find a player in a different pair to swap with
                    for (let j = 0; j < bracket.length; j++) {
                        // Skip if same pair or not a player
                        if (Math.floor(j / 2) === Math.floor(i / 2) || !bracket[j]) continue;
                        
                        // Swap player with one of the BYEs
                        [bracket[i], bracket[j]] = [bracket[j], bracket[i]];
                        console.log(`   🔄 Fixed BYE vs BYE at positions ${i}-${i+1}, swapped with position ${j}`);
                        break;
                    }
                    break; // Re-check from start after swap
                }
            }
            
            if (!hasDoublebye) {
                console.log(`   ✅ No BYE vs BYE matches found after ${attempt + 1} attempts`);
                break;
            }
            
            attempt++;
        }
        
        if (attempt >= maxAttempts) {
            console.warn('   ⚠️ Could not eliminate all BYE vs BYE matches');
        }
        
        return bracket;
    }

    /**
     * Print bracket slots for debugging
     */
    printBracketSlots(bracket) {
        console.log('   Bracket slots:');
        for (let i = 0; i < bracket.length; i += 2) {
            const playerA = bracket[i]?.fullName || 'BYE';
            const playerB = bracket[i + 1]?.fullName || 'BYE';
            const pool = this.getPoolForPosition(i, bracket.length);
            console.log(`   Match ${i/2 + 1} (Pool ${pool}): ${playerA} vs ${playerB}`);
        }
    }

    /**
     * Print tournament structure (for debugging)
     */
    printTournamentStructure(numPlayers) {
        const stats = this.getTournamentStats(numPlayers);
        
        console.log(`\n╔═══════════════════════════════════════════════════════╗`);
        console.log(`║  IJF TOURNAMENT STRUCTURE - ${numPlayers} PLAYERS`.padEnd(56) + '║');
        console.log(`╚═══════════════════════════════════════════════════════╝`);
        console.log(`\n📊 Bracket Information:`);
        console.log(`   Players: ${stats.players}`);
        console.log(`   Bracket Size: ${stats.bracketSize}`);
        console.log(`   BYEs: ${stats.byes}`);
        console.log(`\n🎯 Match Breakdown:`);
        console.log(`   Main Bracket: ${stats.mainMatches} matches`);
        if (stats.repechageEnabled) {
            console.log(`   Repechage: ${stats.repechageMatches} matches`);
            console.log(`   Total: ${stats.totalMatches} matches`);
        } else {
            console.log(`   Repechage: Not applicable`);
            console.log(`   Total: ${stats.mainMatches} matches`);
        }
        console.log(`\n📋 Round Structure:`);
        stats.rounds.forEach(round => {
            console.log(`   Round ${round.round} (${round.name}): ${round.matches} matches`);
        });
        console.log(``);
    }
}

// Export to global scope
window.IJFPoolingSystem = IJFPoolingSystem;

console.log('✅ IJF Pooling System loaded');
