/**
 * PDF Export System for Tournament Matches
 * 
 * Features:
 * - Bracket View: Page 1 = Full bracket, Page 2 = Results/Bronze/Repechage
 * - List View: All matches in organized format
 * - A4 page size with proper scaling
 * - Professional formatting
 */

class TournamentPDFExporter {
    constructor() {
        this.jsPDF = window.jspdf.jsPDF;
    }

    /**
     * Export bracket view to PDF
     * Page 1: Complete bracket
     * Page 2: Tournament results, bronze medals, and repechage
     */
    async exportBracketViewPDF(categoryName = 'Tournament') {
        try {
            console.log('Starting bracket PDF export...');
            
            const bracketContainer = document.getElementById('bracketContainer');
            if (!bracketContainer) {
                alert('Bracket container not found');
                return;
            }

            // Show loading indicator
            this.showLoadingOverlay('Generating PDF...');

            // Create PDF in A4 landscape
            const pdf = new this.jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();

            // PAGE 1: BRACKET
            await this.addBracketPage(pdf, bracketContainer, categoryName, pageWidth, pageHeight);

            // PAGE 2: RESULTS, BRONZE, REPECHAGE
            pdf.addPage();
            await this.addResultsPage(pdf, bracketContainer, categoryName, pageWidth, pageHeight);

            // Save PDF
            const fileName = `${categoryName.replace(/[^a-z0-9]/gi, '_')}_Bracket_${this.getTimestamp()}.pdf`;
            pdf.save(fileName);

            this.hideLoadingOverlay();
            console.log('PDF exported successfully:', fileName);

        } catch (error) {
            console.error('Error exporting bracket PDF:', error);
            this.hideLoadingOverlay();
            alert('Failed to export PDF. Please try again.');
        }
    }

    /**
     * Add bracket to page 1
     */
    async addBracketPage(pdf, container, categoryName, pageWidth, pageHeight) {
        // Add title
        pdf.setFontSize(18);
        pdf.setFont('helvetica', 'bold');
        pdf.text(categoryName, pageWidth / 2, 15, { align: 'center' });
        
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'normal');
        pdf.text('Tournament Bracket', pageWidth / 2, 22, { align: 'center' });

        // Find the bracket rounds container
        const bracketRounds = container.querySelector('.bracket-rounds-container');
        
        if (bracketRounds) {
            // Capture the bracket as image
            const canvas = await html2canvas(bracketRounds, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });

            const imgData = canvas.toDataURL('image/png');
            
            // Calculate dimensions to fit on page
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = imgWidth / imgHeight;
            
            const maxWidth = pageWidth - 20; // 10mm margins
            const maxHeight = pageHeight - 35; // Leave space for title
            
            let finalWidth = maxWidth;
            let finalHeight = finalWidth / ratio;
            
            if (finalHeight > maxHeight) {
                finalHeight = maxHeight;
                finalWidth = finalHeight * ratio;
            }
            
            const x = (pageWidth - finalWidth) / 2;
            const y = 28;
            
            pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);
        } else {
            pdf.setFontSize(10);
            pdf.text('No bracket data available', pageWidth / 2, pageHeight / 2, { align: 'center' });
        }
    }

    /**
     * Add results, bronze, and repechage to page 2
     */
    async addResultsPage(pdf, container, categoryName, pageWidth, pageHeight) {
        let yPos = 15;

        // Title
        pdf.setFontSize(18);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Tournament Results', pageWidth / 2, yPos, { align: 'center' });
        yPos += 10;

        // Results Box
        const resultsBox = container.querySelector('.results-box');
        if (resultsBox) {
            const resultsItems = resultsBox.querySelectorAll('.result-item');
            
            if (resultsItems.length > 0) {
                pdf.setFontSize(14);
                pdf.setFont('helvetica', 'bold');
                pdf.text('Final Rankings', 15, yPos);
                yPos += 8;

                resultsItems.forEach((item, index) => {
                    const position = item.querySelector('.result-position')?.textContent || '';
                    const name = item.querySelector('.result-name')?.textContent || '';
                    const club = item.querySelector('.result-club')?.textContent || '';

                    pdf.setFontSize(11);
                    pdf.setFont('helvetica', 'bold');
                    pdf.text(position, 20, yPos);
                    
                    pdf.setFont('helvetica', 'normal');
                    pdf.text(name, 80, yPos);
                    
                    if (club && club !== 'N/A') {
                        pdf.setFontSize(9);
                        pdf.setTextColor(100, 100, 100);
                        pdf.text(`(${club})`, 150, yPos);
                        pdf.setTextColor(0, 0, 0);
                    }
                    
                    yPos += 7;
                });
                
                yPos += 5;
            }
        }

        // Repechage Section
        const repechageSection = container.querySelector('.repechage-section');
        if (repechageSection && yPos < pageHeight - 40) {
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Repechage & Bronze Medal Matches', 15, yPos);
            yPos += 8;

            // Repechage matches
            const repechageMatches = repechageSection.querySelectorAll('.repechage-match');
            if (repechageMatches.length > 0) {
                pdf.setFontSize(12);
                pdf.setFont('helvetica', 'bold');
                pdf.text('Repechage Matches:', 20, yPos);
                yPos += 6;

                repechageMatches.forEach((match, index) => {
                    const playerA = match.querySelector('.match-player:first-child .player-name')?.textContent || '';
                    const playerB = match.querySelector('.match-player:last-child .player-name')?.textContent || '';
                    const hasWinner = match.querySelector('.match-winner-badge');

                    pdf.setFontSize(10);
                    pdf.setFont('helvetica', 'normal');
                    pdf.text(`${index + 1}. ${playerA} vs ${playerB}`, 25, yPos);
                    
                    if (hasWinner) {
                        const winnerCard = match.querySelector('.match-player.winner .player-name');
                        if (winnerCard) {
                            pdf.setFont('helvetica', 'bold');
                            pdf.text(`Winner: ${winnerCard.textContent}`, 150, yPos);
                        }
                    }
                    
                    yPos += 6;
                });
                
                yPos += 3;
            }

            // Bronze medal matches
            const bronzeMatches = repechageSection.querySelectorAll('.bronze-match');
            if (bronzeMatches.length > 0 && yPos < pageHeight - 30) {
                pdf.setFontSize(12);
                pdf.setFont('helvetica', 'bold');
                pdf.text('Bronze Medal Matches:', 20, yPos);
                yPos += 6;

                bronzeMatches.forEach((match, index) => {
                    const playerA = match.querySelector('.match-player:first-child .player-name')?.textContent || '';
                    const playerB = match.querySelector('.match-player:last-child .player-name')?.textContent || '';
                    const hasWinner = match.querySelector('.match-winner-badge');

                    pdf.setFontSize(10);
                    pdf.setFont('helvetica', 'normal');
                    pdf.text(`${index + 1}. ${playerA} vs ${playerB}`, 25, yPos);
                    
                    if (hasWinner) {
                        const winnerCard = match.querySelector('.match-player.winner .player-name');
                        if (winnerCard) {
                            pdf.setFont('helvetica', 'bold');
                            pdf.text(`Bronze Winner: ${winnerCard.textContent}`, 150, yPos);
                        }
                    }
                    
                    yPos += 6;
                });
            }
        }

        // Footer
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(`Generated on ${new Date().toLocaleString()}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
        pdf.setTextColor(0, 0, 0);
    }

    /**
     * Export list view to PDF
     */
    async exportListViewPDF(categoryName = 'Tournament') {
        try {
            console.log('Starting list view PDF export...');
            
            const matchesContainer = document.getElementById('matchesContainer');
            if (!matchesContainer) {
                alert('Matches container not found');
                return;
            }

            this.showLoadingOverlay('Generating PDF...');

            // Create PDF in A4 portrait
            const pdf = new this.jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            let yPos = 20;

            // Title
            pdf.setFontSize(18);
            pdf.setFont('helvetica', 'bold');
            pdf.text(categoryName, pageWidth / 2, yPos, { align: 'center' });
            yPos += 8;
            
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'normal');
            pdf.text('Tournament Matches - List View', pageWidth / 2, yPos, { align: 'center' });
            yPos += 12;

            // Get matches from table rows (the actual structure used in list view)
            const tableRows = matchesContainer.querySelectorAll('tbody tr:not(.table-secondary)');
            
            console.log(`Found ${tableRows.length} match rows for PDF export`);
            
            if (tableRows.length === 0) {
                pdf.setFontSize(10);
                pdf.text('No matches available for selected category', pageWidth / 2, yPos, { align: 'center' });
                pdf.setFontSize(8);
                pdf.text('Please ensure a category is selected and matches are loaded', pageWidth / 2, yPos + 10, { align: 'center' });
            } else {
                // Parse table structure and group by sections
                const sections = this.parseMatchTableSections(matchesContainer);
                
                for (const section of sections) {
                    // Check if we need a new page
                    if (yPos > pageHeight - 40) {
                        pdf.addPage();
                        yPos = 20;
                    }

                    // Section header (Main Bracket, Repechage, Bronze, Final)
                    if (section.title) {
                        pdf.setFillColor(67, 97, 238);
                        pdf.rect(10, yPos - 5, pageWidth - 20, 8, 'F');
                        pdf.setTextColor(255, 255, 255);
                        pdf.setFontSize(12);
                        pdf.setFont('helvetica', 'bold');
                        pdf.text(section.title, 15, yPos);
                        pdf.setTextColor(0, 0, 0);
                        yPos += 10;
                    }

                    // Matches in this section
                    section.matches.forEach((match, index) => {
                        // Check if we need a new page
                        if (yPos > pageHeight - 25) {
                            pdf.addPage();
                            yPos = 20;
                        }

                        // Match box
                        pdf.setDrawColor(200, 200, 200);
                        pdf.setLineWidth(0.3);
                        pdf.rect(10, yPos - 4, pageWidth - 20, 16);

                        // Match number and round
                        pdf.setFontSize(9);
                        pdf.setFont('helvetica', 'bold');
                        pdf.text(`#${match.number}`, 13, yPos);
                        
                        pdf.setFontSize(8);
                        pdf.setFont('helvetica', 'normal');
                        pdf.text(match.round, 25, yPos);

                        // Status
                        pdf.setFontSize(7);
                        pdf.setTextColor(100, 100, 100);
                        pdf.text(match.status, pageWidth - 13, yPos, { align: 'right' });
                        pdf.setTextColor(0, 0, 0);

                        yPos += 5;

                        // Players
                        pdf.setFontSize(8);
                        pdf.setFont('helvetica', 'normal');
                        pdf.text(`${match.playerA}`, 13, yPos);
                        pdf.text('vs', pageWidth / 2, yPos, { align: 'center' });
                        pdf.text(`${match.playerB}`, pageWidth - 13, yPos, { align: 'right' });

                        yPos += 4;

                        // Winner
                        if (match.winner) {
                            pdf.setFont('helvetica', 'bold');
                            pdf.setTextColor(6, 214, 160);
                            pdf.setFontSize(7);
                            pdf.text(`Winner: ${match.winner}`, pageWidth / 2, yPos, { align: 'center' });
                            pdf.setTextColor(0, 0, 0);
                        }

                        yPos += 8;
                    });

                    yPos += 5;
                }
            }

            // Footer
            pdf.setFontSize(8);
            pdf.setTextColor(150, 150, 150);
            pdf.text(`Generated on ${new Date().toLocaleString()}`, pageWidth / 2, pageHeight - 5, { align: 'center' });

            // Save PDF
            const fileName = `${categoryName.replace(/[^a-z0-9]/gi, '_')}_List_${this.getTimestamp()}.pdf`;
            pdf.save(fileName);

            this.hideLoadingOverlay();
            console.log('PDF exported successfully:', fileName);

        } catch (error) {
            console.error('Error exporting list PDF:', error);
            this.hideLoadingOverlay();
            alert('Failed to export PDF. Please try again.');
        }
    }

    /**
     * Parse match table sections from list view
     */
    parseMatchTableSections(container) {
        const sections = [];
        const tbody = container.querySelector('tbody');
        
        if (!tbody) {
            return sections;
        }
        
        let currentSection = null;
        const rows = tbody.querySelectorAll('tr');
        
        rows.forEach(row => {
            // Check if this is a section header row
            if (row.classList.contains('table-secondary')) {
                // Save previous section if exists
                if (currentSection && currentSection.matches.length > 0) {
                    sections.push(currentSection);
                }
                
                // Start new section
                const titleCell = row.querySelector('td');
                const titleText = titleCell ? titleCell.textContent.trim() : '';
                currentSection = {
                    title: titleText,
                    matches: []
                };
            } else if (currentSection) {
                // This is a match row - parse it
                const cells = row.querySelectorAll('td');
                if (cells.length >= 9) {
                    const matchData = {
                        number: cells[0].textContent.trim(),
                        type: cells[1].textContent.trim(),
                        round: cells[2].textContent.trim(),
                        playerA: cells[3].textContent.trim(),
                        playerB: cells[5].textContent.trim(),
                        mat: cells[6].textContent.trim(),
                        status: cells[7].textContent.trim(),
                        winner: cells[8].textContent.trim()
                    };
                    currentSection.matches.push(matchData);
                }
            }
        });
        
        // Add last section
        if (currentSection && currentSection.matches.length > 0) {
            sections.push(currentSection);
        }
        
        return sections;
    }

    /**
     * Group match cards by round (legacy method for card-based views)
     */
    groupMatchesByRound(matchCards) {
        const grouped = {};
        
        matchCards.forEach(card => {
            const roundText = card.querySelector('.match-round')?.textContent || 
                             card.querySelector('.round-badge')?.textContent || 
                             'Round 1';
            
            if (!grouped[roundText]) {
                grouped[roundText] = [];
            }
            grouped[roundText].push(card);
        });
        
        return grouped;
    }

    /**
     * Get timestamp for filename
     */
    getTimestamp() {
        const now = new Date();
        return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    }

    /**
     * Show loading overlay
     */
    showLoadingOverlay(message = 'Loading...') {
        let overlay = document.getElementById('pdfLoadingOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'pdfLoadingOverlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                color: white;
                font-family: 'Poppins', sans-serif;
            `;
            overlay.innerHTML = `
                <div style="text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 20px;">
                        <i class="fas fa-file-pdf"></i>
                    </div>
                    <div style="font-size: 20px; font-weight: 600;" id="pdfLoadingMessage">${message}</div>
                    <div style="margin-top: 20px;">
                        <div class="spinner-border text-light" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
        } else {
            overlay.style.display = 'flex';
            document.getElementById('pdfLoadingMessage').textContent = message;
        }
    }

    /**
     * Hide loading overlay
     */
    hideLoadingOverlay() {
        const overlay = document.getElementById('pdfLoadingOverlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }
}

// Export to global scope
window.TournamentPDFExporter = TournamentPDFExporter;

console.log('PDF Export System loaded');
