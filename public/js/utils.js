/**
 * Utility functions for Judo Scoreboard
 */

/**
 * Pads a number with leading zeros
 * @param {number} n - The number to pad
 * @returns {string} The padded string
 */
function pad(n) { 
    return String(n).padStart(2, '0'); 
}

/**
 * Formats seconds into MM:SS format
 * @param {number} sec - Time in seconds
 * @returns {string} Formatted time string
 */
function formatTimeFromSec(sec) { 
    sec = Math.max(0, Math.floor(sec)); 
    return `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`; 
}

/**
 * Escapes HTML special characters to prevent XSS
 * @param {string} s - The string to escape
 * @returns {string} The escaped string
 */
function escapeHtml(s) { 
    return (s || '').toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Make functions available globally
window.pad = pad;
window.formatTimeFromSec = formatTimeFromSec;
window.escapeHtml = escapeHtml;