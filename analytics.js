// analytics.js

document.addEventListener('DOMContentLoaded', async () => {
  // Wait for Firebase to actually confirm the auth state before checking it -
  // otherwise this runs before login is confirmed and causes a redirect loop.
  await authManager.waitForAuthReady();

  // Check if admin
  if (!authManager.isAuthenticated() || !authManager.isAdmin()) {
    window.location.href = 'login.html';
    return;
  }

  // Initialize charts
  await chartManager.initializeCharts();
  
  // Setup real-time listeners
  chartManager.setupRealtimeListeners();
  
  // Load metrics
  await loadMetrics();
  
  // Setup event listeners
  setupEventListeners();
});

async function loadMetrics() {
  try {
    const reports = await reportManager.getAllReports();
    
    // Total reports
    document.getElementById('totalReports').textContent = reports.length;
    
    // Approval rate
    const approved = reports.filter(r => r.status === 'approved').length;
    const approvalRate = reports.length > 0 
      ? ((approved / reports.length) * 100).toFixed(1) 
      : 0;
    document.getElementById('approvalRate').textContent = `${approvalRate}%`;
    
    // This month reports
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthReports = reports.filter(r => {
      const reportDate = new Date(r.reportDate);
      return reportDate >= monthStart;
    });
    document.getElementById('thisMonthReports').textContent = monthReports.length;
    
    // Average submission time (hours worked)
    const totalHours = reports.reduce((sum, r) => sum + (r.hoursWorked || 0), 0);
    const avgHours = reports.length > 0 ? (totalHours / reports.length).toFixed(1) : 0;
    document.getElementById('avgSubmissionTime').textContent = `${avgHours}h`;
  } catch (error) {
    console.error('Load metrics error:', error);
  }
}

function setupEventListeners() {
  // Refresh charts button
  document.getElementById('refreshChartsBtn').addEventListener('click', async () => {
    showNotification('Refreshing charts...', 'info');
    await chartManager.refreshAllCharts();
    await loadMetrics();
    showNotification('Charts refreshed!', 'success');
  });

  // Print charts button
  document.getElementById('printChartsBtn').addEventListener('click', () => {
    chartManager.printCharts();
  });

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', () => {
    authManager.logout();
  });
}