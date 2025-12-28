// ✅ Initialize Firebase (firebase.js must be included before this script)
console.log('Initializing player registration system...');

const database = firebase.database();
const registrationsRef = database.ref('registrations');
const usersRef = database.ref('users');

// Connection check
database.ref('.info/connected').on('value', (snapshot) => {
  console.log('Firebase connection:', snapshot.val() ? 'connected' : 'disconnected');
});

document.addEventListener('DOMContentLoaded', () => {
  const userTypeSelect = document.getElementById('userType');
  const playerFields = document.getElementById('playerFields');
  const coachRefereeFields = document.getElementById('coachRefereeFields');
  const form = document.getElementById('registrationForm');
  const successMessage = document.getElementById('successMessage');
  const errorMessage = document.getElementById('errorMessage');
  const submitBtn = form?.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn?.innerHTML || '';

  // 🔧 Toggle form sections depending on user type
  function updateFormForUserType(userType) {
    const photoInput = document.getElementById('photo');
    const genderSelect = document.getElementById('gender');

    if (userType === 'player') {
      playerFields.style.display = 'block';
      coachRefereeFields.style.display = 'none';
      document.getElementById('weight').required = true;
      document.getElementById('team').required = true;
      document.getElementById('licenseNumber').required = false;
      if (genderSelect) genderSelect.required = true;

      // ✅ Require photo for players only
      if (photoInput) {
        photoInput.required = true;
        photoInput.closest('.form-group').style.display = 'block';
      }
    } else if (['coach', 'referee'].includes(userType)) {
      playerFields.style.display = 'none';
      coachRefereeFields.style.display = 'block';
      document.getElementById('weight').required = false;
      document.getElementById('team').required = false;
      document.getElementById('licenseNumber').required = true;
      if (genderSelect) genderSelect.required = false;

      // hide photo field for others
      if (photoInput) {
        photoInput.required = false;
        photoInput.closest('.form-group').style.display = 'none';
      }
    } else {
      playerFields.style.display = 'none';
      coachRefereeFields.style.display = 'none';
      document.getElementById('licenseNumber').required = false;
      if (genderSelect) genderSelect.required = false;
      if (photoInput) {
        photoInput.required = false;
        photoInput.closest('.form-group').style.display = 'none';
      }
    }
  }

  // 🖼️ Photo preview before upload
  function setupPhotoPreview() {
    const photoInput = document.getElementById('photo');
    const previewImg = document.getElementById('photoPreview');

    if (photoInput && previewImg) {
      photoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            previewImg.src = ev.target.result;
            previewImg.style.display = 'block';
          };
          reader.readAsDataURL(file);
        } else {
          previewImg.style.display = 'none';
        }
      });
    }
  }

  if (userTypeSelect) {
    userTypeSelect.addEventListener('change', () => updateFormForUserType(userTypeSelect.value));
    updateFormForUserType(userTypeSelect.value);
  }

  setupPhotoPreview();

  if (!form || !submitBtn) {
    console.error('Form not found!');
    return;
  }

  // 📤 Handle registration
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registering...';

    try {
      const userType = document.getElementById('userType').value;
      let photoBase64 = '';

      // ✅ Only for players — convert photo to Base64
      if (userType === 'player') {
        const photoInput = document.getElementById('photo');
        const photoFile = photoInput?.files[0];

        if (!photoFile) {
          throw new Error('Player photo is required.');
        }

        photoBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result;
            resolve(result.split(',')[1]); // remove data:image prefix
          };
          reader.onerror = reject;
          reader.readAsDataURL(photoFile);
        });
      }

      // Get name fields
      const firstName = document.getElementById('firstName').value.trim();
      const middleName = document.getElementById('middleName').value.trim();
      const lastName = document.getElementById('lastName').value.trim();
      
      // Construct full name
      const fullName = middleName 
        ? `${firstName} ${middleName} ${lastName}`
        : `${firstName} ${lastName}`;
      
      // Common data
      const userData = {
        firstName,
        middleName,
        lastName,
        fullName,
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        userType,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
      };

      // Generate unique playerId for player (MJA/2025/XX)
      let playerId = '';
      if (userType === 'player') {
        // Fetch all player IDs to find the next available number
        const snapshot = await registrationsRef.once('value');
        let maxNum = 0;
        snapshot.forEach(child => {
          const p = child.val();
          if (p.playerId && /^MJA\/2025\/(\d+)$/.test(p.playerId)) {
            const num = parseInt(p.playerId.split('/').pop(), 10);
            if (num > maxNum) maxNum = num;
          }
        });
        playerId = `MJA/2025/${String(maxNum + 1).padStart(2, '0')}`;
        userData.playerId = playerId;
      }

      // Player data
      if (userType === 'player') {
        userData.playerInfo = {
          weight: parseFloat(document.getElementById('weight').value.trim()),
          team: document.getElementById('team').value.trim(),
          gender: document.getElementById('gender').value,
        };
        userData.photoBase64 = photoBase64; // ✅ Store Base64 photo in Firebase
      }

      // Coach / Referee data
      if (['coach', 'referee'].includes(userType)) {
        userData.licenseInfo = {
          licenseNumber: document.getElementById('licenseNumber').value.trim(),
          verified: false,
        };
      }

      console.log('Uploading data to Firebase:', userData);

      // Save to both collections
      const newUserRef = registrationsRef.push();
      const userId = newUserRef.key;
      const updates = {};
      updates[`/registrations/${userId}`] = userData;
      updates[`/users/${userId}`] = userData;

      await database.ref().update(updates);
      console.log('✅ registration saved:', userId);

      // Reset form
      const selectedType = document.getElementById('userType').value;
      form.reset();
      document.getElementById('userType').value = selectedType;
      updateFormForUserType(selectedType);
      
      // Clear photo preview and reset file input
      const photoInput = document.getElementById('photo');
      const previewImg = document.getElementById('photoPreview');
      if (photoInput) {
        photoInput.value = ''; // Clear the file input
      }
      if (previewImg) {
        previewImg.src = '';
        previewImg.style.display = 'none';
      }

      showMessage(successMessage, `${userType.charAt(0).toUpperCase() + userType.slice(1)} registered successfully!`);
    } catch (error) {
      console.error('❌ Registration error:', error);
      showMessage(errorMessage, error.message || 'Error during registration.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  });

  // Helper — message fade
  function showMessage(element, text) {
    const span = element.querySelector('span');
    span.textContent = text;
    element.classList.remove('hidden');
    setTimeout(() => element.classList.add('hidden'), 5000);
  }
});
