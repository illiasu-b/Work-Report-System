// report.js

// EmailJS config - replace with your actual IDs from the EmailJS dashboard
const EMAILJS_PUBLIC_KEY = 'qJKglsuqxDYbvs15S';
const EMAILJS_SERVICE_ID = 'service_ges6r6b';
const EMAILJS_TEMPLATE_ID = 'template_5r7hvas'; // one generic template, reused for all notification types

let attachments = [];
let currentSettings = {};

document.addEventListener('DOMContentLoaded', async () => {
  // Wait for Firebase to actually confirm the auth state before checking it -
  // otherwise this runs before login is confirmed and causes a redirect loop.
  await authManager.waitForAuthReady();

  // Check authentication
  if (!authManager.isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }

  // This is the employee-facing report form; admins shouldn't submit reports
  // here, so send them straight to their own dashboard instead of bouncing
  // them through login.html (which just redirects them right back anyway).
  if (authManager.isAdmin()) {
    window.location.href = 'admin.html';
    return;
  }

  // Populate employee information
  const userId = authManager.getCurrentUserId();
  const userDoc = await db.collection('users').doc(userId).get();

  if (!userDoc.exists) {
    showNotification('User profile not found. Please contact your administrator.', 'error');
    setTimeout(() => { window.location.href = 'login.html'; }, 2000);
    return;
  }

  const userData = userDoc.data();
  document.getElementById('employeeName').value = userData.fullName   || '';
  document.getElementById('employeeId').value   = userData.employeeId || '';
  document.getElementById('department').value   = userData.department || '';
  document.getElementById('position').value     = userData.position   || '';

  // Set today's date as default
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('reportDate').value = today;

  currentSettings = await loadAppSettings();
  setupEventListeners();
});

async function loadAppSettings() {
  try {
    const doc = await db.collection('settings').doc('app').get();
    return doc.exists ? doc.data() : {};
  } catch (error) {
    // If this fails (e.g. offline, or the settings doc doesn't exist yet),
    // fall back to APP_CONFIG defaults rather than blocking the whole form.
    console.error('Load settings error:', error);
    return {};
  }
}

function setupEventListeners() {
  // Auto-calculate hours worked
  document.getElementById('startTime').addEventListener('change', calculateHours);
  document.getElementById('endTime').addEventListener('change', calculateHours);

  // Progress percentage
  document.getElementById('progressPercentage').addEventListener('input', (e) => {
    document.getElementById('progressValue').textContent = e.target.value + '%';
  });

  // File upload
  const fileUploadArea = document.getElementById('fileUploadArea');
  const fileInput = document.getElementById('fileInput');

  fileUploadArea.addEventListener('click', () => fileInput.click());

  fileUploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileUploadArea.classList.add('dragover');
  });

  fileUploadArea.addEventListener('dragleave', () => {
    fileUploadArea.classList.remove('dragover');
  });

  fileUploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    fileUploadArea.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
  });

  fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
  });

  // Form submission
  document.getElementById('reportForm').addEventListener('submit', handleFormSubmit);

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', () => {
    authManager.logout();
  });
}

function calculateHours() {
  const startTime = document.getElementById('startTime').value;
  const endTime = document.getElementById('endTime').value;

  if (startTime && endTime) {
    const start = new Date(`2000-01-01 ${startTime}`);
    const end = new Date(`2000-01-01 ${endTime}`);
    const hours = (end - start) / (1000 * 60 * 60);

    if (hours > 0) {
      document.getElementById('hoursWorked').value = hours.toFixed(2);
    }
  }
}

function handleFiles(files) {
  // Prefer the admin-configured settings; fall back to APP_CONFIG defaults
  // if settings failed to load or haven't been set yet.
  const allowedTypes = (currentSettings.allowedFileTypes && currentSettings.allowedFileTypes.length)
    ? currentSettings.allowedFileTypes
    : APP_CONFIG.ALLOWED_FILE_TYPES;

    const FIRESTORE_FILE_LIMIT = 650 * 1024; // files are stored in Firestore, about 1 MB per document
  const configuredMax = currentSettings.maxFileSizeMB
    ? currentSettings.maxFileSizeMB * 1024 * 1024
    : APP_CONFIG.MAX_FILE_SIZE;
  const maxSizeBytes = Math.min(configuredMax, FIRESTORE_FILE_LIMIT);

  for (let file of files) {
    const fileExt = file.name.split('.').pop().toLowerCase();

        if (!allowedTypes.includes(fileExt)) {
      showNotification(`File type .${fileExt} is not allowed (allowed: ${allowedTypes.join(', ')})`, 'error');
      continue;
    }

    if (file.size > maxSizeBytes) {
      showNotification(`File ${file.name} is too large (maximum ${Math.floor(maxSizeBytes / 1024)} KB)`, 'error');
      continue;
    }

    attachments.push(file);
    displayAttachment(file);
  }
}

