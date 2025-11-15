// LOGIN WITH FIREBASE AUTH
function loginUser() {
    const email = document.getElementById("emailInput").value;
    const password = document.getElementById("passwordInput").value;

    firebase.auth().signInWithEmailAndPassword(email, password)
    .then((userCredential) => {
        // Login successful → GO TO PLAYER REGISTRATION PAGE
        window.location.href = "/player-registration.html";
    })
    .catch((error) => {
        document.getElementById("error-msg").innerText = "Invalid email or password.";
        console.error(error);
    });
}
