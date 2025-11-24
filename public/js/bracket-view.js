// Bracket View Renderer for Tournament Matches
class BracketView {
  constructor() {
    this.database = firebase.database();
    this.matchesRef = this.database.ref('tournament/matches');
    this.matches = [];
  }

  // Load matches from Firebase
  async loadMatches() {
    try {
      const snapshot = await this.matchesRef.once('value');
      const matchesData = snapshot.val();
      
      if (!matchesData) {
        console.log('No matches found');
        return null;
      }

      // Handle both data structures: direct array or nested under 'main' and 'repechage'
      if (Array.isArray(matchesData)) {
        this.matches = matchesData;
        this.repechageMatches = [];
      } else if (matchesData.main && Array.isArray(matchesData.main)) {
        this.matches = matchesData.main;
        this.repechageMatches = matchesData.repechage || [];
      } else {
        console.log('Invalid matches data structure');
        return null;
      }

      console.log('Loaded', this.matches.length, 'main matches and', this.repechageMatches.length, 'repechage matches for bracket view');
      return { main: this.matches, repechage: this.repechageMatches };
    } catch (error) {
      console.error('Error loading matches:', error);
      throw error;
    }
  }

  // Group matches into pools based on bracket structure
  groupMatchesIntoPools(matches) {
    if (!matches || matches.length === 0) return [];

    // Get first round matches only
    const firstRoundMatches = matches.filter(m => m.round === 1);
    
    // Calculate pool size based on total matches
    const totalMatches = firstRoundMatches.length;
    let poolSize = 2; // Default: 2 matches per pool
    
    // Determine pool size based on bracket structure
    if (totalMatches >= 16) {
      poolSize = 4; // 4 matches per pool for large brackets
    } else if (totalMatches >= 8) {
      poolSize = 2; // 2 matches per pool for medium brackets
    } else {
      poolSize = 2; // 2 matches per pool for small brackets
    }

    // Group matches into pools
    const pools = [];
    for (let i = 0; i < firstRoundMatches.length; i += poolSize) {
      const poolMatches = firstRoundMatches.slice(i, i + poolSize);
      pools.push({
        name: String.fromCharCode(65 + pools.length), // A, B, C, D...
        matches: poolMatches
      });
    }

    return pools;
  }

  // Get subsequent round matches for a pool
  getPoolProgressionMatches(poolMatches, allMatches) {
    const progressionMatches = [];
    const matchIds = poolMatches.map(m => m.id);

    // Find matches where previous matches are from this pool
    allMatches.forEach(match => {
      if (match.round > 1) {
        // Check if any of the pool matches feed into this match
        const feedsInto = poolMatches.some(pm => pm.nextMatchId === match.id);
        if (feedsInto && !progressionMatches.find(m => m.id === match.id)) {
          progressionMatches.push(match);
        }
      }
    });

    return progressionMatches;
  }

  // Render the complete bracket view
  renderBracket(containerId = 'bracketContainer') {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error('Bracket container not found');
      return;
    }

    console.log('Rendering bracket with', this.matches?.length || 0, 'matches');

    if (!this.matches || this.matches.length === 0) {
      container.innerHTML = `
        <div class="no-draw">
          <i class="fas fa-chess-board"></i>
          <p>No draw has been generated yet.</p>
          <p style="font-size: 14px; color: #6c757d; margin-top: 10px;">
            Generate a tournament draw to see the bracket structure here.
          </p>
          <a href="/views/generate-draws.html" class="btn btn-primary" style="margin-top: 15px;">
            <i class="fas fa-random"></i> Go to Generate Draw
          </a>
        </div>
      `;
      return;
    }

    // Group matches into pools
    const pools = this.groupMatchesIntoPools(this.matches);
    
    // Build HTML
    let html = '<div class="bracket-wrapper">';
    
    // Render pools
    html += '<div class="pools-container">';
    pools.forEach(pool => {
      html += this.renderPool(pool, this.matches);
    });
    html += '</div>';

    // Render progression rounds (semifinals, finals)
    html += this.renderProgressionRounds(this.matches);

    // Render repechage and bronze medal matches
    if (this.repechageMatches && this.repechageMatches.length > 0) {
      html += this.renderRepechageSection(this.repechageMatches);
    }

    html += '</div>';

