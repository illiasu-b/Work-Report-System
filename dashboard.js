// pages/admin/dashboard.js

let statusChart, dailyChart;

document.addEventListener('DOMContentLoaded', async () => {
  await authManager.waitForAuthReady();

  if (!authManager.isAuthenticated() || !authManager.isAdmin()) {
    window.location.href = 'login.html';
    return;
  }

  // Load dashboard data
  // NOTE: charts must be created before loadDashboardStats() runs, because
  // loadDashboardStats() calls updateCharts() internally, which expects
  // statusChart/dailyChart to already exist.
  setupCharts();
  await loadDashboardStats();
  setupEventListeners();
  setupNotifications();
  await loadProfileInfo();
});

async function loadProfileInfo() {
  try {
    const userId = authManager.getCurrentUserId();
    const userDoc = await db.collection('users').doc(userId).get();

    if (userDoc.exists) {
      const data = userDoc.data();
      document.getElementById('profileName').textContent = data.fullName || data.email || 'Admin';

      const profileImg = document.getElementById('profileImg');
      if (profileImg) {
        if (data.profilePicture) {
          profileImg.src = data.profilePicture;
        } else {
          // No picture set yet - hide the <img> instead of showing a broken image icon
          profileImg.style.display = 'none';
        }
      }
    }
  } catch (error) {
    console.error('Load profile info error:', error);
  }
}

function setupNotifications() {
  const userId = authManager.getCurrentUserId();
  if (!userId) return;

  // Live-updates the badge/dropdown whenever a notification is added,
  // read, or removed - no page refresh needed.
  db.collection('notifications')
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .limit(20)
    .onSnapshot(
      snapshot => {
        const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderNotifications(notifications);
      },
      error => {
        // Firestore will throw here the first time this composite query runs,
        // with a console link to auto-create the required index. Click that
        // link once and the query will work from then on.
        console.error('Notifications listener error:', error);
      }
    );

  document.getElementById('notificationBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('notificationDropdown').classList.toggle('open');
  });

  // Close the dropdown when clicking anywhere outside it
  document.addEventListener('click', (e) => {
    const wrapper = document.querySelector('.notification-wrapper');
    if (wrapper && !wrapper.contains(e.target)) {
      document.getElementById('notificationDropdown').classList.remove('open');
    }
  });
}

function renderNotifications(notifications) {
  const unreadCount = notifications.filter(n => !n.read).length;
  const badge = document.getElementById('notificationBadge');
  badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
  badge.style.display = unreadCount > 0 ? 'flex' : 'none';

  const list = document.getElementById('notificationList');
  if (notifications.length === 0) {
    list.innerHTML = '<div class="notification-empty">No notifications yet</div>';
    return;
  }

  list.innerHTML = notifications.map(n => `
    <div class="notification-item ${n.read ? '' : 'unread'}" data-id="${n.id}">
      <div class="notification-item-title">${n.title || 'Notification'}</div>
      <div class="notification-item-message">${n.message || ''}</div>
      <div class="notification-item-time">${formatNotificationTime(n.createdAt)}</div>
    </div>
  `).join('');

  list.querySelectorAll('.notification-item').forEach(item => {
    item.addEventListener('click', () => markNotificationRead(item.dataset.id));
  });
}

