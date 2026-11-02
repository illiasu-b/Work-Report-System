document.getElementById('resetForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  if (!email) {
    showNotification('Please enter your email', 'error');
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.innerHTML = 'Sending...';

  const success = await authManager.resetPassword(email);

  submitBtn.disabled = false;
  submitBtn.innerHTML = 'Send Reset Link';

  if (success) {
    e.target.reset();
  }
});