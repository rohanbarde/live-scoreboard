/**
 * Tournament Progression Manager
 * Handles automatic advancement of winners to next round matches
 * Follows IJF bracket structure and rules
 */

class TournamentProgression {
  constructor() {
    this.database = firebase.database();
    this.matchesRef = this.database.ref('tournament/matches');
  }

  /**
   * Handle match completion and progress tournament
   */
  async onMatchComplete(matchId, winnerId) {
    try {
      console.log('🏆 Processing match completion:', matchId, 'Winner:', winnerId);
      
      // Load all matches
      const snapshot = await this.matchesRef.once('value');
      const data = snapshot.val();
      
      if (!data) {
        console.error('No tournament data found');
        return;
      }

      // Get matches array
      let matches = [];
      let repechageMatches = [];
      if (data.main && Array.isArray(data.main)) {
        matches = data.main;
        repechageMatches = data.repechage || [];
      } else if (Array.isArray(data)) {
        matches = data;
      } else {
        console.error('Invalid matches structure');
        return;
      }

      // Find the completed match
      const matchIndex = matches.findIndex(m => m.id === matchId);
      if (matchIndex === -1) {
        console.error('Completed match not found:', matchId);
        return;
      }

      const completedMatch = matches[matchIndex];
      console.log('✅ Found completed match:', completedMatch);
      
      // Record loser for repechage
      const loserId = (winnerId === completedMatch.playerA) ? completedMatch.playerB : completedMatch.playerA;
      matches[matchIndex].loser = loserId;

      // Find next match for winner
      const nextMatchId = completedMatch.nextMatchId;
      if (!nextMatchId) {
        console.log('🏁 This was a final match - tournament complete!');
        
        // Save loser info
        if (data.main && Array.isArray(data.main)) {
          await this.matchesRef.child('main').set(matches);
        }
        return;
      }

      // Find next match
      const nextMatchIndex = matches.findIndex(m => m.id === nextMatchId);
      if (nextMatchIndex === -1) {
        console.error('Next match not found:', nextMatchId);
        return;
      }

      const nextMatch = matches[nextMatchIndex];
      console.log('➡️ Next match found:', nextMatch);

      // Determine which position the winner advances to
      let position = completedMatch.winnerTo; // 'A' or 'B'
      
      // Fallback: If winnerTo is not set, determine position based on bracket structure
      if (!position) {
        // Find all matches that feed into this next match
        const feedingMatches = matches.filter(m => m.nextMatchId === nextMatchId);
        const matchIndexInFeeding = feedingMatches.findIndex(m => m.id === matchId);
        
        // First match goes to A, second goes to B
        position = (matchIndexInFeeding === 0) ? 'A' : 'B';
        console.log('⚠️ winnerTo not set, using fallback position:', position);
      }
      
      // Get winner details
      let winnerName, winnerClub, winnerSeed, winnerCountry, winnerPlayerId;
      
      if (winnerId === completedMatch.playerA) {
        winnerName = completedMatch.playerAName;
        winnerClub = completedMatch.playerAClub;
        winnerSeed = completedMatch.playerASeed;
        winnerCountry = completedMatch.playerACountry;
        winnerPlayerId = completedMatch.playerA;
      } else if (winnerId === completedMatch.playerB) {
        winnerName = completedMatch.playerBName;
        winnerClub = completedMatch.playerBClub;
        winnerSeed = completedMatch.playerBSeed;
        winnerCountry = completedMatch.playerBCountry;
        winnerPlayerId = completedMatch.playerB;
      } else {
        console.error('Winner ID does not match either player');
        return;
      }

      // Update next match with winner
      const updates = {};
      
      if (position === 'A') {
        updates.playerA = winnerPlayerId;
        updates.playerAName = winnerName;
        updates.playerAClub = winnerClub || '';
        updates.playerASeed = winnerSeed || null;
        updates.playerACountry = winnerCountry || '';
      } else if (position === 'B') {
        updates.playerB = winnerPlayerId;
        updates.playerBName = winnerName;
        updates.playerBClub = winnerClub || '';
        updates.playerBSeed = winnerSeed || null;
        updates.playerBCountry = winnerCountry || '';
      }

      // Update the next match in the array
      matches[nextMatchIndex] = { ...nextMatch, ...updates };

      // Save updated matches back to Firebase
      if (data.main && Array.isArray(data.main)) {
        await this.matchesRef.child('main').set(matches);
      } else {
        await this.matchesRef.set(matches);
      }

      console.log('✅ Tournament progressed:', winnerName, 'advanced to match', nextMatchId);
      console.log('📊 Updated match:', matches[nextMatchIndex]);

      // Check if next match is now ready (both players assigned)
      const updatedNextMatch = matches[nextMatchIndex];
      if (updatedNextMatch.playerA && updatedNextMatch.playerB && 
          updatedNextMatch.playerAName !== 'BYE' && updatedNextMatch.playerBName !== 'BYE') {
        console.log('🎯 Next match is now ready:', nextMatchId);
      }
      
      // Check if we need to trigger repechage (semifinals just completed)
      if (updatedNextMatch.matchType === 'final' && updatedNextMatch.playerA && updatedNextMatch.playerB) {
        console.log('🥉 Semifinals complete - triggering repechage creation...');
        await this.createAndScheduleRepechage(matches);
      }

      return {
        success: true,
        nextMatch: matches[nextMatchIndex],
        winnerName: winnerName
      };

    } catch (error) {
      console.error('❌ Error progressing tournament:', error);
      throw error;
    }
  }