function formatNotificationTime(timestamp) {
  if (!timestamp || !timestamp.toDate) return '';
  const date = timestamp.toDate();
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' · ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

async function markNotificationRead(notificationId) {
  try {
    await db.collection('notifications').doc(notificationId).update({ read: true });
  } catch (error) {
    console.error('Mark notification read error:', error);
  }
}

async function loadDashboardStats() {
  try {
    // Get employees (may fail if Firestore index not yet created)
    let employees = [];
    try {
      employees = await employeeManager.getAllEmployees() || [];
    } catch (e) {
      console.warn('Employees query failed — index may still be building:', e.message);
    }
    document.getElementById('totalEmployees').textContent = employees.length;

    // Get all reports
    const allReports = await reportManager.getAllReports();

    // Today's date
    const today = new Date().toISOString().split('T')[0];
    const todayReports = allReports.filter(r => r.reportDate === today);
    document.getElementById('reportsToday').textContent = todayReports.length;

    // Pending reports
    const pending = allReports.filter(r => r.status === 'pending');
    document.getElementById('pendingReports').textContent = pending.length;

    // Approved today - based on when it was actually reviewed/approved,
    // not when the report was originally submitted (a report from last
    // week that gets approved today should still count here).
    const approvedToday = allReports.filter(r => {
      if (r.status !== 'approved' || !r.reviewedAt) return false;
      const reviewedDate = r.reviewedAt.toDate
        ? r.reviewedAt.toDate().toISOString().split('T')[0]
        : null;
      return reviewedDate === today;
    });
    document.getElementById('approvedToday').textContent = approvedToday.length;

    // Rejected reports
    const rejected = allReports.filter(r => r.status === 'rejected');
    document.getElementById('rejectedReports').textContent = rejected.length;

    // This week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekReports = allReports.filter(r => 
      new Date(r.reportDate) >= weekAgo
    );
    document.getElementById('reportsWeek').textContent = weekReports.length;

    // Update charts only if data exists
    if (allReports && allReports.length >= 0) {
      updateCharts(allReports);
    }

    // Display recent reports
    displayRecentReports((allReports || []).slice(0, 5));
  } catch (error) {
    console.error('Load dashboard stats error:', error);
    showNotification('Failed to load dashboard data', 'error');
  }
}

function setupCharts() {
  // Status pie chart
  const statusCtx = document.getElementById('statusChart').getContext('2d');
  statusChart = new Chart(statusCtx, {
    type: 'doughnut',
    data: {
      labels: ['Pending', 'Approved', 'Rejected'],
      datasets: [{
        data: [0, 0, 0],
        backgroundColor: ['#FFA500', '#4CAF50', '#F44336'],
        borderColor: ['#fff', '#fff', '#fff'],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  });

  // Daily reports line chart
  const dailyCtx = document.getElementById('dailyChart').getContext('2d');
  dailyChart = new Chart(dailyCtx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Reports',
        data: [],
        borderColor: '#2196F3',
        backgroundColor: 'rgba(33, 150, 243, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: true
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

function updateCharts(reports) {
  // Update status chart
  const statusData = {
    pending: reports.filter(r => r.status === 'pending').length,
    approved: reports.filter(r => r.status === 'approved').length,
    rejected: reports.filter(r => r.status === 'rejected').length
  };

  statusChart.data.datasets[0].data = [
    statusData.pending,
    statusData.approved,
    statusData.rejected
  ];
  statusChart.update();

  // Update daily chart
  const last7Days = getLast7Days();
  const dailyData = last7Days.map(date => 
    reports.filter(r => r.reportDate === date).length
  );

  dailyChart.data.labels = last7Days.map(date => 
    new Date(date).toLocaleDateString('en-US', { weekday: 'short' })
  );
  dailyChart.data.datasets[0].data = dailyData;
  dailyChart.update();
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

function displayRecentReports(reports) {
  const container = document.getElementById('recentReportsList');
  container.innerHTML = reports.map(report => `
    <div class="report-row">
      <div class="report-info">
        <h4>${report.employeeName}</h4>
        <small>${report.reportDate}</small>
      </div>
      <div class="report-status">
        <span class="status-badge status-${report.status}">
          ${report.status.toUpperCase()}
        </span>
      </div>
      <div class="report-actions">
        <a href="manage-reports.html?id=${report.id}" class="action-link">View</a>
      </div>
    </div>
  `).join('');
}

function setupEventListeners() {
  // Logout
  document.getElementById('logoutBtn').addEventListener('click', () => {
    authManager.logout();
  });

  // Global search
  document.getElementById('globalSearch').addEventListener('input', async (e) => {
    const query = e.target.value;
    if (query.length > 2) {
      // Implement search functionality
      console.log('Searching for:', query);
    }
  });
}