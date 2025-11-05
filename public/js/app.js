///**
// * Main application entry point for the Judo Scoreboard
// */
//
//// Initialize components when the DOM is fully loaded
//document.addEventListener('DOMContentLoaded', () => {
//  try {
//    // Initialize components
//    window.matchTimer = new MatchTimer();
//    window.scoreboard = new Scoreboard();
//
//    // Set up global error handling
//    window.addEventListener('error', handleGlobalError);
//
//    // Set up service worker for offline support
//    if ('serviceWorker' in navigator) {
//      registerServiceWorker();
//    }
//
//    console.log('Judo Scoreboard initialized');
//  } catch (error) {
//    console.error('Error initializing application:', error);
//    alert('An error occurred while initializing the application. Please check the console for details.');
//  }
//});
//
///**
// * Handle global errors
// * @param {ErrorEvent} event - The error event
// */
//function handleGlobalError(event) {
//  console.error('Unhandled error:', event.error || event.message || 'Unknown error');
//  // You could add user-friendly error reporting here
//}
//
///**
// * Register service worker for offline support
// */
//function registerServiceWorker() {
//  window.addEventListener('load', async () => {
//    try {
//      const registration = await navigator.serviceWorker.register('/sw.js');
//      console.log('ServiceWorker registration successful');
//
//      // Check for updates
//      registration.addEventListener('updatefound', () => {
//        const newWorker = registration.installing;
//        newWorker.addEventListener('statechange', () => {
//          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
//            // New update available
//            console.log('New update available!');
//            // You could show a notification to the user here
//          }
//        });
//      });
//    } catch (error) {
//      console.error('ServiceWorker registration failed:', error);
//    }
//  });
//}
//
//// Expose app to global scope
//window.app = {
//  // Version information
//  version: '3.0.0',
//
//  // Public methods
//  toggleFullscreen: () => window.utils.toggleFullscreen(),
//
//  // Debugging helpers
//  debug: {
//    logState: () => ({
//      timer: {
//        isRunning: window.matchTimer?.isRunning,
//        elapsedTime: window.matchTimer?.elapsedTime,
//        isGoldenScore: window.matchTimer?.isGoldenScore
//      },
//      scoreboard: {
//        logEntries: window.scoreboard?.log?.length || 0
//      }
//    })
//  }
//};