  /**
   * Get tournament status and statistics
   */
  async getTournamentStatus() {
    try {
      const snapshot = await this.matchesRef.once('value');
      const data = snapshot.val();
      
      if (!data) return null;

      let matches = [];
      if (data.main && Array.isArray(data.main)) {
        matches = data.main;
      } else if (Array.isArray(data)) {
        matches = data;
      }

      const total = matches.length;
      const completed = matches.filter(m => m.status === 'completed' || m.completed).length;
      const inProgress = matches.filter(m => m.status === 'in_progress').length;
      const pending = matches.filter(m => {
        const status = m.status || (m.completed ? 'completed' : 'pending');
        return status === 'pending' && m.playerAName !== 'TBD' && m.playerBName !== 'TBD';
      }).length;
      const notReady = matches.filter(m => m.playerAName === 'TBD' || m.playerBName === 'TBD').length;

      // Find final match
      const finalMatch = matches.find(m => m.matchType === 'final');
      const tournamentComplete = finalMatch && (finalMatch.status === 'completed' || finalMatch.completed);

      return {
        total,
        completed,
        inProgress,
        pending,
        notReady,
        tournamentComplete,
        champion: tournamentComplete ? (finalMatch.winner === finalMatch.playerA ? finalMatch.playerAName : finalMatch.playerBName) : null
      };

    } catch (error) {
      console.error('Error getting tournament status:', error);
      return null;
    }
  }

  /**
   * Check if a match is ready to be played
   */
  isMatchReady(match) {
    // Match is ready if both players are assigned and not TBD
    return match.playerA && match.playerB && 
           match.playerAName && match.playerBName &&
           match.playerAName !== 'TBD' && match.playerBName !== 'TBD' &&
           match.playerAName !== 'BYE' && match.playerBName !== 'BYE';
  }

  /**
   * Get next available matches (ready to play)
   */
  async getNextAvailableMatches() {
    try {
      const snapshot = await this.matchesRef.once('value');
      const data = snapshot.val();
      
      if (!data) return [];

      let matches = [];
      if (data.main && Array.isArray(data.main)) {
        matches = data.main;
      } else if (Array.isArray(data)) {
        matches = data;
      }

      // Filter matches that are ready and pending
      return matches.filter(m => {
        const status = m.status || (m.completed ? 'completed' : 'pending');
        return status === 'pending' && this.isMatchReady(m);
      });

    } catch (error) {
      console.error('Error getting available matches:', error);
      return [];
    }
  }

  /**
   * Handle BYE advancement (when a player has a BYE, they automatically advance)
   */
  async processByes() {
    try {
      const snapshot = await this.matchesRef.once('value');
      const data = snapshot.val();
      
      if (!data) return;

      let matches = [];
      if (data.main && Array.isArray(data.main)) {
        matches = data.main;
      } else if (Array.isArray(data)) {
        matches = data;
      }

      // Find matches with BYE
      const byeMatches = matches.filter(m => 
        (m.playerAName === 'BYE' || m.playerBName === 'BYE') && 
        m.status !== 'completed' && !m.completed
      );

      console.log('🔄 Processing', byeMatches.length, 'BYE matches');

      for (const match of byeMatches) {
        // Determine winner (the player who is not BYE)
        let winnerId, winnerName, winnerClub, winnerSeed, winnerCountry;
        
        if (match.playerAName === 'BYE') {
          winnerId = match.playerB;
          winnerName = match.playerBName;
          winnerClub = match.playerBClub;
          winnerSeed = match.playerBSeed;
          winnerCountry = match.playerBCountry;
        } else {
          winnerId = match.playerA;
          winnerName = match.playerAName;
          winnerClub = match.playerAClub;
          winnerSeed = match.playerASeed;
          winnerCountry = match.playerACountry;
        }

        // Mark match as completed
        const matchIndex = matches.findIndex(m => m.id === match.id);
        matches[matchIndex] = {
          ...match,
          status: 'completed',
          completed: true,
          winner: winnerId,
          byeAdvancement: true
        };

        console.log('✅ BYE processed:', winnerName, 'advances automatically');

        // Progress to next round
        await this.onMatchComplete(match.id, winnerId);
      }

      // Save updated matches
      if (data.main && Array.isArray(data.main)) {
        await this.matchesRef.child('main').set(matches);
      } else {
        await this.matchesRef.set(matches);
      }

      console.log('✅ All BYE matches processed');

    } catch (error) {
      console.error('❌ Error processing BYEs:', error);
    }
  }
  
