// LOGIN WITH FIREBASE AUTH
function loginUser() {
    const email = document.getElementById("emailInput").value;
    const password = document.getElementById("passwordInput").value;

    // Show loading state
    const errorMsg = document.getElementById("error-msg");
    errorMsg.innerText = "Logging in...";
    errorMsg.style.color = "#666";

    firebase.auth().signInWithEmailAndPassword(email, password)
    .then((userCredential) => {
        console.log('✅ Login successful:', userCredential.user.email);
        
        // Check if there was an intended destination before login
        const intendedDestination = sessionStorage.getItem('intendedDestination');
        sessionStorage.removeItem('intendedDestination');
        
        // Redirect to intended page or default to tournament dashboard
        if (intendedDestination && !intendedDestination.includes('log-in')) {
            window.location.replace(intendedDestination);
        } else {
            window.location.replace("/views/tournament-dashboard.html");
        }
    })
    .catch((error) => {
        errorMsg.style.color = "#dc3545";
        
        // Provide user-friendly error messages
        switch(error.code) {
            case 'auth/invalid-email':
                errorMsg.innerText = "Invalid email address format.";
                break;
            case 'auth/user-disabled':
                errorMsg.innerText = "This account has been disabled.";
                break;
            case 'auth/user-not-found':
                errorMsg.innerText = "No account found with this email.";
                break;
            case 'auth/wrong-password':
                errorMsg.innerText = "Incorrect password.";
                break;
            case 'auth/too-many-requests':
                errorMsg.innerText = "Too many failed attempts. Please try again later.";
                break;
            default:
                errorMsg.innerText = "Login failed. Please check your credentials.";
        }
        
        console.error('Login error:', error.code, error.message);
    });
}

// Check if user is already logged in
firebase.auth().onAuthStateChanged(user => {
    if (user) {
        console.log('✅ User already logged in:', user.email);
        
        // Only auto-redirect if there's an intended destination
        // This allows users to visit login page to logout or check status
        const intendedDestination = sessionStorage.getItem('intendedDestination');
        
        if (intendedDestination && !intendedDestination.includes('log-in')) {
            console.log('🔄 Redirecting to intended destination:', intendedDestination);
            sessionStorage.removeItem('intendedDestination');
            window.location.replace(intendedDestination);
        } else {
            // User is logged in but no intended destination
            // Show a message or add a logout button instead of auto-redirecting
            console.log('ℹ️ User is already logged in. Showing login page with status.');
            
            // Optional: Show a message that user is already logged in
            const errorMsg = document.getElementById("error-msg");
            if (errorMsg) {
                errorMsg.innerText = `Already logged in as ${user.email}. `;
                errorMsg.style.color = "#28a745";
                
                // Add a link to go to dashboard or logout
                const linkSpan = document.createElement('span');
                linkSpan.innerHTML = '<a href="/views/tournament-dashboard.html" style="color: #007bff;">Go to Dashboard</a> or <a href="#" onclick="firebase.auth().signOut(); return false;" style="color: #dc3545;">Logout</a>';
                errorMsg.appendChild(linkSpan);
            }
        }
    }
});
