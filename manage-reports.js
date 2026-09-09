// manage-reports.js

// EmailJS config - replace with your actual IDs from the EmailJS dashboard
const EMAILJS_PUBLIC_KEY = 'qJKglsuqxDYbvs15S';
const EMAILJS_SERVICE_ID = 'service_ges6r6b';
const EMAILJS_TEMPLATE_ID = 'template_5r7hvas'; // same generic template used everywhere

let allReports = [];
let employeeNameMap = {};
let currentReviewReportId = null;
let currentSettings = {};

document.addEventListener('DOMContentLoaded', async () => {
  await authManager.waitForAuthReady();

  if (!authManager.isAuthenticated() || !authManager.isAdmin()) {
    window.location.href = 'login.html';
    return;
  }

  currentSettings = await loadAppSettings();
  await loadEmployeeNames();
  await loadReports();
  setupEventListeners();
});

async function loadAppSettings() {
  try {
    const doc = await db.collection('settings').doc('app').get();
    return doc.exists ? doc.data() : {};
  } catch (error) {
    console.error('Load settings error:', error);
    return {};
  }
}

async function loadEmployeeNames() {
  try {
    const snapshot = await db.collection('users').get();
    employeeNameMap = {};
    snapshot.docs.forEach(doc => {
      employeeNameMap[doc.id] = doc.data().fullName || doc.data().email || 'Unknown';
    });
  } catch (error) {
    console.error('Load employee names error:', error);
  }
}

async function loadReports() {
  try {
    const snapshot = await db.collection('reports').get();
    allReports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    allReports.sort((a, b) => new Date(b.reportDate) - new Date(a.reportDate));
    renderReports(allReports);
  } catch (error) {
    console.error('Load reports error:', error);
    showNotification('Failed to load reports', 'error');
  }
}

function employeeNameFor(report) {
  return report.employeeName || employeeNameMap[report.employeeId] || 'Unknown';
}

function renderReports(reports) {
  const tbody = document.getElementById('reportsTableBody');
  const table = document.getElementById('reportsTable');
  const emptyState = document.getElementById('emptyState');

  if (reports.length === 0) {
    table.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }

  table.style.display = 'table';
  emptyState.style.display = 'none';

  tbody.innerHTML = reports.map(report => `
    <tr>
      <td>${employeeNameFor(report)}</td>
      <td>${formatDate(report.reportDate)}</td>
      <td>${(report.priorityLevel || '').toUpperCase()}</td>
      <td>${report.hoursWorked || 0}h</td>
      <td>
        <span class="status-badge status-${report.status}">${report.status.toUpperCase()}</span>
        ${report.isLate ? '<span class="late-badge">LATE</span>' : ''}
      </td>
      <td>
        <a href="#" class="action-link" onclick="openReviewModal('${report.id}'); return false;">Review</a>
        · <a href="#" class="action-link" onclick="downloadReportFile('${report.id}'); return false;">Download File</a>
        · <a href="#" class="action-link" style="color: var(--danger-color);" onclick="deleteReport('${report.id}'); return false;">Delete</a>
      </td>
    </tr>
  `).join('');
}

function applyFilters() {
  const searchTerm = document.getElementById('reportSearch').value.toLowerCase();
  const statusFilter = document.getElementById('statusFilter').value;

  let filtered = allReports;

  if (statusFilter !== 'all') {
    filtered = filtered.filter(r => r.status === statusFilter);
  }

  if (searchTerm) {
    filtered = filtered.filter(r => employeeNameFor(r).toLowerCase().includes(searchTerm));
  }

  renderReports(filtered);
}

function openReviewModal(reportId) {
  const report = allReports.find(r => r.id === reportId);
  if (!report) {
    showNotification('Report not found', 'error');
    return;
  }

  currentReviewReportId = reportId;

  document.getElementById('reviewModalDetails').innerHTML = `
    <p><strong>Employee:</strong> ${employeeNameFor(report)}</p>
    <p><strong>Date:</strong> ${formatDate(report.reportDate)}</p>
    <p><strong>Hours Worked:</strong> ${report.hoursWorked || 0}</p>
    <p><strong>Progress:</strong> ${report.progressPercentage || 0}%</p>
    <p><strong>Priority:</strong> ${(report.priorityLevel || '').toUpperCase()}</p>
    <p><strong>Current Status:</strong> <span class="status-badge status-${report.status}">${report.status.toUpperCase()}</span>${report.isLate ? ' <span class="late-badge">LATE</span>' : ''}</p>
    <hr>
    <p><strong>Tasks Completed:</strong><br>${report.tasksCompleted || '-'}</p>
    <p><strong>Challenges Faced:</strong><br>${report.challengesFaced || '-'}</p>
    <p><strong>Solutions Implemented:</strong><br>${report.solutionsImplemented || '-'}</p>
    <p><strong>Tomorrow's Plan:</strong><br>${report.tomorrowsPlan || '-'}</p>
    ${report.additionalNotes ? `<p><strong>Additional Notes:</strong><br>${report.additionalNotes}</p>` : ''}
    ${renderAttachmentsList(report.attachments)}
    ${report.reviewComment ? `<hr><p><strong>Previous Comment:</strong><br>${report.reviewComment}</p>` : ''}
  `;

  document.getElementById('reviewComment').value = '';
  document.getElementById('reviewModal').classList.add('active');
}