  /**
   * Create and schedule repechage matches (IJF Bronze Medal System)
   */
  async createAndScheduleRepechage(mainMatches) {
    try {
      console.log('🥉 Creating repechage brackets...');
      
      // Find the final match
      const finalMatch = mainMatches.find(m => m.matchType === 'final');
      if (!finalMatch || !finalMatch.playerA || !finalMatch.playerB) {
        console.log('⚠️ Final not ready yet');
        return;
      }
      
      const finalist1 = finalMatch.playerA;
      const finalist2 = finalMatch.playerB;
      
      console.log('🏆 Finalists identified:', finalist1, finalist2);
      
      // Get all losers to each finalist (players who lost to the finalists)
      const finalist1Losers = this.getLosersToPlayer(mainMatches, finalist1);
      const finalist2Losers = this.getLosersToPlayer(mainMatches, finalist2);
      
      console.log('📋 Finalist 1 losers:', finalist1Losers.length);
      console.log('📋 Finalist 2 losers:', finalist2Losers.length);
      
      // Create repechage matches
      const repechageMatches = [];
      
      // Side 1 repechage (losers to finalist 1)
      if (finalist1Losers.length > 0) {
        const side1Matches = this.createRepechageRounds(finalist1Losers, mainMatches, 'side1');
        repechageMatches.push(...side1Matches);
      }
      
      // Side 2 repechage (losers to finalist 2)
      if (finalist2Losers.length > 0) {
        const side2Matches = this.createRepechageRounds(finalist2Losers, mainMatches, 'side2');
        repechageMatches.push(...side2Matches);
      }
      
      // Create bronze medal matches
      const bronzeMatches = this.createBronzeMatches(mainMatches, repechageMatches);
      repechageMatches.push(...bronzeMatches);
      
      // Save repechage matches to Firebase
      await this.matchesRef.child('repechage').set(repechageMatches);
      
      console.log('✅ Repechage created:', repechageMatches.length, 'matches');
      console.log('🥉 Bronze medal matches scheduled');
      
      return repechageMatches;
      
    } catch (error) {
      console.error('❌ Error creating repechage:', error);
      throw error;
    }
  }
  
  /**
   * Get all players who lost to a specific finalist
   */
  getLosersToPlayer(matches, playerId) {
    const losers = [];
    
    // Find all matches where this player won
    const playerWins = matches.filter(m => m.winner === playerId && m.completed);
    
    playerWins.forEach(match => {
      // Get the loser from each match
      const loserId = match.loser || (match.playerA === playerId ? match.playerB : match.playerA);
      
      if (loserId && loserId !== playerId) {
        // Get loser details
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
        
        losers.push({
          id: loserId,
          name: loserName,
          club: loserClub,
          seed: loserSeed,
          country: loserCountry
        });
      }
    });
    
    return losers;
  }
  
