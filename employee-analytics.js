// employee-analytics.js

let myCharts = {};

document.addEventListener('DOMContentLoaded', async () => {
  // Wait for Firebase to actually confirm the auth state before checking it -
  // otherwise this runs before login is confirmed and causes a redirect loop.
  await authManager.waitForAuthReady();

  if (!authManager.isAuthenticated() || authManager.isAdmin()) {
    window.location.href = 'login.html';
    return;
  }

  const userId = authManager.getCurrentUserId();
  const myReports = await reportManager.getMyReports();

  await initializeMyCharts(myReports);
  loadMyStats(myReports);

  document.getElementById('logoutBtn').addEventListener('click', () => {
    authManager.logout();
  });
});

async function initializeMyCharts(reports) {
  // 1. Status Chart
  const statusData = {
    pending: reports.filter(r => r.status === 'pending').length,
    approved: reports.filter(r => r.status === 'approved').length,
    rejected: reports.filter(r => r.status === 'rejected').length
  };

  const statusCtx = document.getElementById('myStatusChart').getContext('2d');
  myCharts.status = new Chart(statusCtx, {
    type: 'doughnut',
    data: {
      labels: ['Pending', 'Approved', 'Rejected'],
      datasets: [{
        data: [statusData.pending, statusData.approved, statusData.rejected],
        backgroundColor: ['#FFA500', '#4CAF50', '#F44336'],
        borderColor: '#fff',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });

  // 2. Monthly Submissions Chart
  const last30Days = getLast30Days();
  const monthlyData = last30Days.map(date => 
    reports.filter(r => r.reportDate === date).length
  );

  const monthlyCtx = document.getElementById('myMonthlyChart').getContext('2d');
  myCharts.monthly = new Chart(monthlyCtx, {
    type: 'bar',
    data: {
      labels: last30Days.map(d => formatDateShort(d)),
      datasets: [{
        label: 'Submissions',
        data: monthlyData,
        backgroundColor: '#2196F3',
        borderColor: '#1976D2',
        borderWidth: 2,
        borderRadius: 5
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });

  // 3. Hours Worked Chart
  const last7Days = getLast7Days();
  const hoursData = last7Days.map(date => {
    const report = reports.find(r => r.reportDate === date);
    return report?.hoursWorked || 0;
  });

  const hoursCtx = document.getElementById('myHoursChart').getContext('2d');
  myCharts.hours = new Chart(hoursCtx, {
    type: 'line',
    data: {
      labels: last7Days.map(d => formatDateShort(d)),
      datasets: [{
        label: 'Hours Worked',
        data: hoursData,
        borderColor: '#2196F3',
        backgroundColor: 'rgba(33, 150, 243, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointBackgroundColor: '#2196F3'
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => `${value}h`
          }
        }
      },
      plugins: {
        legend: { display: true }
      }
    }
  });

  // 4. Progress Trend Chart
  const progressData = reports
    .sort((a, b) => new Date(a.reportDate) - new Date(b.reportDate))
    .map(r => r.progressPercentage);
  const progressDates = reports
    .sort((a, b) => new Date(a.reportDate) - new Date(b.reportDate))
    .map(r => formatDateShort(r.reportDate));

  const progressCtx = document.getElementById('myProgressChart').getContext('2d');
  myCharts.progress = new Chart(progressCtx, {
    type: 'line',
    data: {
      labels: progressDates,
      datasets: [{
        label: 'Progress Percentage',
        data: progressData,
        borderColor: '#4CAF50',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#4CAF50'
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback: (value) => `${value}%`
          }
        }
      },
      plugins: {
        legend: { display: true }
      }
    }
  });
}

function loadMyStats(reports) {
  document.getElementById('myTotalReports').textContent = reports.length;
  document.getElementById('myApprovedReports').textContent = 
    reports.filter(r => r.status === 'approved').length;
  document.getElementById('myRejectedReports').textContent = 
    reports.filter(r => r.status === 'rejected').length;
  document.getElementById('myPendingReports').textContent = 
    reports.filter(r => r.status === 'pending').length;
}

function getLast7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    days.push(date.toISOString().split('T')[0]);
  }
  return days;
}

function getLast30Days() {
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    days.push(date.toISOString().split('T')[0]);
  }
  return days;
}

function formatDateShort(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}