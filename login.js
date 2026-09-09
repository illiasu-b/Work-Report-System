// login.js
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!email || !password) {
    showNotification('Please fill in all fields', 'error');
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.innerHTML = 'Signing in...';

  const success = await authManager.loginUser(email, password);
  
  if (success) {
    setTimeout(() => {
      window.location.href = authManager.userRole === 'admin' 
        ? 'admin.html' 
        : 'employee-dashboard.html';
    }, 1500);
  } else {
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Sign In';
  }
});

// Toggle password visibility
document.querySelector('.toggle-password').addEventListener('click', (e) => {
  e.preventDefault();
  const passwordInput = document.getElementById('password');
  const button = e.target.closest('.toggle-password');
  
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    button.innerHTML = '<i class="icon-eye-off"></i>';
  } else {
    passwordInput.type = 'password';
    button.innerHTML = '<i class="icon-eye"></i>';
  }
});