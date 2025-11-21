// Tournament Draw UI Management
document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI elements
    const generateDrawBtn = document.getElementById('generateDraw');
    const generateFirstDrawBtn = document.getElementById('generateFirstDraw');
    const viewUpcomingBtn = document.getElementById('viewUpcoming');
    const bracketView = document.getElementById('bracketView');
    const listView = document.getElementById('listView');
    const tabs = document.querySelectorAll('.tab');
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
        // Get button reference and store original text before any async operations
        const button = generateDrawBtn || generateFirstDrawBtn;
        const originalText = button ? button.innerHTML : '<i class="fas fa-random"></i> Generate Draw';
        
        try {
            const confirmGenerate = confirm('Are you sure you want to generate a new draw? This will replace any existing draw.');
            if (!confirmGenerate) return;

            // Show loading state
            if (button) {
                button.disabled = true;
                button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
            }

            // Clear the current display first
            if (bracketContainer) {
                bracketContainer.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin fa-2x"></i><p>Generating draw...</p></div>';
            }

            // Generate the draw
            await tournamentDraw.generateDraw();
            
            // Force reload players to ensure we have the latest data
            await tournamentDraw.loadPlayers();
            
            // Clear the current matches and reload
            tournamentDraw.matches = [];
            
            // Refresh both bracket and list views
            await Promise.all([
                loadDraw(),
                loadUpcomingMatches()
            ]);
            
            // Switch to bracket view to show the new draw
            if (tabs && tabs.length > 0) {
                tabs[0].click();
            }
            
            // Show success message
            showNotification('Draw generated successfully!', 'success');
        } catch (error) {
            console.error('Error generating draw:', error);
            showNotification(`Error: ${error.message}`, 'error');
            
            // Try to reload the draw in case of partial failure
            try {
                await loadDraw();
            } catch (e) {
                console.error('Error reloading draw after failure:', e);
            }
        } finally {
            if (button) {
                button.disabled = false;
                button.innerHTML = originalText;
            }
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
            // Load players first to ensure we have player data
            await tournamentDraw.loadPlayers();
            
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
            // Load players first to ensure we have player data
            await tournamentDraw.loadPlayers();
            
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
            console.log('Opening match:', matchId);
            
            // Make sure we have the latest players data
            await tournamentDraw.loadPlayers();
            const matches = await tournamentDraw.getAllMatches();
            const match = matches.find(m => m.id === matchId);
            
            if (!match) {
                console.error('Match not found:', matchId);
                showNotification('Match not found', 'error');
                return;
            }
            
//            console.log('Found match:', match);
            
            // Get player details with debug logging
            const playerA = tournamentDraw.players.find(p => p.id === match.playerA);
            const playerB = tournamentDraw.players.find(p => p.id === match.playerB);
            
//            console.log('Player A:', playerA);
//            console.log('Player B:', playerB);
            
            // Create URL parameters for the scoreboard
            const params = new URLSearchParams();
            
            // Add player A info if available
            if (playerA) {
                params.append('fighterAName', playerA.fullName || 'Player A');
                if (playerA.playerInfo?.team) {
                    params.append('fighterAClub', playerA.playerInfo.team);
                }
            } else {
                params.append('fighterAName', 'Player A');
            }
            
            // Add player B info if available
            if (playerB) {
                params.append('fighterBName', playerB.fullName || 'Player B');
                if (playerB.playerInfo?.team) {
                    params.append('fighterBClub', playerB.playerInfo.team);
                }
            } else {
                params.append('fighterBName', 'Player B');
            }
            
            // Add match info
            params.append('matchId', match.id);
            if (playerA?.playerInfo?.weight) {
                params.append('weightCategory', `${playerA.playerInfo.weight}kg`);
            }
            params.append('matchNumber', `Match ${match.id.slice(0, 4)}`);
            params.append('round', getRoundName(match.round, 5));
            
//            console.log('URL Params:', params.toString());
            
            // Open scoreboard in a new tab with match data
            const scoreboardUrl = `/views/scoreboard.html?${params.toString()}`;
//            console.log('Opening URL:', scoreboardUrl);
            window.open(scoreboardUrl, '_blank');
            
            // Mark match as started
            match.started = true;
            await tournamentDraw.updateMatch(match);
            
        } catch (error) {
            console.error('Error opening match in scoreboard:', error);
            showNotification('Failed to open match', 'error');
        }
    };

    // Add event listeners to match cards using event delegation
    const addMatchCardEventListeners = () => {
        // Use event delegation for Start Match buttons
        document.addEventListener('click', (e) => {
            // Handle Start Match button clicks
            const startBtn = e.target.closest('.start-match-btn');
            if (startBtn) {
                e.preventDefault();
                e.stopPropagation();
                const matchId = startBtn.getAttribute('data-match-id');
                if (matchId) {
                    openMatchInScoreboard(matchId);
                }
                return;
            }
            
            // Handle match card clicks (but not on buttons)
            const matchCard = e.target.closest('.match-card');
            if (matchCard && !e.target.closest('.btn')) {
                const matchId = matchCard.getAttribute('data-match-id');
                if (matchId) {
                    openMatchInScoreboard(matchId);
                }
            }
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
    

    // Load initial data
    if (bracketContainer) loadDraw();
    if (matchesContainer) loadUpcomingMatches();
});
