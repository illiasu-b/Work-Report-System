// employee-dashboard.js

document.addEventListener('DOMContentLoaded', async () => {
  // Wait for Firebase to actually confirm the auth state before checking it -
  // otherwise this runs before login is confirmed and causes a redirect loop.
  await authManager.waitForAuthReady();

  // Employees only - admins get redirected to the admin dashboard
  if (!authManager.isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }
  if (authManager.isAdmin()) {
    window.location.href = 'admin.html';
    return;
  }

  await loadEmployeeInfo();
  await loadMyStats();
  setupEventListeners();
});

async function loadEmployeeInfo() {
  try {
    const userId = authManager.getCurrentUserId();
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      document.getElementById('employeeNameDisplay').textContent = userData.fullName || 'there';
    }
  } catch (error) {
    console.error('Load employee info error:', error);
  }
}

async function loadMyStats() {
  try {
    const userId = authManager.getCurrentUserId();
    const snapshot = await db.collection('reports')
      .where('employeeId', '==', userId)
      .get();

    const myReports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    document.getElementById('myTotalReports').textContent = myReports.length;
    document.getElementById('myApprovedReports').textContent =
      myReports.filter(r => r.status === 'approved').length;
    document.getElementById('myPendingReports').textContent =
      myReports.filter(r => r.status === 'pending').length;
    document.getElementById('myRejectedReports').textContent =
      myReports.filter(r => r.status === 'rejected').length;

    // Sort newest first, show the 5 most recent
    const recent = myReports
      .sort((a, b) => new Date(b.reportDate) - new Date(a.reportDate))
      .slice(0, 5);

    displayRecentReports(recent);
  } catch (error) {
    console.error('Load my stats error:', error);
    showNotification('Failed to load your report data', 'error');
  }
}

function displayRecentReports(reports) {
  const container = document.getElementById('recentReportsList');

  if (reports.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📄</div>
        <h3>No reports yet</h3>
        <p>Submit your first daily work report to get started</p>
        <a href="report.html" class="btn btn-primary">Submit Report</a>
      </div>
    `;
    return;
  }

  container.innerHTML = reports.map(report => `
    <div class="report-row">
      <div class="report-info">
        <h4>${formatDate(report.reportDate)}</h4>
        <small>${report.tasksCompleted ? report.tasksCompleted.substring(0, 60) : ''}${report.tasksCompleted && report.tasksCompleted.length > 60 ? '...' : ''}</small>
      </div>
      <div class="report-status">
        <span class="status-badge status-${report.status}">
          ${report.status.toUpperCase()}
        </span>
      </div>
      <div class="report-actions">
        <a href="my-reports.html?id=${report.id}" class="action-link">View</a>
      </div>
    </div>
  `).join('');
}

function setupEventListeners() {
  document.getElementById('logoutBtn').addEventListener('click', () => {
    authManager.logout();
  });
}