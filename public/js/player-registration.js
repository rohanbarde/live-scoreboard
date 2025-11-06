// Initialize Firebase (already done in firebase.js)
console.log('Initializing registration system...');

// Get Firebase database reference
const database = firebase.database();
console.log('Firebase database reference obtained');

// References to different user types in Firebase
const registrationsRef = database.ref('registrations');
const usersRef = database.ref('users');

// Test database connection
database.ref('.info/connected').on('value', (snapshot) => {
  const status = snapshot.val() ? 'connected' : 'disconnected';
  console.log('Firebase connection status:', status);
});

document.addEventListener('DOMContentLoaded', () => {
  // Function to update form based on user type
  function updateFormForUserType(userType) {
    // Show/hide fields based on user type
    if (userType === 'player') {
      playerFields.style.display = 'block';
      coachRefereeFields.style.display = 'none';
      // Make player-specific fields required
      document.getElementById('weight').required = true;
      document.getElementById('team').required = true;
      document.getElementById('licenseNumber').required = false;
    } else if (['coach', 'referee'].includes(userType)) {
      playerFields.style.display = 'none';
      coachRefereeFields.style.display = 'block';
      document.getElementById('weight').required = false;
      document.getElementById('team').required = false;
      document.getElementById('licenseNumber').required = true;
    } else {
      playerFields.style.display = 'none';
      coachRefereeFields.style.display = 'none';
      document.getElementById('weight').required = false;
      document.getElementById('team').required = false;
      document.getElementById('licenseNumber').required = false;
    }
  }
  
  // Toggle fields based on user type selection
  const userTypeSelect = document.getElementById('userType');
  const playerFields = document.getElementById('playerFields');
  const coachRefereeFields = document.getElementById('coachRefereeFields');
  
  if (userTypeSelect) {
    userTypeSelect.addEventListener('change', () => {
      const userType = userTypeSelect.value;
      updateFormForUserType(userType);
    });
    
    // Initialize form for the default selection
    updateFormForUserType(userTypeSelect.value);
  }
  console.log('DOM fully loaded, setting up event listeners...');
  const form = document.getElementById('registrationForm');
  const successMessage = document.getElementById('successMessage');
  const errorMessage = document.getElementById('errorMessage');
  const submitBtn = form ? form.querySelector('button[type="submit"]') : null;
  const originalBtnText = submitBtn ? submitBtn.innerHTML : '';

  if (!form || !submitBtn) {
    console.error('Form or submit button not found');
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    
    // Disable submit button and show loading state
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registering...';
    
    try {
      const userType = document.getElementById('userType').value;
      const userData = {
        fullName: document.getElementById('fullName').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        userType: userType,
        createdAt: firebase.database.ServerValue.TIMESTAMP
      };

      // Add user type specific data
      if (userType === 'player') {
        userData.playerInfo = {
          weight: parseFloat(document.getElementById('weight').value.trim()),
          team: document.getElementById('team').value.trim(),
          gender: document.getElementById('gender').value
        };
      } else if (['coach', 'referee'].includes(userType)) {
        userData.licenseInfo = {
          licenseNumber: document.getElementById('licenseNumber').value.trim(),
          verified: false
        };
      }

      console.log('Saving user registration:', userData);
      
      // Save the user registration to Firebase
      const newUserRef = registrationsRef.push();
      const userId = newUserRef.key;
      
      // Save to both registrations and users collections
      const batch = {};
      batch[`/registrations/${userId}`] = userData;
      batch[`/users/${userId}`] = userData;
      
      await database.ref().update(batch);
      
      console.log('User registration saved successfully with ID:', userId);
      
      // Reset the form but keep the user type
      const selectedUserType = document.getElementById('userType').value;
      form.reset();
      
      // Restore the selected user type
      document.getElementById('userType').value = selectedUserType;
      
      // Update the form based on the selected user type
      updateFormForUserType(selectedUserType);
      
      // Hide all dynamic fields
      playerFields.style.display = selectedUserType === 'player' ? 'block' : 'none';
      coachRefereeFields.style.display = (selectedUserType === 'coach' || selectedUserType === 'referee') ? 'block' : 'none';

      // Show success message
      const successMsg = `${userType.charAt(0).toUpperCase() + userType.slice(1)} registration submitted successfully!`;
      showMessage(successMessage, successMsg);
      
    } catch (error) {
      console.error('Error during registration:', error);
      showMessage(errorMessage, 'Error during registration. Please try again.');
    } finally {
      // Re-enable submit button and restore original text
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      }
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