function displayAttachment(file) {
  const attachmentsList = document.getElementById('attachmentsList');
  const fileItem = document.createElement('div');
  fileItem.className = 'attachment-item';
  fileItem.innerHTML = `
    <div class="file-info">
      <span class="file-icon">${getFileIcon(file.name)}</span>
      <div class="file-details">
        <span class="file-name">${file.name}</span>
        <span class="file-size">${formatFileSize(file.size)}</span>
      </div>
    </div>
    <button type="button" class="remove-file" onclick="removeAttachment('${file.name}')">
      ✕
    </button>
  `;
  attachmentsList.appendChild(fileItem);
}

function removeAttachment(fileName) {
  attachments = attachments.filter(f => f.name !== fileName);
  const attachmentsList = document.getElementById('attachmentsList');
  attachmentsList.innerHTML = '';
  attachments.forEach(displayAttachment);
}

function getFileIcon(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  const icons = {
    pdf: '📄',
    doc: '📝',
    docx: '📝',
    xls: '📊',
    xlsx: '📊',
    jpg: '🖼️',
    jpeg: '🖼️',
    png: '🖼️'
  };
  return icons[ext] || '📎';
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Compares "now" against today's deadline, both expressed in the company's
// configured timezone - so the deadline means the same real-world moment
// for every employee, regardless of their device's local timezone.
function isPastDeadline(settings) {
  const tz = settings.timezone || 'UTC';
  const deadlineStr = settings.reportDeadline || '18:00';

  const nowInTz = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
  const [hours, minutes] = deadlineStr.split(':').map(Number);

  const deadlineToday = new Date(nowInTz);
  deadlineToday.setHours(hours, minutes, 0, 0);

  return nowInTz > deadlineToday;
}

async function handleFormSubmit(e) {
  e.preventDefault();

  const reportData = {
    reportDate: document.getElementById('reportDate').value,
    startTime: document.getElementById('startTime').value,
    endTime: document.getElementById('endTime').value,
    hoursWorked: parseFloat(document.getElementById('hoursWorked').value),
    progressPercentage: parseInt(document.getElementById('progressPercentage').value),
    tasksCompleted: document.getElementById('tasksCompleted').value,
    challengesFaced: document.getElementById('challengesFaced').value,
    solutionsImplemented: document.getElementById('solutionsImplemented').value,
    tomorrowsPlan: document.getElementById('tomorrowsPlan').value,
    priorityLevel: document.getElementById('priorityLevel').value,
    additionalNotes: document.getElementById('additionalNotes').value,
    attachments: []
  };

  // Validate required fields
  if (!reportData.tasksCompleted || !reportData.tomorrowsPlan) {
    showNotification('Please fill in all required fields', 'error');
    return;
  }

  // Deadline enforcement - only applies when submitting *today's* report;
  // backdating an earlier report shouldn't be blocked by today's deadline.
  const isToday = reportData.reportDate === new Date().toISOString().split('T')[0];
  if (isToday && isPastDeadline(currentSettings)) {
    if (!currentSettings.allowLateSubmissions) {
      showNotification(
        `Submissions are closed after ${currentSettings.reportDeadline || '18:00'} (${currentSettings.timezone || 'UTC'}). Late submissions are not allowed.`,
        'error'
      );
      return;
    }
    // Late submissions are allowed - tag it so admins can see it was late
    reportData.isLate = true;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.innerHTML = 'Submitting...';

  try {
    // Submit report
    const reportId = await reportManager.submitReport(reportData);

    if (reportId) {
      // Upload attachments and keep track of any that fail
      const failed = [];
      for (const file of attachments) {
        const result = await reportManager.uploadAttachment(reportId, file);
        if (!result) failed.push(file.name);
      }

      if (failed.length) {
        // Roll back so the employee can submit again instead of ending up with a report missing its files
        try {
          await reportManager.deleteAttachments(reportId);
          await db.collection('reports').doc(reportId).delete();
          showNotification(`Report not submitted. These files could not be attached: ${failed.join(', ')}. Please try again.`, 'error');
        } catch (rollbackError) {
          console.error('Rollback error:', rollbackError);
          showNotification(`Report saved, but these files could not be attached: ${failed.join(', ')}. Tell your administrator.`, 'error');
          setTimeout(() => { window.location.href = 'my-reports.html'; }, 4000);
        }
        return;
      }

      if (currentSettings.notifyOnSubmit) {
        await emailAdminsOnSubmit(reportData);
      }

      setTimeout(() => {
        window.location.href = 'my-reports.html';
      }, 1500);
    }
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Submit Report';
  }
}
async function emailAdminsOnSubmit(reportData) {
  try {
    const adminsSnapshot = await db.collection('users').where('role', '==', 'admin').get();
    const employeeName = document.getElementById('employeeName').value || 'An employee';

    await Promise.all(adminsSnapshot.docs.map(doc => {
      const adminEmail = doc.data().email;
      if (!adminEmail) return Promise.resolve();

      return emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        to_email: adminEmail,
        subject_line: `New report from ${employeeName}`,
        message_body: `${employeeName} submitted a report for ${reportData.reportDate}. Tasks: ${reportData.tasksCompleted}`
      }, EMAILJS_PUBLIC_KEY);
    }));
  } catch (error) {
    // Email failing shouldn't block the report submission itself
    console.error('Email admins on submit error:', error);
  }
}