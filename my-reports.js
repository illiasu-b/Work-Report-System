// my-reports.js

let allMyReports = [];

document.addEventListener('DOMContentLoaded', async () => {
  await authManager.waitForAuthReady();

  if (!authManager.isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }
  if (authManager.isAdmin()) {
    window.location.href = 'admin.html';
    return;
  }

  await loadMyReports();
  setupEventListeners();
  setupNotifications();

  // If arrived with ?id=xxx (e.g. from the dashboard's "View" link), open that report
  const params = new URLSearchParams(window.location.search);
  const reportId = params.get('id');
  if (reportId) {
    openReportModal(reportId);
  }
});

function setupNotifications() {
  const userId = authManager.getCurrentUserId();
  if (!userId) return;

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
        // First run of this query needs a composite index - Firestore logs
        // a console link to auto-create it. Click it once and it's fixed.
        console.error('Notifications listener error:', error);
      }
    );

  document.getElementById('notificationBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('notificationDropdown').classList.toggle('open');
  });

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

async function loadMyReports() {
  try {
    const userId = authManager.getCurrentUserId();
    const snapshot = await db.collection('reports')
      .where('employeeId', '==', userId)
      .get();

    allMyReports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    allMyReports.sort((a, b) => new Date(b.reportDate) - new Date(a.reportDate));

    renderReports(allMyReports);
  } catch (error) {
    console.error('Load my reports error:', error);
    showNotification('Failed to load your reports', 'error');
  }
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
      <td>${formatDate(report.reportDate)}</td>
      <td>${(report.tasksCompleted || '').substring(0, 60)}${report.tasksCompleted && report.tasksCompleted.length > 60 ? '...' : ''}</td>
      <td>${report.hoursWorked || 0}h</td>
      <td>${(report.priorityLevel || '').toUpperCase()}</td>
      <td>
        <span class="status-badge status-${report.status}">${report.status.toUpperCase()}</span>
        ${report.isLate ? '<span class="late-badge">LATE</span>' : ''}
      </td>
      <td>
        <a href="#" class="action-link" onclick="openReportModal('${report.id}'); return false;">View</a>
      </td>
    </tr>
  `).join('');
}

function openReportModal(reportId) {
  const report = allMyReports.find(r => r.id === reportId);
  if (!report) {
    showNotification('Report not found', 'error');
    return;
  }

  document.getElementById('reportModalBody').innerHTML = `
    <p><strong>Date:</strong> ${formatDate(report.reportDate)}</p>
    <p><strong>Hours Worked:</strong> ${report.hoursWorked || 0}</p>
    <p><strong>Progress:</strong> ${report.progressPercentage || 0}%</p>
    <p><strong>Priority:</strong> ${(report.priorityLevel || '').toUpperCase()}</p>
    <p><strong>Status:</strong> <span class="status-badge status-${report.status}">${report.status.toUpperCase()}</span>${report.isLate ? ' <span class="late-badge">LATE</span>' : ''}</p>
    <hr>
    <p><strong>Tasks Completed:</strong><br>${report.tasksCompleted || '-'}</p>
    <p><strong>Challenges Faced:</strong><br>${report.challengesFaced || '-'}</p>
    <p><strong>Solutions Implemented:</strong><br>${report.solutionsImplemented || '-'}</p>
    <p><strong>Tomorrow's Plan:</strong><br>${report.tomorrowsPlan || '-'}</p>
    ${report.additionalNotes ? `<p><strong>Additional Notes:</strong><br>${report.additionalNotes}</p>` : ''}
    ${renderAttachmentsList(report.attachments)}
    ${report.reviewComment ? `<hr><p><strong>Manager Comment:</strong><br>${report.reviewComment}</p>` : ''}
  `;

  document.getElementById('reportModal').classList.add('active');
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

function closeReportModal() {
  document.getElementById('reportModal').classList.remove('active');
}

function applyFilters() {
  const searchTerm = document.getElementById('reportSearch').value.toLowerCase();
  const statusFilter = document.getElementById('statusFilter').value;

  let filtered = allMyReports;

  if (statusFilter !== 'all') {
    filtered = filtered.filter(r => r.status === statusFilter);
  }

  if (searchTerm) {
    filtered = filtered.filter(r =>
      (r.reportDate || '').toLowerCase().includes(searchTerm) ||
      (r.tasksCompleted || '').toLowerCase().includes(searchTerm)
    );
  }

  renderReports(filtered);
}

function setupEventListeners() {
  document.getElementById('logoutBtn').addEventListener('click', () => {
    authManager.logout();
  });

  document.getElementById('reportSearch').addEventListener('input', applyFilters);
  document.getElementById('statusFilter').addEventListener('change', applyFilters);

  document.getElementById('closeModalBtn').addEventListener('click', closeReportModal);

  document.getElementById('reportModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('reportModal')) {
      closeReportModal();
    }
  });
}