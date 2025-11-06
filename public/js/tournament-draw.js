// Tournament Draw System
class TournamentDraw {
  constructor() {
    this.database = firebase.database();
    this.playersRef = this.database.ref('registrations').orderByChild('userType').equalTo('player');
    this.matchesRef = this.database.ref('tournament/matches');
    this.players = [];
    this.matches = [];
  }

  // Load all registered players
  async loadPlayers() {
    try {
      const snapshot = await this.playersRef.once('value');
      this.players = [];
      snapshot.forEach(childSnapshot => {
        const player = childSnapshot.val();
        player.id = childSnapshot.key;
        this.players.push(player);
      });
      return this.players;
    } catch (error) {
      console.error('Error loading players:', error);
      throw error;
    }
  }

  // Generate a random seed for players
  seedPlayers() {
    // Simple random shuffle
    return [...this.players].sort(() => Math.random() - 0.5);
  }

  // Generate matches based on number of players
  async generateDraw() {
    try {
      console.log('Starting to generate draw...');
      
      // Load fresh players data
      await this.loadPlayers();
      
      if (this.players.length < 2) {
        throw new Error('Need at least 2 players to create a draw');
      }

      console.log(`Generating draw for ${this.players.length} players`);
      
      // Generate the bracket
      const seededPlayers = this.seedPlayers();
      const matches = this.createBracket(seededPlayers);
      
      // Save to Firebase
      console.log('Saving matches to Firebase...');
      await this.matchesRef.set(matches);
      console.log('Matches saved successfully');
      
      // Update local matches
      this.matches = matches;
      
      return matches;
    } catch (error) {
      console.error('Error generating draw:', error);
      throw error;
    }
  }

  // Create bracket based on number of players
  createBracket(players) {
    console.log('Creating bracket with players:', players);
    const matches = [];
    const numPlayers = players.length;
    let round = 1;
    
    // Create first round matches
    const firstRoundMatches = [];
    for (let i = 0; i < Math.ceil(numPlayers / 2); i++) {
      const playerA = players[i * 2];
      const playerB = players[i * 2 + 1];
      
      const match = {
        id: this.generateId(),
        round,
        playerA: playerA?.id || null,
        playerB: playerB?.id || null,
        winner: null,
        completed: false,
        nextMatchId: null,
        playerAName: playerA?.fullName || null,
        playerBName: playerB?.fullName || null,
        playerAClub: playerA?.playerInfo?.team || null,
        playerBClub: playerB?.playerInfo?.team || null,
        weightCategory: playerA?.playerInfo?.weight ? `${playerA.playerInfo.weight}kg` : null
      };
      
      console.log(`Created match ${match.id}: ${playerA?.fullName || 'BYE'} vs ${playerB?.fullName || 'BYE'}`);
      firstRoundMatches.push(match);
    }
    
    matches.push(...firstRoundMatches);

    // Create subsequent rounds
    let currentRound = firstRoundMatches;
    while (currentRound.length > 1) {
      round++;
      const nextRound = [];
      
      for (let i = 0; i < Math.ceil(currentRound.length / 2); i++) {
        const match = {
          id: this.generateId(),
          round,
          playerA: null,
          playerB: null,
          playerAName: 'Winner of match',
          playerBName: 'Winner of match',
          winner: null,
          completed: false,
          nextMatchId: null
        };
        
        // Link previous matches to this one
        if (currentRound[i * 2]) {
          currentRound[i * 2].nextMatchId = match.id;
        }
        if (currentRound[i * 2 + 1]) {
          currentRound[i * 2 + 1].nextMatchId = match.id;
        }
        
        nextRound.push(match);
      }
      
      matches.push(...nextRound);
      currentRound = nextRound;
    }
    
    console.log('Created bracket with', matches.length, 'matches');
    return matches;
  }

  // Get all matches
  async getAllMatches() {
    try {
      const snapshot = await this.matchesRef.once('value');
      const matches = [];
      
      snapshot.forEach(childSnapshot => {
        matches.push({
          id: childSnapshot.key,
          ...childSnapshot.val()
        });
      });
      
      return matches.sort((a, b) => a.round - b.round);
    } catch (error) {
      console.error('Error getting matches:', error);
      throw error;
    }
  }

  // Update a match
  async updateMatch(updatedMatch) {
    try {
      await this.matchesRef.child(updatedMatch.id).update(updatedMatch);
      return true;
    } catch (error) {
      console.error('Error updating match:', error);
      throw error;
    }
  }

  // Helper to generate unique ID
  generateId() {
    return 'match_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.tournamentDraw = new TournamentDraw();
});