  /**
   * Create repechage rounds for one side
   */
  createRepechageRounds(losers, mainMatches, side) {
    const matches = [];
    
    if (losers.length === 0) return matches;
    
    // For IJF rules: Start from the most recent loser (semifinal loser)
    // and work backwards through earlier round losers
    
    // Sort losers by when they lost (round number)
    const sortedLosers = [...losers].reverse();
    
    let round = 1;
    let currentPlayers = sortedLosers;
    
    // Create repechage rounds
    while (currentPlayers.length > 1) {
      const roundMatches = [];
      
      for (let i = 0; i < Math.floor(currentPlayers.length / 2); i++) {
        const playerA = currentPlayers[i * 2];
        const playerB = currentPlayers[i * 2 + 1];
        
        const match = {
          id: `repechage_${side}_r${round}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          round: round,
          matchType: 'repechage',
          side: side,
          playerA: playerA.id,
          playerB: playerB.id,
          playerAName: playerA.name,
          playerBName: playerB.name,
          playerAClub: playerA.club || '',
          playerBClub: playerB.club || '',
          playerASeed: playerA.seed || null,
          playerBSeed: playerB.seed || null,
          playerACountry: playerA.country || '',
          playerBCountry: playerB.country || '',
          winner: null,
          loser: null,
          completed: false,
          status: 'pending',
          nextMatchId: null
        };
        
        roundMatches.push(match);
      }
      
      matches.push(...roundMatches);
      
      // Winners advance to next round
      currentPlayers = roundMatches.map(m => ({ id: null, name: 'TBD' }));
      round++;
    }
    
    return matches;
  }
  
  /**
   * Create bronze medal matches
   */
  createBronzeMatches(mainMatches, repechageMatches) {
    const bronzeMatches = [];
    
    // Find semifinal matches
    const semifinals = mainMatches.filter(m => {
      const finalMatch = mainMatches.find(fm => fm.matchType === 'final');
      return finalMatch && m.nextMatchId === finalMatch.id;
    });
    
    if (semifinals.length !== 2) {
      console.warn('Could not find 2 semifinals');
      return bronzeMatches;
    }
    
    // Get semifinal losers
    const semifinal1 = semifinals[0];
    const semifinal2 = semifinals[1];
    
    const semifinal1Loser = semifinal1.loser || (semifinal1.winner === semifinal1.playerA ? semifinal1.playerB : semifinal1.playerA);
    const semifinal2Loser = semifinal2.loser || (semifinal2.winner === semifinal2.playerA ? semifinal2.playerB : semifinal2.playerA);
    
    // Get loser details
    let sf1LoserName, sf1LoserClub, sf1LoserSeed, sf1LoserCountry;
    let sf2LoserName, sf2LoserClub, sf2LoserSeed, sf2LoserCountry;
    
    if (semifinal1.playerA === semifinal1Loser) {
      sf1LoserName = semifinal1.playerAName;
      sf1LoserClub = semifinal1.playerAClub;
      sf1LoserSeed = semifinal1.playerASeed;
      sf1LoserCountry = semifinal1.playerACountry;
    } else {
      sf1LoserName = semifinal1.playerBName;
      sf1LoserClub = semifinal1.playerBClub;
      sf1LoserSeed = semifinal1.playerBSeed;
      sf1LoserCountry = semifinal1.playerBCountry;
    }
    
    if (semifinal2.playerA === semifinal2Loser) {
      sf2LoserName = semifinal2.playerAName;
      sf2LoserClub = semifinal2.playerAClub;
      sf2LoserSeed = semifinal2.playerASeed;
      sf2LoserCountry = semifinal2.playerACountry;
    } else {
      sf2LoserName = semifinal2.playerBName;
      sf2LoserClub = semifinal2.playerBClub;
      sf2LoserSeed = semifinal2.playerBSeed;
      sf2LoserCountry = semifinal2.playerBCountry;
    }
    
    // Get repechage winners (if repechage matches exist)
    const side1Winner = repechageMatches.find(m => m.side === 'side1' && !m.nextMatchId);
    const side2Winner = repechageMatches.find(m => m.side === 'side2' && !m.nextMatchId);
    
    // Bronze Match 1: Repechage Side 1 Winner vs Semifinal 2 Loser
    const bronze1 = {
      id: `bronze_1_${Date.now()}`,
      round: 'bronze',
      matchType: 'bronze',
      playerA: side1Winner ? null : semifinal1Loser, // Will be filled by repechage winner
      playerB: semifinal2Loser,
      playerAName: side1Winner ? 'Repechage Winner (Side 1)' : sf1LoserName,
      playerBName: sf2LoserName,
      playerAClub: side1Winner ? '' : sf1LoserClub,
      playerBClub: sf2LoserClub,
      playerASeed: side1Winner ? null : sf1LoserSeed,
      playerBSeed: sf2LoserSeed,
      playerACountry: side1Winner ? '' : sf1LoserCountry,
      playerBCountry: sf2LoserCountry,
      winner: null,
      completed: false,
      status: 'pending'
    };
    
    // Bronze Match 2: Repechage Side 2 Winner vs Semifinal 1 Loser
    const bronze2 = {
      id: `bronze_2_${Date.now()}`,
      round: 'bronze',
      matchType: 'bronze',
      playerA: side2Winner ? null : semifinal2Loser,
      playerB: semifinal1Loser,
      playerAName: side2Winner ? 'Repechage Winner (Side 2)' : sf2LoserName,
      playerBName: sf1LoserName,
      playerAClub: side2Winner ? '' : sf2LoserClub,
      playerBClub: sf1LoserClub,
      playerASeed: side2Winner ? null : sf2LoserSeed,
      playerBSeed: sf1LoserSeed,
      playerACountry: side2Winner ? '' : sf2LoserCountry,
      playerBCountry: sf1LoserCountry,
      winner: null,
      completed: false,
      status: 'pending'
    };
    
    // Link repechage finals to bronze matches
    if (side1Winner) {
      side1Winner.nextMatchId = bronze1.id;
      side1Winner.winnerTo = 'A';
    }
    
    if (side2Winner) {
      side2Winner.nextMatchId = bronze2.id;
      side2Winner.winnerTo = 'A';
    }
    
    bronzeMatches.push(bronze1, bronze2);
    
    return bronzeMatches;
  }
}

// Export for use in other scripts
window.TournamentProgression = TournamentProgression;