function renderAttachmentsList(attachments) {
  if (!attachments || attachments.length === 0) return '';

  return `
    <hr>
    <p><strong>Attachments:</strong></p>
    <div class="attachments-list">
      ${attachments.map(a => `
        <div class="attachment-item">
          <div class="file-info">
            <span class="file-icon">${getFileIconForName(a.fileName)}</span>
            <div class="file-details">
              <span class="file-name">${a.fileName}</span>
              <span class="file-size">${formatFileSizeDisplay(a.fileSize)}</span>
            </div>
          </div>
          <a href="${a.downloadURL}" target="_blank" rel="noopener noreferrer" class="btn btn-text">⬇️ Download</a>
        </div>
      `).join('')}
    </div>
  `;
}

function getFileIconForName(fileName) {
  const ext = (fileName || '').split('.').pop().toLowerCase();
  const icons = {
    pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊',
    jpg: '🖼️', jpeg: '🖼️', png: '🖼️'
  };
  return icons[ext] || '📎';
}

function formatFileSizeDisplay(bytes) {
  if (!bytes) return '';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function closeReviewModal() {
  document.getElementById('reviewModal').classList.remove('active');
  currentReviewReportId = null;
}

async function reviewReport(newStatus) {
  if (!currentReviewReportId) return;

  const comment = document.getElementById('reviewComment').value.trim();
  const userId = authManager.getCurrentUserId();

  try {
    await db.collection('reports').doc(currentReviewReportId).update({
      status: newStatus,
      reviewComment: comment,
      reviewedBy: userId,
      reviewedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Notify the employee who submitted it
    const report = allReports.find(r => r.id === currentReviewReportId);
    if (report && report.employeeId) {
      await authManager.createNotification(
        report.employeeId,
        `Report ${newStatus === 'approved' ? 'Approved' : 'Rejected'}`,
        comment || `Your report from ${formatDate(report.reportDate)} was ${newStatus}.`,
        newStatus === 'approved' ? 'success' : 'warning'
      );

      if (currentSettings.notifyOnStatusChange) {
        await emailEmployeeOnStatusChange(report, newStatus, comment);
      }
    }

    showNotification(`Report ${newStatus}`, 'success');
    closeReviewModal();
    document.getElementById('statusFilter').value = 'all';
    await loadReports();
    applyFilters();
  } catch (error) {
    console.error('Review report error:', error);
    showNotification('Failed to update report', 'error');
  }
}

async function emailEmployeeOnStatusChange(report, newStatus, comment) {
  try {
    const employeeDoc = await db.collection('users').doc(report.employeeId).get();
    if (!employeeDoc.exists) return;

    const employeeEmail = employeeDoc.data().email;
    if (!employeeEmail) return;

    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      to_email: employeeEmail,
      subject_line: `Your report was ${newStatus}`,
      message_body: `Your report from ${formatDate(report.reportDate)} was ${newStatus}. Comment: ${comment || 'No additional comment.'}`
    }, EMAILJS_PUBLIC_KEY);
  } catch (error) {
    console.error('Email employee on status change error:', error);
  }
}

function downloadReportFile(reportId) {
  const report = allReports.find(r => r.id === reportId);
  if (!report) return;

  const attachments = report.attachments;

  if (!attachments || attachments.length === 0) {
    showNotification('This report has no uploaded file attached', 'info');
    return;
  }

  if (attachments.length === 1) {
    // Only one file - open it directly in a new tab, which triggers the browser's
    // normal download/view behavior depending on file type (PDF opens inline, etc.)
    window.open(attachments[0].downloadURL, '_blank', 'noopener,noreferrer');
    return;
  }

  // Multiple files - open each one; browsers may block some as popups if
  // triggered too fast, so stagger them slightly.
  attachments.forEach((a, i) => {
    setTimeout(() => {
      window.open(a.downloadURL, '_blank', 'noopener,noreferrer');
    }, i * 300);
  });
}

async function deleteReport(reportId) {
  const report = allReports.find(r => r.id === reportId);
  if (!report) return;

  const confirmed = confirm(
    `Delete this report from ${employeeNameFor(report)} (${formatDate(report.reportDate)})? This cannot be undone.`
  );
  if (!confirmed) return;

  try {
    await db.collection('reports').doc(reportId).delete();
    showNotification('Report deleted', 'success');
    await loadReports();
    applyFilters();
  } catch (error) {
    console.error('Delete report error:', error);
    showNotification('Failed to delete report', 'error');
  }
}

function setupEventListeners() {
  document.getElementById('logoutBtn').addEventListener('click', () => {
    authManager.logout();
  });

  document.getElementById('reportSearch').addEventListener('input', applyFilters);
  document.getElementById('statusFilter').addEventListener('change', applyFilters);

  document.getElementById('closeReviewModalBtn').addEventListener('click', closeReviewModal);
  document.getElementById('approveBtn').addEventListener('click', () => reviewReport('approved'));
  document.getElementById('rejectBtn').addEventListener('click', () => reviewReport('rejected'));

  document.getElementById('reviewModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('reviewModal')) {
      closeReviewModal();
    }
  });
}