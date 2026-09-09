// profile.js

let currentUserData = null;

document.addEventListener('DOMContentLoaded', async () => {
  await authManager.waitForAuthReady();

  if (!authManager.isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }

  await loadProfile();
  setupEventListeners();
});

async function loadProfile() {
  try {
    const userId = authManager.getCurrentUserId();
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      showNotification('Profile not found', 'error');
      return;
    }

    currentUserData = userDoc.data();

    document.getElementById('fullName').value = currentUserData.fullName || '';
    document.getElementById('employeeId').value = currentUserData.employeeId || '';
    document.getElementById('email').value = currentUserData.email || '';
    document.getElementById('department').value = currentUserData.department || '';
    document.getElementById('position').value = currentUserData.position || '';
    document.getElementById('phone').value = currentUserData.phone || '';

    showProfilePicture(currentUserData.profilePicture);
  } catch (error) {
    console.error('Load profile error:', error);
    showNotification('Failed to load profile', 'error');
  }
}

function showProfilePicture(url) {
  const img = document.getElementById('profilePicturePreview');
  const icon = document.getElementById('profilePictureIcon');

  if (url) {
    img.src = url;
    img.style.display = 'block';
    icon.style.display = 'none';
  } else {
    img.style.display = 'none';
    icon.style.display = 'flex';
  }
}

function setupEventListeners() {
  document.getElementById('logoutBtn').addEventListener('click', () => {
    authManager.logout();
  });

  // Profile info form
  document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const userId = authManager.getCurrentUserId();
    const profileData = {
      fullName: document.getElementById('fullName').value.trim(),
      department: document.getElementById('department').value,
      position: document.getElementById('position').value.trim(),
      phone: document.getElementById('phone').value.trim()
    };

    if (!profileData.fullName) {
      showNotification('Full name is required', 'error');
      return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    await authManager.updateProfile(userId, profileData);

    submitBtn.disabled = false;
    submitBtn.textContent = 'Save Changes';
  });

  // Profile picture upload
  document.getElementById('changePictureBtn').addEventListener('click', () => {
    document.getElementById('profilePictureInput').click();
  });

  document.getElementById('profilePictureInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const userId = authManager.getCurrentUserId();
    const downloadURL = await authManager.uploadProfilePicture(userId, file);

    if (downloadURL) {
      showProfilePicture(downloadURL);
    }
  });

  // Change password form
  document.getElementById('passwordForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const newPassword = document.getElementById('newPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewPassword').value;

    if (newPassword.length < 8) {
      showNotification('Password must be at least 8 characters', 'error');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      showNotification('Passwords do not match', 'error');
      return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Updating...';

    const success = await authManager.changePassword(newPassword);

    if (success) {
      document.getElementById('passwordForm').reset();
    }

    submitBtn.disabled = false;
    submitBtn.textContent = 'Update Password';
  });
}