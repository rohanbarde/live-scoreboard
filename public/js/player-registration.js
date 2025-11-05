document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('playerForm');
  const successMessage = document.getElementById('successMessage');

  form.addEventListener('submit', (event) => {
    event.preventDefault(); // Stop form from refreshing page

    const player = {
      name: document.getElementById('playerName').value.trim(),
      weight: document.getElementById('playerWeight').value.trim(),
      team: document.getElementById('playerTeam').value.trim(),
    };

    // Example: print to console or save to backend/Firebase later
    console.log('Player Registered:', player);

    // Reset the form
    form.reset();

    // Show success message
    successMessage.classList.remove('hidden');

    // Hide message after 3 seconds
    setTimeout(() => {
      successMessage.classList.add('hidden');
    }, 3000);
  });
});
