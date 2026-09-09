// settings.js

const SETTINGS_DOC_PATH = { collection: 'settings', doc: 'app' };

document.addEventListener('DOMContentLoaded', async () => {
  await authManager.waitForAuthReady();

  // Settings is an admin-only page
  if (!authManager.isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }

  if (!authManager.isAdmin()) {
    window.location.href = 'employee-dashboard.html';
    return;
  }

  await loadSettings();
  setupEventListeners();
});

async function loadSettings() {
  try {
    const settingsDoc = await db.collection(SETTINGS_DOC_PATH.collection).doc(SETTINGS_DOC_PATH.doc).get();
    const settings = settingsDoc.exists ? settingsDoc.data() : {};

    // Company Information
    document.getElementById('companyName').value = settings.companyName || '';
    document.getElementById('timezone').value = settings.timezone || 'UTC';
    document.getElementById('workWeekStart').value = settings.workWeekStart || 'monday';

    // Report Settings
    document.getElementById('reportDeadline').value = settings.reportDeadline || '18:00';
    document.getElementById('maxFileSize').value = settings.maxFileSizeMB || 10;
    document.getElementById('allowedFileTypes').value =
      (settings.allowedFileTypes || ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png']).join(', ');
    document.getElementById('requireApproval').checked = settings.requireApproval !== false;
    document.getElementById('allowLateSubmissions').checked = !!settings.allowLateSubmissions;

    // Notification Settings
    document.getElementById('notifyOnSubmit').checked = !!settings.notifyOnSubmit;
    document.getElementById('notifyOnMissing').checked = !!settings.notifyOnMissing;
    document.getElementById('notifyOnStatusChange').checked = settings.notifyOnStatusChange !== false;
  } catch (error) {
    console.error('Load settings error:', error);
    showNotification('Failed to load settings', 'error');
  }
}

function setupEventListeners() {
  document.getElementById('companyForm').addEventListener('submit', handleCompanySubmit);
  document.getElementById('reportSettingsForm').addEventListener('submit', handleReportSettingsSubmit);
  document.getElementById('notificationSettingsForm').addEventListener('submit', handleNotificationSettingsSubmit);

  document.getElementById('logoutBtn').addEventListener('click', () => {
    authManager.logout();
  });
}

async function saveSettingsPatch(patch, submitBtn, savedMessage) {
  const originalText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = 'Saving...';

  try {
    await db.collection(SETTINGS_DOC_PATH.collection).doc(SETTINGS_DOC_PATH.doc).set(patch, { merge: true });
    showNotification(savedMessage, 'success');
  } catch (error) {
    console.error('Save settings error:', error);
    showNotification('Failed to save settings', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
}

async function handleCompanySubmit(e) {
  e.preventDefault();

  const patch = {
    companyName: document.getElementById('companyName').value,
    timezone: document.getElementById('timezone').value,
    workWeekStart: document.getElementById('workWeekStart').value
  };

  await saveSettingsPatch(patch, e.target.querySelector('button[type="submit"]'), 'Company information saved');
}

async function handleReportSettingsSubmit(e) {
  e.preventDefault();

  const allowedFileTypes = document.getElementById('allowedFileTypes').value
    .split(',')
    .map(ext => ext.trim().toLowerCase())
    .filter(Boolean);

  const patch = {
    reportDeadline: document.getElementById('reportDeadline').value,
    maxFileSizeMB: parseInt(document.getElementById('maxFileSize').value, 10),
    allowedFileTypes,
    requireApproval: document.getElementById('requireApproval').checked,
    allowLateSubmissions: document.getElementById('allowLateSubmissions').checked
  };

  await saveSettingsPatch(patch, e.target.querySelector('button[type="submit"]'), 'Report settings saved');
}

async function handleNotificationSettingsSubmit(e) {
  e.preventDefault();

  const patch = {
    notifyOnSubmit: document.getElementById('notifyOnSubmit').checked,
    notifyOnMissing: document.getElementById('notifyOnMissing').checked,
    notifyOnStatusChange: document.getElementById('notifyOnStatusChange').checked
  };

  await saveSettingsPatch(patch, e.target.querySelector('button[type="submit"]'), 'Notification settings saved');
}