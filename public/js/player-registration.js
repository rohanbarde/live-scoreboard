// Initialize Firebase (already done in firebase.js)
console.log('Initializing player registration...');

// Get Firebase database reference
const database = firebase.database();
console.log('Firebase database reference obtained');

// Reference to the players collection in Firebase
const playersRef = database.ref('players');
console.log('Players reference:', playersRef.toString());

// Test database connection
database.ref('.info/connected').on('value', (snapshot) => {
  console.log('Firebase connection status:', snapshot.val() ? 'connected' : 'disconnected');
});

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded, setting up event listeners...');
  const form = document.getElementById('playerForm');
  const successMessage = document.getElementById('successMessage');
  const errorMessage = document.getElementById('errorMessage');
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn.innerHTML;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    
    // Disable submit button and show loading state
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registering...';
    
    try {
      const player = {
        name: document.getElementById('playerName').value.trim(),
        weight: parseFloat(document.getElementById('playerWeight').value.trim()),
        team: document.getElementById('playerTeam').value.trim(),
        createdAt: firebase.database.ServerValue.TIMESTAMP
      };

      console.log('Saving player to Firebase:', player);
      
      // Save the player to Firebase
      const newPlayerRef = playersRef.push();
      console.log('New player reference created:', newPlayerRef.key);
      
      await newPlayerRef.set(player).then(() => {
        console.log('Player data saved successfully');
      }).catch((error) => {
        console.error('Failed to save player data:', error);
        throw error; // Re-throw to be caught by the catch block
      });

      // Reset the form
      form.reset();

      // Show success message
      showMessage(successMessage, 'Player registered successfully!');
    } catch (error) {
      console.error('Error saving player:', error);
      showMessage(errorMessage, 'Error registering player. Please try again.');
    } finally {
      // Re-enable submit button and restore original text
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  });

  // Helper function to show messages
  function showMessage(element, message) {
    const messageText = element.querySelector('span');
    messageText.textContent = message;
    element.classList.remove('hidden');
    
    // Hide message after 5 seconds
    setTimeout(() => {
      element.classList.add('hidden');
    }, 5000);
  }
});
