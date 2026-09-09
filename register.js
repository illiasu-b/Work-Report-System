// pages/auth/register.js
document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const fullName = document.getElementById('fullName').value.trim();
  const employeeId = document.getElementById('employeeId').value.trim();
  const email = document.getElementById('email').value.trim();
  const department = document.getElementById('department').value;
  const position = document.getElementById('position').value.trim();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const agreeTerms = document.getElementById('agreeTerms').checked;

  // Validation
  if (!fullName || !employeeId || !email || !department || !position || !password) {
    showNotification('Please fill in all fields', 'error');
    return;
  }

  if (password.length < 8) {
    showNotification('Password must be at least 8 characters', 'error');
    return;
  }

  if (password !== confirmPassword) {
    showNotification('Passwords do not match', 'error');
    return;
  }

  if (!agreeTerms) {
    showNotification('Please agree to the terms and conditions', 'error');
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.innerHTML = 'Creating Account...';

  const success = await authManager.registerEmployee(
    email,
    password,
    fullName,
    employeeId,
    department
  );

  if (success) {
    setTimeout(() => {
      window.location.href = '/pages/auth/login.html';
    }, 1500);
  } else {
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Create Account';
  }
});

// Toggle password visibility
document.querySelectorAll('.toggle-password').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const input = e.target.closest('.password-field').querySelector('input');
    if (input.type === 'password') {
      input.type = 'text';
      e.target.closest('button').innerHTML = '<i class="icon-eye-off"></i>';
    } else {
      input.type = 'password';
      e.target.closest('button').innerHTML = '<i class="icon-eye"></i>';
    }
  });
});