    container.innerHTML = html;
  }

  // Render a single pool
  renderPool(pool, allMatches) {
    let html = `
      <div class="pool-section">
        <div class="pool-header">
          <h3>Pool ${pool.name}</h3>
        </div>
        <div class="pool-matches">
    `;

    // Render each match in the pool
    pool.matches.forEach((match, index) => {
      html += this.renderMatch(match, index + 1);
    });

    // Get and render progression match for this pool
    const progressionMatches = this.getPoolProgressionMatches(pool.matches, allMatches);
    if (progressionMatches.length > 0) {
      html += `<div class="pool-progression">`;
      progressionMatches.forEach(match => {
        html += this.renderProgressionMatch(match);
      });
      html += `</div>`;
    }

    html += `
        </div>
      </div>
    `;

    return html;
  }

  // Render a single match
  renderMatch(match, matchNumber) {
    const playerAName = match.playerAName || 'TBD';
    const playerBName = match.playerBName || 'TBD';
    const playerAClub = match.playerAClub ? `(${match.playerAClub})` : '';
    const playerBClub = match.playerBClub ? `(${match.playerBClub})` : '';
    const playerASeed = match.playerASeed ? `<span class="seed-badge">${match.playerASeed}</span>` : '';
    const playerBSeed = match.playerBSeed ? `<span class="seed-badge">${match.playerBSeed}</span>` : '';

    const winner = match.winner;
    const playerAClass = winner === match.playerA ? 'winner' : (playerAName === 'TBD' ? 'tbd' : '');
    const playerBClass = winner === match.playerB ? 'winner' : (playerBName === 'TBD' ? 'tbd' : '');

    // Match status indicator
    let statusBadge = '';
    const status = match.status || (match.completed ? 'completed' : 'pending');
    if (status === 'in_progress') {
      statusBadge = '<span class="match-status in-progress">⚔️ In Progress</span>';
    } else if (status === 'completed') {
      statusBadge = '<span class="match-status completed">✅ Complete</span>';
    } else if (playerAName === 'TBD' || playerBName === 'TBD') {
      statusBadge = '<span class="match-status waiting">⏳ Waiting</span>';
    } else if (status === 'locked') {
      statusBadge = '<span class="match-status locked">🔒 Locked</span>';
    }

    return `
      <div class="bracket-match ${status}" data-match-id="${match.id}">
        <div class="match-number">${matchNumber}</div>
        ${statusBadge}
        <div class="match-players">
          <div class="match-player ${playerAClass}">
            <div class="player-name">
              ${playerASeed}
              <span>${playerAName}</span>
              ${playerAName !== 'TBD' ? `<span class="player-club">${playerAClub}</span>` : ''}
            </div>
          </div>
          <div class="match-player ${playerBClass}">
            <div class="player-name">
              ${playerBSeed}
              <span>${playerBName}</span>
              ${playerBName !== 'TBD' ? `<span class="player-club">${playerBClub}</span>` : ''}
            </div>
          </div>
        </div>
        ${match.winner ? `<div class="match-winner-indicator">
          <i class="fas fa-trophy"></i>
        </div>` : ''}
      </div>
    `;
  }

  // Render progression match (quarterfinal/semifinal within pool)
  renderProgressionMatch(match) {
    const playerAName = match.playerAName || 'TBD';
    const playerBName = match.playerBName || 'TBD';
    const winner = match.winner;
    const playerAClass = winner === match.playerA ? 'winner' : '';
    const playerBClass = winner === match.playerB ? 'winner' : '';

    return `
      <div class="progression-match" data-match-id="${match.id}">
        <div class="match-round-label">Round ${match.round}</div>
        <div class="match-players-small">
          <div class="match-player-small ${playerAClass}">${playerAName}</div>
          <div class="vs-small">vs</div>
          <div class="match-player-small ${playerBClass}">${playerBName}</div>
        </div>
      </div>
    `;
  }

  // Render final rounds (semifinals and finals)
  renderProgressionRounds(matches) {
    const semifinals = matches.filter(m => m.round === Math.max(...matches.map(m => m.round)) - 1);
    const finals = matches.filter(m => m.matchType === 'final');

    if (semifinals.length === 0 && finals.length === 0) {
      return '';
    }

    let html = '<div class="finals-section">';

    // Semifinals
    if (semifinals.length > 0) {
      html += `
        <div class="round-column">
          <h3 class="round-title">Semifinals</h3>
          <div class="round-matches">
      `;
      semifinals.forEach((match, idx) => {
        html += this.renderFinalMatch(match, idx + 1);
      });
      html += `</div></div>`;
    }

    // Finals
    if (finals.length > 0) {
      html += `
        <div class="round-column final-column">
          <h3 class="round-title">Final</h3>
          <div class="round-matches">
      `;
      finals.forEach((match, idx) => {
        html += this.renderFinalMatch(match, idx + 1);
      });
      html += `</div></div>`;
    }

    html += '</div>';

    return html;
  }

  // Render final/semifinal match
  renderFinalMatch(match, matchNumber) {
    const playerAName = match.playerAName || 'TBD';
    const playerBName = match.playerBName || 'TBD';
    const winner = match.winner;
    const playerAClass = winner === match.playerA ? 'winner' : '';
    const playerBClass = winner === match.playerB ? 'winner' : '';

    return `
      <div class="final-match" data-match-id="${match.id}">
        <div class="final-match-number">${matchNumber}</div>
        <div class="final-players">
          <div class="final-player ${playerAClass}">
            <span class="player-name">${playerAName}</span>
          </div>
          <div class="final-vs">VS</div>
          <div class="final-player ${playerBClass}">
            <span class="player-name">${playerBName}</span>
          </div>
        </div>
        ${match.winner ? `<div class="final-winner">
          <i class="fas fa-crown"></i> Winner
        </div>` : ''}
      </div>
    `;
  }

  // Render repechage and bronze medal section
  renderRepechageSection(repechageMatches) {
    const repechage = repechageMatches.filter(m => m.matchType === 'repechage');
    const bronze = repechageMatches.filter(m => m.matchType === 'bronze');

    if (repechage.length === 0 && bronze.length === 0) {
      return '';
    }

    let html = '<div class="repechage-section">';
    html += '<h2 class="section-title"><i class="fas fa-medal"></i> Repechage & Bronze Medals</h2>';
    html += '<div class="repechage-container">';

    // Repechage matches
    if (repechage.length > 0) {
      html += '<div class="repechage-column">';
      html += '<h3 class="round-title">🔄 Repechage Matches</h3>';
      html += '<div class="round-matches">';
      repechage.forEach((match, idx) => {
        html += this.renderRepechageMatch(match, idx + 1);
      });
      html += '</div></div>';
    }

    // Bronze medal matches
    if (bronze.length > 0) {
      html += '<div class="bronze-column">';
      html += '<h3 class="round-title">🥉 Bronze Medal Matches</h3>';
      html += '<div class="round-matches">';
      bronze.forEach((match, idx) => {
        html += this.renderBronzeMatch(match, idx + 1);
      });
      html += '</div></div>';
    }

    html += '</div></div>';
    return html;
  }

  // Render repechage match
  renderRepechageMatch(match, matchNumber) {
    const playerAName = match.playerAName || 'TBD';
    const playerBName = match.playerBName || 'TBD';
    const winner = match.winner;
    const playerAClass = winner === match.playerA ? 'winner' : '';
    const playerBClass = winner === match.playerB ? 'winner' : '';
    const status = match.status || (match.completed ? 'completed' : 'pending');

    return `
      <div class="repechage-match ${status}" data-match-id="${match.id}">
        <div class="match-label">Repechage ${matchNumber}</div>
        <div class="match-players">
          <div class="match-player ${playerAClass}">
            <span class="player-name">${playerAName}</span>
          </div>
          <div class="match-vs">VS</div>
          <div class="match-player ${playerBClass}">
            <span class="player-name">${playerBName}</span>
          </div>
        </div>
        ${match.winner ? '<div class="match-winner-badge"><i class="fas fa-trophy"></i></div>' : ''}
      </div>
    `;
  }

  // Render bronze medal match
  renderBronzeMatch(match, matchNumber) {
    const playerAName = match.playerAName || 'TBD';
    const playerBName = match.playerBName || 'TBD';
    const winner = match.winner;
    const playerAClass = winner === match.playerA ? 'winner' : '';
    const playerBClass = winner === match.playerB ? 'winner' : '';
    const status = match.status || (match.completed ? 'completed' : 'pending');

    return `
      <div class="bronze-match ${status}" data-match-id="${match.id}">
        <div class="match-label">🥉 Bronze ${matchNumber}</div>
        <div class="match-players">
          <div class="match-player ${playerAClass}">
            <span class="player-name">${playerAName}</span>
          </div>
          <div class="match-vs">VS</div>
          <div class="match-player ${playerBClass}">
            <span class="player-name">${playerBName}</span>
          </div>
        </div>
        ${match.winner ? '<div class="match-winner-badge bronze"><i class="fas fa-medal"></i></div>' : ''}
      </div>
    `;
  }

  // Initialize and render
  async init() {
    try {
      await this.loadMatches();
      this.renderBracket();
      
      // Listen for real-time updates
      this.matchesRef.on('value', async (snapshot) => {
        const matchesData = snapshot.val();
        if (matchesData) {
          // Handle both data structures
          if (Array.isArray(matchesData)) {
            this.matches = matchesData;
            this.repechageMatches = [];
          } else if (matchesData.main && Array.isArray(matchesData.main)) {
            this.matches = matchesData.main;
            this.repechageMatches = matchesData.repechage || [];
          }
          this.renderBracket();
        }
      });
    } catch (error) {
      console.error('Error initializing bracket view:', error);
    }
  }
}

// Export for use in other scripts
window.BracketView = BracketView;
