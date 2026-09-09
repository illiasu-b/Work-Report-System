// manage-reports.js

let allReports = [];
let employeeNameMap = {};
let currentReviewReportId = null;

document.addEventListener('DOMContentLoaded', async () => {
  await authManager.waitForAuthReady();

  if (!authManager.isAuthenticated() || !authManager.isAdmin()) {
    window.location.href = 'login.html';
    return;
  }

  await loadEmployeeNames();
  await loadReports();
  setupEventListeners();
});

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
      <td><span class="status-badge status-${report.status}">${report.status.toUpperCase()}</span></td>
      <td>
        <a href="#" class="action-link" onclick="openReviewModal('${report.id}'); return false;">Review</a>
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
    <p><strong>Current Status:</strong> <span class="status-badge status-${report.status}">${report.status.toUpperCase()}</span></p>
    <hr>
    <p><strong>Tasks Completed:</strong><br>${report.tasksCompleted || '-'}</p>
    <p><strong>Challenges Faced:</strong><br>${report.challengesFaced || '-'}</p>
    <p><strong>Solutions Implemented:</strong><br>${report.solutionsImplemented || '-'}</p>
    <p><strong>Tomorrow's Plan:</strong><br>${report.tomorrowsPlan || '-'}</p>
    ${report.additionalNotes ? `<p><strong>Additional Notes:</strong><br>${report.additionalNotes}</p>` : ''}
    ${report.reviewComment ? `<hr><p><strong>Previous Comment:</strong><br>${report.reviewComment}</p>` : ''}
  `;

  document.getElementById('reviewComment').value = '';
  document.getElementById('reviewModal').classList.add('active');
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
    }

    showNotification(`Report ${newStatus}`, 'success');
    closeReviewModal();
    await loadReports();
    applyFilters();
  } catch (error) {
    console.error('Review report error:', error);
    showNotification('Failed to update report', 'error');
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