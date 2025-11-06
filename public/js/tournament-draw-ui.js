// Tournament Draw UI Management
document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI elements
    const generateDrawBtn = document.getElementById('generateDraw');
    const generateFirstDrawBtn = document.getElementById('generateFirstDraw');
    const viewUpcomingBtn = document.getElementById('viewUpcoming');
    const bracketView = document.getElementById('bracketView');
    const listView = document.getElementById('listView');
    const tabs = document.querySelectorAll('.tab');
    const playerSearch = document.getElementById('playerSearch');
    const playersList = document.getElementById('playersList');
    const matchesContainer = document.getElementById('matchesContainer');
    const bracketContainer = document.getElementById('bracketContainer');

    // Initialize tournament draw system
    const tournamentDraw = window.tournamentDraw;

    // Tab switching
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs and content
            tabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });

            // Add active class to clicked tab and corresponding content
            tab.classList.add('active');
            const tabId = tab.getAttribute('data-tab');
            document.getElementById(`${tabId}View`).classList.add('active');
        });
    });

    // Generate draw button click handler
    const handleGenerateDraw = async () => {
        try {
            const confirmGenerate = confirm('Are you sure you want to generate a new draw? This will replace any existing draw.');
            if (!confirmGenerate) return;

            // Show loading state
            const button = generateDrawBtn || generateFirstDrawBtn;
            const originalText = button.innerHTML;
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';

            // Generate the draw
            await tournamentDraw.generateDraw();
            
            // Refresh the display
            await loadDraw();
            
            // Show success message
            showNotification('Draw generated successfully!', 'success');
        } catch (error) {
            console.error('Error generating draw:', error);
            showNotification(`Error: ${error.message}`, 'error');
        } finally {
            const button = generateDrawBtn || generateFirstDrawBtn;
            button.disabled = false;
            button.innerHTML = originalText || '<i class="fas fa-random"></i> Generate Draw';
        }
    };

    // View upcoming matches button click handler
    const handleViewUpcoming = () => {
        // Switch to list view
        tabs[1].click();
        loadUpcomingMatches();
    };

    // Load and display the tournament draw
    const loadDraw = async () => {
        try {
            const matches = await tournamentDraw.getAllMatches();
            
            if (matches.length === 0) {
                bracketContainer.innerHTML = `
                    <div class="no-draw">
                        <i class="fas fa-chess-board"></i>
                        <p>No draw has been generated yet.</p>
                        <button id="generateFirstDraw" class="btn btn-primary">
                            <i class="fas fa-random"></i> Generate Draw
                        </button>
                    </div>
                `;
                
                // Re-attach event listener to the new button
                document.getElementById('generateFirstDraw')?.addEventListener('click', handleGenerateDraw);
                return;
            }

            // Group matches by round
            const rounds = {};
            matches.forEach(match => {
                if (!rounds[match.round]) {
                    rounds[match.round] = [];
                }
                rounds[match.round].push(match);
            });

            // Generate bracket HTML
            let bracketHTML = '<div class="bracket">';
            
            // Sort rounds in ascending order
            const sortedRounds = Object.keys(rounds).sort((a, b) => parseInt(a) - parseInt(b));
            
            // Create a column for each round
            sortedRounds.forEach(roundNum => {
                const roundMatches = rounds[roundNum];
                bracketHTML += `
                    <div class="round">
                        <h3>${getRoundName(parseInt(roundNum), sortedRounds.length)}</h3>
                        <div class="matches">
                            ${roundMatches.map(match => renderMatch(match)).join('')}
                        </div>
                    </div>
                    ${roundNum < sortedRounds.length ? '<div class="connector"></div>' : ''}
                `;
            });
            
            bracketHTML += '</div>';
            bracketContainer.innerHTML = bracketHTML;
            
            // Add event listeners to matches
            addMatchEventListeners();
            
        } catch (error) {
            console.error('Error loading draw:', error);
            showNotification('Failed to load tournament draw', 'error');
        }
    };

    // Load and display upcoming matches
    const loadUpcomingMatches = async () => {
        try {
            const matches = await tournamentDraw.getAllMatches();
            const upcomingMatches = matches
                .filter(match => !match.completed)
                .sort((a, b) => a.round - b.round);
            
            if (upcomingMatches.length === 0) {
                matchesContainer.innerHTML = `
                    <div class="no-matches">
                        <i class="fas fa-calendar-times"></i>
                        <p>No upcoming matches found.</p>
                    </div>
                `;
                return;
            }
            
            matchesContainer.innerHTML = `
                <div class="matches-grid">
                    ${upcomingMatches.map(match => renderMatchCard(match)).join('')}
                </div>
            `;
            
            // Add event listeners to match cards
            addMatchCardEventListeners();
            
        } catch (error) {
            console.error('Error loading upcoming matches:', error);
            showNotification('Failed to load upcoming matches', 'error');
        }
    };

    // Load and display registered players
    const loadPlayers = async () => {
        try {
            const players = await tournamentDraw.loadPlayers();
            
            if (players.length === 0) {
                playersList.innerHTML = `
                    <div class="no-players">
                        <i class="fas fa-users-slash"></i>
                        <p>No players registered yet.</p>
                    </div>
                `;
                return;
            }
            
            playersList.innerHTML = players.map(player => `
                <div class="player-item" data-id="${player.id}">
                    <div class="player-info">
                        <h4>${player.fullName}</h4>
                        <p>${player.playerInfo?.team || 'No team'} • ${player.playerInfo?.weight ? player.playerInfo.weight + 'kg' : 'N/A'}</p>
                    </div>
                    <span class="player-actions">
                        <button class="btn-icon" title="View details">
                            <i class="fas fa-eye"></i>
                        </button>
                    </span>
                </div>
            `).join('');
            
        } catch (error) {
            console.error('Error loading players:', error);
            showNotification('Failed to load players', 'error');
        }
    };

    // Helper function to get round name
    const getRoundName = (roundNumber, totalRounds) => {
        const roundNames = {
            1: ['Final', 'Semi-Finals', 'Quarter-Finals', 'Round of 16', 'Round of 32'],
            2: ['Final', 'Semi-Finals', 'Quarter-Finals', 'Round of 16'],
            3: ['Final', 'Semi-Finals', 'Quarter-Finals'],
            4: ['Final', 'Semi-Finals'],
            5: ['Final']
        };
        
        const roundIndex = totalRounds - roundNumber;
        return roundNames[totalRounds]?.[roundIndex] || `Round ${roundNumber}`;
    };

    // Render a match for the bracket view
    const renderMatch = (match) => {
        const playerA = tournamentDraw.players.find(p => p.id === match.playerA);
        const playerB = tournamentDraw.players.find(p => p.id === match.playerB);
        
        return `
            <div class="match" data-match-id="${match.id}">
                <div class="match-teams">
                    <div class="team ${match.winner === match.playerA ? 'winner' : ''}">
                        <span class="player-name">${playerA ? playerA.fullName : 'TBD'}</span>
                        <span class="score">${match.scoreA ?? ''}</span>
                    </div>
                    <div class="team ${match.winner === match.playerB ? 'winner' : ''}">
                        <span class="player-name">${playerB ? playerB.fullName : 'TBD'}</span>
                        <span class="score">${match.scoreB ?? ''}</span>
                    </div>
                </div>
                <div class="match-actions">
                    <button class="btn-icon" title="Edit match">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            </div>
        `;
    };

    // Render a match card for the list view
    const renderMatchCard = (match) => {
        const playerA = tournamentDraw.players.find(p => p.id === match.playerA);
        const playerB = tournamentDraw.players.find(p => p.id === match.playerB);
        
        return `
            <div class="match-card" data-match-id="${match.id}">
                <div class="match-header">
                    <span>${getRoundName(match.round, 5)}</span>
                    <span class="match-time">${match.time || 'TBD'}</span>
                </div>
                <div class="match-teams">
                    <div class="team ${match.winner === match.playerA ? 'winner' : ''}">
                        <span class="player-name">${playerA ? playerA.fullName : 'TBD'}</span>
                        <span class="score">${match.scoreA ?? ''}</span>
                    </div>
                    <div class="team ${match.winner === match.playerB ? 'winner' : ''}">
                        <span class="player-name">${playerB ? playerB.fullName : 'TBD'}</span>
                        <span class="score">${match.scoreB ?? ''}</span>
                    </div>
                </div>
                <div class="match-actions">
                    <button class="btn btn-sm start-match-btn" data-match-id="${match.id}">
                        <i class="fas fa-play"></i> Start Match
                    </button>
                </div>
            </div>
        `;
    };

    // Add event listeners to match elements in the bracket
    const addMatchEventListeners = () => {
        document.querySelectorAll('.match').forEach(matchEl => {
            matchEl.addEventListener('click', (e) => {
                if (e.target.closest('.btn-icon')) return; // Don't trigger if clicking on action buttons
                const matchId = matchEl.getAttribute('data-match-id');
                // Handle match click (e.g., show match details)
                console.log('Match clicked:', matchId);
            });
        });
    };

    // Function to open match in scoreboard
    const openMatchInScoreboard = async (matchId) => {
        try {
            const matches = await tournamentDraw.getAllMatches();
            const match = matches.find(m => m.id === matchId);
            
            if (!match) {
                showNotification('Match not found', 'error');
                return;
            }
            
            // Get player details
            const playerA = tournamentDraw.players.find(p => p.id === match.playerA);
            const playerB = tournamentDraw.players.find(p => p.id === match.playerB);
            
            // Create URL parameters for the scoreboard
            const params = new URLSearchParams({
                matchId: match.id,
                fighterAName: playerA?.fullName || 'Player A',
                fighterBName: playerB?.fullName || 'Player B',
                fighterAClub: playerA?.playerInfo?.team || 'N/A',
                fighterBClub: playerB?.playerInfo?.team || 'N/A',
                weightCategory: playerA?.playerInfo?.weight ? `${playerA.playerInfo.weight}kg` : 'N/A',
                matchNumber: `Match ${match.id.slice(0, 4)}`,
                round: getRoundName(match.round, 5)
            });
            
            // Open scoreboard in a new tab with match data
            const scoreboardUrl = `/views/index.html?${params.toString()}`;
            window.open(scoreboardUrl, '_blank');
            
            // Mark match as started
            match.started = true;
            await tournamentDraw.updateMatch(match);
            
        } catch (error) {
            console.error('Error opening match in scoreboard:', error);
            showNotification('Failed to open match', 'error');
        }
    };

    // Add event listeners to match cards
    const addMatchCardEventListeners = () => {
        // Add click handler for Start Match buttons
        document.querySelectorAll('.start-match-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const matchId = e.currentTarget.getAttribute('data-match-id');
                if (matchId) {
                    openMatchInScoreboard(matchId);
                }
            });
        });
        
        // Keep existing card click handler
        document.querySelectorAll('.match-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.btn')) return; // Don't trigger if clicking on buttons
                const matchId = card.getAttribute('data-match-id');
                if (matchId) {
                    openMatchInScoreboard(matchId);
                }
            });
        });
    };

    // Show a notification
    const showNotification = (message, type = 'info') => {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'check-circle'}"></i>
            <span>${message}</span>
            <button class="btn-icon close-notification">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove notification after 5 seconds
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, 5000);
        
        // Close button
        notification.querySelector('.close-notification').addEventListener('click', () => {
            notification.remove();
        });
    };

    // Update match score (placeholder function)
    const updateMatchScore = (matchId) => {
        // This would typically open a modal or form to update the score
        alert(`Update score for match ${matchId}`);
    };

    // Initialize event listeners
    if (generateDrawBtn) generateDrawBtn.addEventListener('click', handleGenerateDraw);
    if (generateFirstDrawBtn) generateFirstDrawBtn.addEventListener('click', handleGenerateDraw);
    if (viewUpcomingBtn) viewUpcomingBtn.addEventListener('click', handleViewUpcoming);
    
    // Player search
    if (playerSearch) {
        playerSearch.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const playerItems = document.querySelectorAll('.player-item');
            
            playerItems.forEach(item => {
                const playerName = item.querySelector('h4').textContent.toLowerCase();
                const teamName = item.querySelector('p').textContent.toLowerCase();
                
                if (playerName.includes(searchTerm) || teamName.includes(searchTerm)) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    }

    // Load initial data
    if (bracketContainer) loadDraw();
    if (playersList) loadPlayers();
    if (matchesContainer) loadUpcomingMatches();
});
