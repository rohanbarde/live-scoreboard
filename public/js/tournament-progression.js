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

      // Find the completed match (check both main and repechage)
      console.log('🔍 Searching for match:', matchId);
      console.log('📊 Main matches count:', matches.length);
      console.log('📊 Repechage matches count:', repechageMatches.length);
      
      let matchIndex = matches.findIndex(m => m.id === matchId);
      let isRepechageMatch = false;
      let completedMatch;
      
      if (matchIndex === -1) {
        // Check repechage matches
        console.log('🔍 Not found in main, checking repechage...');
        matchIndex = repechageMatches.findIndex(m => m.id === matchId);
        if (matchIndex === -1) {
          console.error('❌ Completed match not found:', matchId);
          console.error('Available main IDs:', matches.map(m => m.id));
          console.error('Available repechage IDs:', repechageMatches.map(m => m.id));
          return;
        }
        completedMatch = repechageMatches[matchIndex];
        isRepechageMatch = true;
        console.log('✅ Found completed repechage match at index:', matchIndex);
      } else {
        completedMatch = matches[matchIndex];
        console.log('✅ Found completed main match at index:', matchIndex);
      }

      console.log('📋 Match data:', completedMatch);
      
      // Record loser for repechage
      const loserId = (winnerId === completedMatch.playerA) ? completedMatch.playerB : completedMatch.playerA;
      
      if (isRepechageMatch) {
        repechageMatches[matchIndex].loser = loserId;
      } else {
        matches[matchIndex].loser = loserId;
      }

      // Find next match for winner
      const nextMatchId = completedMatch.nextMatchId;
      if (!nextMatchId) {
        console.log('🏁 This was a final/bronze match - no next match!');
        
        // Save loser info
        if (data.main && Array.isArray(data.main)) {
          await this.matchesRef.child('main').set(matches);
          if (repechageMatches.length > 0) {
            await this.matchesRef.child('repechage').set(repechageMatches);
          }
        }
        return { success: true, winnerName: completedMatch.playerAName === winnerId ? completedMatch.playerAName : completedMatch.playerBName };
      }

      // Find next match (check both main and repechage)
      console.log('🔍 Searching for next match:', nextMatchId);
      let nextMatchIndex = matches.findIndex(m => m.id === nextMatchId);
      let nextMatchIsRepechage = false;
      let nextMatch;
      
      if (nextMatchIndex === -1) {
        // Check repechage matches
        console.log('🔍 Next match not in main, checking repechage...');
        nextMatchIndex = repechageMatches.findIndex(m => m.id === nextMatchId);
        if (nextMatchIndex === -1) {
          console.error('❌ Next match not found:', nextMatchId);
          console.error('Available main IDs:', matches.map(m => m.id));
          console.error('Available repechage IDs:', repechageMatches.map(m => m.id));
          return;
        }
        nextMatch = repechageMatches[nextMatchIndex];
        nextMatchIsRepechage = true;
        console.log('➡️ Next match found in repechage at index:', nextMatchIndex);
      } else {
        nextMatch = matches[nextMatchIndex];
        console.log('➡️ Next match found in main at index:', nextMatchIndex);
      }

      console.log('📋 Next match data:', nextMatch);

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

      // Update the next match in the correct array
      if (nextMatchIsRepechage) {
        repechageMatches[nextMatchIndex] = { ...nextMatch, ...updates };
      } else {
        matches[nextMatchIndex] = { ...nextMatch, ...updates };
      }

      // Save updated matches back to Firebase
      if (data.main && Array.isArray(data.main)) {
        await this.matchesRef.child('main').set(matches);
        if (repechageMatches.length > 0) {
          await this.matchesRef.child('repechage').set(repechageMatches);
        }
      } else {
        await this.matchesRef.set(matches);
      }

      console.log('✅ Tournament progressed:', winnerName, 'advanced to match', nextMatchId);
      
      // Get the updated match from the correct array
      const updatedNextMatch = nextMatchIsRepechage ? repechageMatches[nextMatchIndex] : matches[nextMatchIndex];
      console.log('📊 Updated match:', updatedNextMatch);

      // Check if next match is now ready (both players assigned)
      if (updatedNextMatch.playerA && updatedNextMatch.playerB && 
          updatedNextMatch.playerAName !== 'BYE' && updatedNextMatch.playerBName !== 'BYE') {
        console.log('🎯 Next match is now ready:', nextMatchId);
      }
      
      // Check if we need to trigger repechage (semifinals just completed)
      if (!nextMatchIsRepechage && updatedNextMatch.matchType === 'final' && updatedNextMatch.playerA && updatedNextMatch.playerB) {
        console.log('🥉 Semifinals complete - triggering repechage creation...');
        await this.createAndScheduleRepechage(matches);
      }

      return {
        success: true,
        nextMatch: updatedNextMatch,
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


// ✅ AUTO ADVANCE WINNER TO NEXT MATCH
if (match.winner && match.nextMatchId) {

  const nextRef = firebase.database().ref(`tournament/matches/${categoryKey}/main`)
    .orderByChild('id')
    .equalTo(match.nextMatchId);

  nextRef.once("value", snap => {
    snap.forEach(s => {
      const update = {};

      if (match.winnerTo === 'A') {
        update.playerA = match.winner;
      } else {
        update.playerB = match.winner;
      }

      s.ref.update(update);
    });
  });
}


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

      // Handle category-based structure
      const firstKey = Object.keys(data)[0];
      const firstValue = data[firstKey];
      
      if (firstValue && typeof firstValue === 'object' && (firstValue.main || firstValue.repechage)) {
        console.log('🔄 Processing BYEs for category-based structure');
        
        // Process each category separately
        for (const categoryKey of Object.keys(data)) {
          const categoryData = data[categoryKey];
          if (!categoryData.main || !Array.isArray(categoryData.main)) continue;
          
          let matches = categoryData.main;
          
          // Find matches with BYE
          const byeMatches = matches.filter(m => 
            (m.playerAName === 'BYE' || m.playerBName === 'BYE') && 
            m.status !== 'completed' && !m.completed
          );

          if (byeMatches.length === 0) continue;
          
          console.log(`🔄 Processing ${byeMatches.length} BYE matches for category: ${categoryKey}`);

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

          // Save updated matches for this category
          await this.matchesRef.child(categoryKey).child('main').set(matches);
          console.log(`✅ BYE matches processed for category: ${categoryKey}`);
        }
      } else {
        // Handle old structure (single category or array)
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
      }

      console.log('✅ All BYE matches processed');

    } catch (error) {
      console.error('❌ Error processing BYEs:', error);
    }
  }
  
  /**
   * Create and schedule repechage matches (IJF Bronze Medal System)
   * For 8-player bracket: QF losers compete, winners face SF losers for bronze
   */
  async createAndScheduleRepechage(mainMatches) {
    try {
      console.log('🥉 Creating IJF repechage brackets...');
      
      // Find the final match and semifinals
      const finalMatch = mainMatches.find(m => m.matchType === 'final');
      if (!finalMatch || !finalMatch.playerA || !finalMatch.playerB) {
        console.log('⚠️ Final not ready yet');
        return;
      }
      
      // Find semifinal matches (matches that feed into the final)
      const semifinals = mainMatches.filter(m => m.nextMatchId === finalMatch.id);
      
      if (semifinals.length !== 2) {
        console.error('❌ Could not find 2 semifinals');
        return;
      }
      
      console.log('🏆 Semifinals found:', semifinals.length);
      
      // Find quarterfinal matches (matches that feed into semifinals)
      const quarterfinals = mainMatches.filter(m => 
        semifinals.some(sf => sf.id === m.nextMatchId)
      );
      
      console.log('📋 Quarterfinals found:', quarterfinals.length);
      
      if (quarterfinals.length !== 4) {
        console.error('❌ Expected 4 quarterfinals, found:', quarterfinals.length);
        return;
      }
      
      // Create repechage matches
      const repechageMatches = [];
      
      // Group quarterfinals by which semifinal they feed into
      const sf1QFs = quarterfinals.filter(qf => qf.nextMatchId === semifinals[0].id);
      const sf2QFs = quarterfinals.filter(qf => qf.nextMatchId === semifinals[1].id);
      
      // M7: Repechage 1 - Losers from QF matches that fed into SF1
      if (sf1QFs.length === 2) {
        const qf1Loser = this.getMatchLoser(sf1QFs[0]);
        const qf2Loser = this.getMatchLoser(sf1QFs[1]);
        
        if (qf1Loser && qf2Loser) {
          const repechage1 = {
            id: `repechage_1_${Date.now()}`,
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
            nextMatchId: null // Will be set when creating bronze matches
          };
          repechageMatches.push(repechage1);
          console.log('✅ Created Repechage 1 (M7)');
        }
      }
      
      // M8: Repechage 2 - Losers from QF matches that fed into SF2
      if (sf2QFs.length === 2) {
        const qf3Loser = this.getMatchLoser(sf2QFs[0]);
        const qf4Loser = this.getMatchLoser(sf2QFs[1]);
        
        if (qf3Loser && qf4Loser) {
          const repechage2 = {
            id: `repechage_2_${Date.now()}`,
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
            nextMatchId: null // Will be set when creating bronze matches
          };
          repechageMatches.push(repechage2);
          console.log('✅ Created Repechage 2 (M8)');
        }
      }
      
      // Create bronze medal matches
      const bronzeMatches = this.createBronzeMatches(mainMatches, semifinals, repechageMatches);
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
   * Create bronze medal matches (IJF 8-player structure)
   * According to IJF rules:
   * - SF1 (Pool A) Loser faces Repechage2 (Pool B) Winner in Bronze Match 2
   * - SF2 (Pool B) Loser faces Repechage1 (Pool A) Winner in Bronze Match 1
   * 
   * M9: Bronze Match 1 = SF2 (Pool B) Loser vs Repechage1 (Pool A) Winner
   * M10: Bronze Match 2 = SF1 (Pool A) Loser vs Repechage2 (Pool B) Winner
   */
  createBronzeMatches(mainMatches, semifinals, repechageMatches) {
    const bronzeMatches = [];
    
    if (semifinals.length !== 2) {
      console.warn('Could not find 2 semifinals');
      return bronzeMatches;
    }
    
    // Get semifinal losers
    // SF1 = Pool A, SF2 = Pool B
    const semifinal1 = semifinals[0]; // Pool A
    const semifinal2 = semifinals[1]; // Pool B
    
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
    
    // Get repechage matches
    // Repechage1 = Pool A losers, Repechage2 = Pool B losers
    const repechage1 = repechageMatches.find(m => m.side === 'side1'); // Pool A
    const repechage2 = repechageMatches.find(m => m.side === 'side2'); // Pool B
    
    // IJF RULE: Cross-pool pairing for bronze matches
    // Bronze Match 1 = SF2 (Pool B) Loser vs Repechage1 (Pool A) Winner
    const bronze1 = {
      id: `bronze_1_${Date.now()}`,
      round: 'bronze',
      matchType: 'bronze',
      playerA: semifinal2Loser, // SF2 (Pool B) Loser
      playerAName: sf2LoserName,
      playerAClub: sf2LoserClub || '',
      playerASeed: sf2LoserSeed || null,
      playerACountry: sf2LoserCountry || '',
      playerB: null, // Will be filled by Repechage1 (Pool A) winner
      playerBName: 'Repechage 1 Winner (Pool A)',
      playerBClub: '',
      playerBSeed: null,
      playerBCountry: '',
      winner: null,
      loser: null,
      completed: false,
      status: 'pending'
    };
    
    // Bronze Match 2 = SF1 (Pool A) Loser vs Repechage2 (Pool B) Winner
    const bronze2 = {
      id: `bronze_2_${Date.now()}`,
      round: 'bronze',
      matchType: 'bronze',
      playerA: semifinal1Loser, // SF1 (Pool A) Loser
      playerAName: sf1LoserName,
      playerAClub: sf1LoserClub || '',
      playerASeed: sf1LoserSeed || null,
      playerACountry: sf1LoserCountry || '',
      playerB: null, // Will be filled by Repechage2 (Pool B) winner
      playerBName: 'Repechage 2 Winner (Pool B)',
      playerBClub: '',
      playerBSeed: null,
      playerBCountry: '',
      winner: null,
      loser: null,
      completed: false,
      status: 'pending'
    };
    
    // Link repechage matches to bronze matches (CROSSED PAIRING)
    if (repechage1) {
      repechage1.nextMatchId = bronze1.id; // Pool A repechage → Bronze Match 1
      repechage1.winnerTo = 'B'; // Repechage1 winner goes to Bronze1 position B
      console.log('🔗 Linked Repechage 1 (Pool A) → Bronze Match 1');
    }
    
    if (repechage2) {
      repechage2.nextMatchId = bronze2.id; // Pool B repechage → Bronze Match 2
      repechage2.winnerTo = 'B'; // Repechage2 winner goes to Bronze2 position B
      console.log('🔗 Linked Repechage 2 (Pool B) → Bronze Match 2');
    }
    
    bronzeMatches.push(bronze1, bronze2);
    console.log('✅ Created Bronze Match 1 (M9): SF2 (Pool B) Loser vs Repechage1 (Pool A) Winner');
    console.log('✅ Created Bronze Match 2 (M10): SF1 (Pool A) Loser vs Repechage2 (Pool B) Winner');
    console.log('📋 IJF Cross-Pool Pairing Applied ✓');
    
    return bronzeMatches;
  }

  generateRepechage(mainMatches) {

    const qfs = mainMatches.filter(m => m.round === 3);
    const sfs = mainMatches.filter(m => m.round === 4);

    if (qfs.length !== 4) return [];

    const repA = [qfs[0], qfs[1]];
    const repB = [qfs[2], qfs[3]];

    const mk = (loserA, loserB, side) => ({
      id: `REP_${side}_${Date.now()}`,
      matchType: "repechage",
      side,
      playerA: loserA.id,
      playerAName: loserA.name,
      playerB: loserB.id,
      playerBName: loserB.name,
      completed: false
    });

    const A = mk(this.getMatchLoser(repA[0]), this.getMatchLoser(repA[1]), "A");
    const B = mk(this.getMatchLoser(repB[0]), this.getMatchLoser(repB[1]), "B");

    return [
      A,
      B,
      {
        id: 'BRONZE_A',
        playerAName: 'Winner Rep A',
        playerBName: this.getMatchLoser(sfs[0])?.name,
      },
      {
        id: 'BRONZE_B',
        playerAName: 'Winner Rep B',
        playerBName: this.getMatchLoser(sfs[1])?.name,
      }
    ];
  }

}

// Export for use in other scripts
window.TournamentProgression = TournamentProgression;
