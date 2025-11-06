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
    // Simple random shuffle for now
    return [...this.players].sort(() => Math.random() - 0.5);
  }

  // Generate matches based on number of players
  async generateDraw() {
    try {
      await this.loadPlayers();
      if (this.players.length < 2) {
        throw new Error('Need at least 2 players to create a draw');
      }

      const seededPlayers = this.seedPlayers();
      this.matches = this.createBracket(seededPlayers);
      
      // Save matches to Firebase
      await this.matchesRef.set(this.matches);
      
      return this.matches;
    } catch (error) {
      console.error('Error generating draw:', error);
      throw error;
    }
  }

  // Create bracket based on number of players
  createBracket(players) {
    const matches = [];
    const numPlayers = players.length;
    let round = 1;
    
    // Create first round matches
    const firstRoundMatches = [];
    for (let i = 0; i < Math.ceil(numPlayers / 2); i++) {
      const match = {
        id: this.generateId(),
        round,
        playerA: players[i * 2]?.id || null,
        playerB: players[i * 2 + 1]?.id || null,
        winner: null,
        completed: false,
        nextMatchId: null
      };
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

    return matches;
  }

  // Get upcoming matches for a player
  async getUpcomingMatches(playerId) {
    try {
      const snapshot = await this.matchesRef.once('value');
      const matches = [];
      
      snapshot.forEach(childSnapshot => {
        const match = childSnapshot.val();
        if ((match.playerA === playerId || match.playerB === playerId) && !match.completed) {
          matches.push({
            id: childSnapshot.key,
            ...match
          });
        }
      });
      
      return matches.sort((a, b) => a.round - b.round);
    } catch (error) {
      console.error('Error getting upcoming matches:', error);
      throw error;
    }
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

  // Helper to generate unique ID
  generateId() {
    return 'match_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.tournamentDraw = new TournamentDraw();
});
