/**
 * Authentication Guard for Firebase
 * This script protects pages from unauthorized access
 * Include this script at the TOP of any protected page's <head> section
 */

(function() {
    'use strict';
    
    // Configuration
    const AUTH_CONFIG = {
        loginPage: '/views/log-in.html',
        checkInterval: 5000, // Check auth state every 5 seconds
        sessionTimeout: 3600000, // 1 hour in milliseconds
        publicPages: [
            '/views/log-in.html', 
            '/log-in.html', 
            '/index.html',
            '/views/scoreboard.html',
            '/scoreboard.html',
            '/views/vmix.html',
            '/vmix.html'
        ]
    };

    // Track authentication state
    let authCheckComplete = false;
    let currentUser = null;
    let lastActivityTime = Date.now();
    let sessionCheckInterval = null;

    /**
     * Check if current page is public (doesn't require authentication)
     */
    function isPublicPage() {
        const currentPath = window.location.pathname;
        return AUTH_CONFIG.publicPages.some(page => 
            currentPath.includes(page) || currentPath === '/'
        );
    }

    /**
     * Redirect to login page
     */
    function redirectToLogin() {
        console.warn('🔒 Authentication required. Redirecting to login...');
        // Store the intended destination
        sessionStorage.setItem('intendedDestination', window.location.href);
        window.location.replace(AUTH_CONFIG.loginPage);
    }

    /**
     * Update last activity time
     */
    function updateActivity() {
        lastActivityTime = Date.now();
        // Store in sessionStorage for cross-tab sync
        sessionStorage.setItem('lastActivity', lastActivityTime.toString());
    }

    /**
     * Check for session timeout
     */
    function checkSessionTimeout() {
        const now = Date.now();
        const lastActivity = parseInt(sessionStorage.getItem('lastActivity') || lastActivityTime);
        const timeSinceActivity = now - lastActivity;

        if (timeSinceActivity > AUTH_CONFIG.sessionTimeout) {
            console.warn('⏰ Session timeout. Logging out...');
            firebase.auth().signOut().then(() => {
                alert('Your session has expired. Please log in again.');
                redirectToLogin();
            });
        }
    }

    /**
     * Initialize activity tracking
     */
    function initActivityTracking() {
        // Track user activity
        const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
        activityEvents.forEach(event => {
            document.addEventListener(event, updateActivity, { passive: true });
        });

        // Initial activity timestamp
        updateActivity();

        // Periodic session check
        sessionCheckInterval = setInterval(checkSessionTimeout, AUTH_CONFIG.checkInterval);
    }

    /**
     * Clean up activity tracking
     */
    function cleanupActivityTracking() {
        if (sessionCheckInterval) {
            clearInterval(sessionCheckInterval);
            sessionCheckInterval = null;
        }
    }

    /**
     * Main authentication check
     */
    function checkAuthentication() {
        // Skip check for public pages
        if (isPublicPage()) {
            console.log('📖 Public page - no authentication required');
            authCheckComplete = true;
            return;
        }

        // Wait for Firebase to be available
        if (typeof firebase === 'undefined' || !firebase.auth) {
            console.warn('⏳ Waiting for Firebase to initialize...');
            setTimeout(checkAuthentication, 100);
            return;
        }

        // Set a timeout to prevent infinite waiting
        let authTimeout = setTimeout(() => {
            if (!authCheckComplete) {
                console.error('⚠️ Authentication check timeout - forcing completion');
                authCheckComplete = true;
                // Try to clear any stuck auth state
                try {
                    localStorage.clear();
                    sessionStorage.clear();
                } catch (e) {
                    console.error('Error clearing storage:', e);
                }
                redirectToLogin();
            }
        }, 10000); // 10 second timeout

        // Check authentication state
        firebase.auth().onAuthStateChanged(function(user) {
            clearTimeout(authTimeout);
            
            if (user) {
                // User is authenticated
                console.log('✅ User authenticated:', user.email);
                currentUser = user;
                authCheckComplete = true;
                
                // Initialize activity tracking
                initActivityTracking();

                // Verify user session is still valid
                user.getIdToken(true).catch(error => {
                    console.error('❌ Token verification failed:', error);
                    // Clear potentially corrupted auth state
                    firebase.auth().signOut().then(() => {
                        redirectToLogin();
                    });
                });

                // Listen for auth state changes (e.g., logout in another tab)
                window.addEventListener('storage', function(e) {
                    if (e.key === 'firebase:authUser:' + firebase.app().options.apiKey) {
                        if (!e.newValue) {
                            console.warn('🚪 User logged out in another tab');
                            window.location.reload();
                        }
                    }
                });

            } else {
                // No user is authenticated
                console.warn('❌ No authenticated user found');
                authCheckComplete = true;
                cleanupActivityTracking();
                redirectToLogin();
            }
        }, function(error) {
            clearTimeout(authTimeout);
            console.error('❌ Authentication check error:', error);
            authCheckComplete = true;
            // Clear potentially corrupted auth state
            try {
                firebase.auth().signOut();
            } catch (e) {
                console.error('Error signing out:', e);
            }
            redirectToLogin();
        });
    }

    /**
     * Prevent page rendering until auth check is complete
     */
    function hidePageUntilAuth() {
        if (isPublicPage()) return;

        // Create overlay to hide content during auth check
        const overlay = document.createElement('div');
        overlay.id = 'auth-check-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #ffffff;
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: Arial, sans-serif;
        `;
//        overlay.innerHTML = `
//            <div style="text-align: center;">
//                <div style="font-size: 24px; margin-bottom: 10px;">🔐</div>
//                <div style="font-size: 16px; color: #666;">Verifying authentication...</div>
//            </div>
//        `;

        // Add overlay when DOM is ready
        if (document.body) {
            document.body.appendChild(overlay);
        } else {
            document.addEventListener('DOMContentLoaded', function() {
                document.body.appendChild(overlay);
            });
        }

        // Remove overlay once auth check is complete
        const checkAndRemove = setInterval(function() {
            if (authCheckComplete) {
                clearInterval(checkAndRemove);
                const overlayElement = document.getElementById('auth-check-overlay');
                if (overlayElement) {
                    overlayElement.style.opacity = '0';
                    overlayElement.style.transition = 'opacity 0.3s';
                    setTimeout(() => overlayElement.remove(), 300);
                }
            }
        }, 50);

        // Timeout fallback (in case something goes wrong)
        setTimeout(function() {
            const overlayElement = document.getElementById('auth-check-overlay');
            if (overlayElement && !authCheckComplete) {
                console.error('⚠️ Auth check timeout - removing overlay');
                overlayElement.remove();
            }
        }, 5000);
    }

    /**
     * Expose utility functions globally
     */
    window.AuthGuard = {
        getCurrentUser: function() {
            return currentUser;
        },
        isAuthenticated: function() {
            return currentUser !== null;
        },
        logout: function() {
            cleanupActivityTracking();
            return firebase.auth().signOut().then(() => {
                sessionStorage.clear();
                redirectToLogin();
            });
        },
        requireAuth: function(callback) {
            if (authCheckComplete && currentUser) {
                callback(currentUser);
            } else {
                const checkInterval = setInterval(() => {
                    if (authCheckComplete) {
                        clearInterval(checkInterval);
                        if (currentUser) {
                            callback(currentUser);
                        } else {
                            redirectToLogin();
                        }
                    }
                }, 100);
            }
        }
    };

    // Initialize immediately
    hidePageUntilAuth();
    checkAuthentication();

    // Prevent back button after logout
    window.addEventListener('pageshow', function(event) {
        if (event.persisted || (window.performance && window.performance.navigation.type === 2)) {
            // Page was loaded from cache (back button)
            if (!isPublicPage()) {
                checkAuthentication();
            }
        }
    });

})();
