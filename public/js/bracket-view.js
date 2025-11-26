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

      // Handle category-based structure: { CATEGORY_KEY: {main: [...], repechage: [...]}, ... }
      const firstKey = Object.keys(matchesData)[0];
      const firstValue = matchesData[firstKey];
      
      if (firstValue && typeof firstValue === 'object' && (firstValue.main || firstValue.repechage)) {
        console.log('📊 Loading matches from category-based structure');
        // Flatten all categories into single arrays
        this.matches = [];
        this.repechageMatches = [];
        
        Object.keys(matchesData).forEach(categoryKey => {
          const categoryData = matchesData[categoryKey];
          
          if (categoryData.main && Array.isArray(categoryData.main)) {
            this.matches.push(...categoryData.main.map(m => ({...m, category: categoryKey})));
          }
          
          if (categoryData.repechage && Array.isArray(categoryData.repechage)) {
            this.repechageMatches.push(...categoryData.repechage.map(m => ({...m, category: categoryKey})));
          }
        });
      }
      // Handle single category structure: { main: [...], repechage: [...] }
      else if (matchesData.main && Array.isArray(matchesData.main)) {
        this.matches = matchesData.main;
        this.repechageMatches = matchesData.repechage || [];
      }
      // Handle direct array (legacy)
      else if (Array.isArray(matchesData)) {
        this.matches = matchesData;
        this.repechageMatches = [];
      }
      else {
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
  const firstRound = matches.filter(m => m.round === 1);
  const pools = { A:[], B:[], C:[], D:[] };

  firstRound.forEach(m => pools[m.pool].push(m));

  return Object.keys(pools).map(p => ({
    name: p,
    matches: pools[p]
  }));
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
  renderBracket(containerId = 'bracketContainer', categoryFilter = '') {
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

    // Filter matches by category if specified
    let matchesToRender = this.matches;
    let repechageToRender = this.repechageMatches || [];
    
    // If no category filter (All Categories), show selection message
    if (!categoryFilter) {
      container.innerHTML = `
        <div class="no-draw">
          <i class="fas fa-filter"></i>
          <p>Please select a specific category to view the bracket.</p>
          <p style="font-size: 14px; color: #6c757d; margin-top: 10px;">
            Use the category dropdown above to select a weight category.
          </p>
        </div>
      `;
      return;
    }
    
    if (categoryFilter) {
      matchesToRender = this.matches.filter(m => m.category === categoryFilter);
      repechageToRender = (this.repechageMatches || []).filter(m => m.category === categoryFilter);
      console.log(`Filtered to category ${categoryFilter}: ${matchesToRender.length} main, ${repechageToRender.length} repechage`);
    }

    if (matchesToRender.length === 0) {
      container.innerHTML = `
        <div class="no-draw">
          <i class="fas fa-info-circle"></i>
          <p>No matches found for this category.</p>
        </div>
      `;
      return;
    }

    // Group matches by category for separate display
    const categories = this.groupMatchesByCategory(matchesToRender, repechageToRender);
    
    // Build HTML
    let html = '<div class="bracket-wrapper">';
    
    // Render each category separately
    categories.forEach(category => {
      html += this.renderCategoryBracket(category);
    });

    html += '</div>';

    container.innerHTML = html;
  }

  // Group matches by category
  groupMatchesByCategory(mainMatches, repechageMatches) {
    const categoryMap = new Map();
    
    // Group main matches
    mainMatches.forEach(match => {
      const cat = match.category || 'default';
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, { category: cat, main: [], repechage: [] });
      }
      categoryMap.get(cat).main.push(match);
    });
    
    // Group repechage matches
    repechageMatches.forEach(match => {
      const cat = match.category || 'default';
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, { category: cat, main: [], repechage: [] });
      }
      categoryMap.get(cat).repechage.push(match);
    });
    
    return Array.from(categoryMap.values());
  }

  // Render bracket for a single category
  renderCategoryBracket(categoryData) {
    const { category, main, repechage } = categoryData;
    
    // Check if all matches are completed
    const allMatches = [...main, ...(repechage || [])];
    const completedMatches = allMatches.filter(m => m.completed || m.status === 'completed');
    const allCompleted = allMatches.length > 0 && completedMatches.length === allMatches.length;
    const statusBadge = allCompleted 
      ? '<span class="badge bg-success" style="margin-left: 15px; font-size: 0.9rem;">✅ Matches Completed</span>'
      : '<span class="badge bg-warning" style="margin-left: 15px; font-size: 0.9rem;">⏳ Matches Pending</span>';
    
    let html = `<div class="category-bracket" data-category="${category}">`;
    
    // Category header with status
    if (category !== 'default') {
      html += `<div class="category-header"><h2><i class="fas fa-trophy"></i> ${category.replace(/_/g, ' ')} ${statusBadge}</h2></div>`;
    }
    
    // Group matches into pools
    const pools = this.groupMatchesIntoPools(main);
    
    // Render pools
    html += '<div class="pools-container">';
    pools.forEach(pool => {
      html += this.renderPool(pool, main);
    });
    html += '</div>';

    // Render progression rounds (semifinals, finals)
    html += this.renderProgressionRounds(main);

    // Render repechage and bronze medal matches
    if (repechage && repechage.length > 0) {
      html += this.renderRepechageSection(repechage);
    }

    // Render results box
    html += this.renderResultsBox(main, repechage);

    html += '</div>';
    
    return html;
  }

  // Render results box with all winners (IJF ranking)
  renderResultsBox(mainMatches, repechageMatches) {
    // Find winners
    const finalMatch = mainMatches.find(m => m.matchType === 'final');
    const bronzeMatches = (repechageMatches || []).filter(m => m.matchType === 'bronze');
    
    // Get repechage matches (excluding bronze)
    const repechageOnly = (repechageMatches || []).filter(m => m.matchType === 'repechage' || (m.isRepechage && m.matchType !== 'bronze'));
    
    // Find the highest round number in repechage
    const maxRepechageRound = repechageOnly.length > 0 
      ? Math.max(...repechageOnly.map(m => m.round || 1))
      : 0;
    
    // Get repechage finals (last round before bronze)
    const repechageFinals = repechageOnly.filter(m => m.round === maxRepechageRound);
    
    console.log('📊 Results calculation:', {
      repechageOnly: repechageOnly.length,
      maxRepechageRound,
      repechageFinals: repechageFinals.length
    });
    
    if (!finalMatch || !finalMatch.winner) {
      return ''; // Don't show results box if tournament not complete
    }

    // 1st - Gold (Final winner)
    const goldWinner = finalMatch.winner === finalMatch.playerA ? 
      { name: finalMatch.playerAName, club: finalMatch.playerAClub } :
      { name: finalMatch.playerBName, club: finalMatch.playerBClub };
    
    // 2nd - Silver (Final loser)
    const silverWinner = finalMatch.winner === finalMatch.playerA ? 
      { name: finalMatch.playerBName, club: finalMatch.playerBClub } :
      { name: finalMatch.playerAName, club: finalMatch.playerAClub };

    // 3rd - Bronze winners (Two bronze medal winners)
    const bronzeWinners = bronzeMatches
      .filter(m => m.winner)
      .map(m => {
        const isPlayerA = m.winner === m.playerA;
        return {
          name: isPlayerA ? m.playerAName : m.playerBName,
          club: isPlayerA ? m.playerAClub : m.playerBClub
        };
      });

    // 5th - Bronze losers (Winners of repechage who lost bronze bouts)
    const fifthPlace = bronzeMatches
      .filter(m => m.winner)
      .map(m => {
        const isPlayerA = m.winner === m.playerA;
        return {
          name: isPlayerA ? m.playerBName : m.playerAName,
          club: isPlayerA ? m.playerBClub : m.playerAClub
        };
      });

    // 7th - Repechage final losers
    const seventhPlace = repechageFinals
      .filter(m => m.winner)
      .map(m => {
        const isPlayerA = m.winner === m.playerA;
        return {
          name: isPlayerA ? m.playerBName : m.playerAName,
          club: isPlayerA ? m.playerBClub : m.playerAClub
        };
      });

    let html = `
      <div class="results-box">
        <h3><i class="fas fa-trophy"></i> IJF Tournament Results</h3>
        <div class="results-grid">
          <div class="result-item gold">
            <div class="result-position">🥇 1st Place - Gold Medal</div>
            <div class="result-name">${goldWinner.name}</div>
            <div class="result-club">${goldWinner.club || 'N/A'}</div>
          </div>
          <div class="result-item silver">
            <div class="result-position">🥈 2nd Place - Silver Medal</div>
            <div class="result-name">${silverWinner.name}</div>
            <div class="result-club">${silverWinner.club || 'N/A'}</div>
          </div>
    `;

    // Add bronze winners (3rd place)
    bronzeWinners.forEach((winner, idx) => {
      html += `
        <div class="result-item bronze">
          <div class="result-position">🥉 3rd Place - Bronze Medal</div>
          <div class="result-name">${winner.name}</div>
          <div class="result-club">${winner.club || 'N/A'}</div>
        </div>
      `;
    });

    // Add 5th place
    fifthPlace.forEach((winner, idx) => {
      html += `
        <div class="result-item fifth">
          <div class="result-position">5th Place</div>
          <div class="result-name">${winner.name}</div>
          <div class="result-club">${winner.club || 'N/A'}</div>
        </div>
      `;
    });

    // Add 7th place
    seventhPlace.forEach((winner, idx) => {
      html += `
        <div class="result-item seventh">
          <div class="result-position">7th Place</div>
          <div class="result-name">${winner.name}</div>
          <div class="result-club">${winner.club || 'N/A'}</div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;

    return html;
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

    // Use actual match number from data
    const displayMatchNumber = match.matchNumber || matchNumber;

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
        <div class="match-number">${displayMatchNumber}</div>
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
