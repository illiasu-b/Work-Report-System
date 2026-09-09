// employees.js

let allEmployees = [];
let currentEmployeeReports = [];
let currentEmployeeDetail = null;

document.addEventListener('DOMContentLoaded', async () => {
  await authManager.waitForAuthReady();

  if (!authManager.isAuthenticated() || !authManager.isAdmin()) {
    window.location.href = 'login.html';
    return;
  }

  await loadEmployees();
  setupEventListeners();
});

async function loadEmployees() {
  try {
    const snapshot = await db.collection('users').get();
    allEmployees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    allEmployees.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
    renderEmployees(allEmployees);
  } catch (error) {
    console.error('Load employees error:', error);
    showNotification('Failed to load employees', 'error');
  }
}

function renderEmployees(employees) {
  const tbody = document.getElementById('employeesTableBody');
  const table = document.getElementById('employeesTable');
  const emptyState = document.getElementById('emptyState');

  if (employees.length === 0) {
    table.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }

  table.style.display = 'table';
  emptyState.style.display = 'none';

  tbody.innerHTML = employees.map(emp => `
    <tr>
      <td>${emp.fullName || '-'}</td>
      <td>${emp.employeeId || '-'}</td>
      <td>${emp.email || '-'}</td>
      <td>${emp.department || '-'}</td>
      <td>
        <span class="badge ${emp.role === 'admin' ? 'badge-active' : ''}">${(emp.role || 'employee').toUpperCase()}</span>
      </td>
      <td>
        <span class="badge ${emp.accountStatus === 'active' ? 'badge-active' : 'badge-disabled'}">
          ${(emp.accountStatus || 'active').toUpperCase()}
        </span>
      </td>
      <td style="white-space:nowrap;">
        <button class="btn btn-text" onclick="openEmployeeDetailModal('${emp.id}')" title="View Details">👁️</button>
        <button class="btn btn-text" onclick="openEditModal('${emp.id}')" title="Edit">✏️</button>
        <button class="btn btn-text" onclick="toggleRole('${emp.id}', '${emp.role}')" title="Promote/Demote">
          ${emp.role === 'admin' ? '⬇️' : '⬆️'}
        </button>
        <button class="btn btn-text" onclick="toggleStatus('${emp.id}', '${emp.accountStatus}')" title="Activate/Deactivate">
          ${emp.accountStatus === 'active' ? '🚫' : '✅'}
        </button>
        <button class="btn btn-text" onclick="deleteEmployee('${emp.id}', '${(emp.fullName || '').replace(/'/g, "\\'")}')" title="Delete">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function applyFilters() {
  const searchTerm = document.getElementById('employeeSearch').value.toLowerCase();
  const statusFilter = document.getElementById('statusFilter').value;
  const roleFilter = document.getElementById('roleFilter').value;

  let filtered = allEmployees;

  if (statusFilter !== 'all') {
    filtered = filtered.filter(e => (e.accountStatus || 'active') === statusFilter);
  }

  if (roleFilter !== 'all') {
    filtered = filtered.filter(e => (e.role || 'employee') === roleFilter);
  }

  if (searchTerm) {
    filtered = filtered.filter(e =>
      (e.fullName || '').toLowerCase().includes(searchTerm) ||
      (e.email || '').toLowerCase().includes(searchTerm) ||
      (e.employeeId || '').toLowerCase().includes(searchTerm)
    );
  }

  renderEmployees(filtered);
}

// ---------- Actions ----------

function openEditModal(userId) {
  const emp = allEmployees.find(e => e.id === userId);
  if (!emp) return;

  document.getElementById('editUserId').value = emp.id;
  document.getElementById('editFullName').value = emp.fullName || '';
  document.getElementById('editDepartment').value = emp.department || '';
  document.getElementById('editPosition').value = emp.position || '';
  document.getElementById('editPhone').value = emp.phone || '';

  document.getElementById('editModal').classList.add('active');
}

function closeEditModal() {
  document.getElementById('editModal').classList.remove('active');
}

async function saveEmployeeEdit(e) {
  e.preventDefault();

  const userId = document.getElementById('editUserId').value;
  const updates = {
    fullName: document.getElementById('editFullName').value.trim(),
    department: document.getElementById('editDepartment').value,
    position: document.getElementById('editPosition').value.trim(),
    phone: document.getElementById('editPhone').value.trim(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    await db.collection('users').doc(userId).update(updates);
    showNotification('Employee updated successfully', 'success');
    closeEditModal();
    await loadEmployees();
    applyFilters();
  } catch (error) {
    console.error('Update employee error:', error);
    showNotification('Failed to update employee', 'error');
  }
}

async function toggleRole(userId, currentRole) {
  const newRole = currentRole === 'admin' ? 'employee' : 'admin';
  const confirmMsg = newRole === 'admin'
    ? 'Promote this user to admin? They will gain full management access.'
    : 'Remove admin access from this user?';

  showConfirm(confirmMsg, async () => {
    try {
      await db.collection('users').doc(userId).update({
        role: newRole,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      showNotification(`User ${newRole === 'admin' ? 'promoted to admin' : 'demoted to employee'}`, 'success');
      await loadEmployees();
      applyFilters();
    } catch (error) {
      console.error('Toggle role error:', error);
      showNotification('Failed to update role', 'error');
    }
  });
}

async function toggleStatus(userId, currentStatus) {
  const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
  const confirmMsg = newStatus === 'disabled'
    ? 'Deactivate this account? They will no longer be able to use the system.'
    : 'Reactivate this account?';

  showConfirm(confirmMsg, async () => {
    try {
      await db.collection('users').doc(userId).update({
        accountStatus: newStatus,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      showNotification(`Account ${newStatus === 'active' ? 'activated' : 'deactivated'}`, 'success');
      await loadEmployees();
      applyFilters();
    } catch (error) {
      console.error('Toggle status error:', error);
      showNotification('Failed to update account status', 'error');
    }
  });
}

async function deleteEmployee(userId, fullName) {
  showConfirm(
    `Delete ${fullName || 'this employee'}? This removes their profile and reports data. This cannot be undone.`,
    async () => {
      try {
        // NOTE: This only deletes the Firestore profile document.
        // Their actual Firebase Authentication login credential is NOT deleted here -
        // the client-side SDK cannot delete other users' auth accounts. To fully
        // remove their ability to log in, a Cloud Function using the Admin SDK
        // (e.g. admin.auth().deleteUser(uid)) would need to be added to index.js
        // and called from here instead of/alongside this Firestore delete.
        await db.collection('users').doc(userId).delete();
        showNotification('Employee profile deleted', 'success');
        await loadEmployees();
        applyFilters();
      } catch (error) {
        console.error('Delete employee error:', error);
        showNotification('Failed to delete employee', 'error');
      }
    }
  );
}

// ---------- Employee Detail (profile + report history) ----------

async function openEmployeeDetailModal(userId) {
  const emp = allEmployees.find(e => e.id === userId);
  if (!emp) return;

  currentEmployeeDetail = emp;

  document.getElementById('employeeDetailInfo').innerHTML = `
    <p><strong>Name:</strong> ${emp.fullName || '-'}</p>
    <p><strong>Employee ID:</strong> ${emp.employeeId || '-'}</p>
    <p><strong>Email:</strong> ${emp.email || '-'}</p>
    <p><strong>Department:</strong> ${emp.department || '-'}</p>
    <p><strong>Position:</strong> ${emp.position || '-'}</p>
    <p><strong>Phone:</strong> ${emp.phone || '-'}</p>
    <p><strong>Role:</strong> ${(emp.role || 'employee').toUpperCase()}</p>
    <p><strong>Status:</strong> ${(emp.accountStatus || 'active').toUpperCase()}</p>
  `;

  document.getElementById('employeeReportsList').innerHTML = '<p>Loading reports...</p>';
  document.getElementById('employeeDetailModal').classList.add('active');

  try {
    const snapshot = await db.collection('reports').where('employeeId', '==', userId).get();
    currentEmployeeReports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    currentEmployeeReports.sort((a, b) => new Date(b.reportDate) - new Date(a.reportDate));
    renderEmployeeReports(currentEmployeeReports);
  } catch (error) {
    console.error('Load employee reports error:', error);
    document.getElementById('employeeReportsList').innerHTML = '<p>Failed to load reports.</p>';
  }
}

function renderEmployeeReports(reports) {
  const container = document.getElementById('employeeReportsList');

  if (reports.length === 0) {
    container.innerHTML = '<p style="color: var(--lighter-text);">No reports submitted yet.</p>';
    return;
  }

  container.innerHTML = `
    <table class="table">
      <thead>
        <tr><th>Date</th><th>Status</th><th>Hours</th><th>Actions</th></tr>
      </thead>
      <tbody>
        ${reports.map(r => `
          <tr>
            <td>${formatDate(r.reportDate)}</td>
            <td>
              <span class="status-badge status-${r.status}">${r.status.toUpperCase()}</span>
              ${r.isLate ? '<span class="late-badge">LATE</span>' : ''}
            </td>
            <td>${r.hoursWorked || 0}h</td>
            <td style="white-space:nowrap;">
              <a href="#" class="action-link" onclick="viewEmployeeReport('${r.id}'); return false;">View</a>
              · <a href="#" class="action-link" onclick="downloadEmployeeReportFile('${r.id}'); return false;">Download File</a>
              · <a href="#" class="action-link" style="color: var(--danger-color);" onclick="deleteEmployeeReport('${r.id}'); return false;">Delete</a>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function viewEmployeeReport(reportId) {
  const report = currentEmployeeReports.find(r => r.id === reportId);
  if (!report) return;

  document.getElementById('employeeReportDetailBody').innerHTML = `
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
    ${report.reviewComment ? `<hr><p><strong>Review Comment:</strong><br>${report.reviewComment}</p>` : ''}
  `;
  document.getElementById('employeeReportDetailModal').classList.add('active');
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

function closeEmployeeReportDetailModal() {
  document.getElementById('employeeReportDetailModal').classList.remove('active');
}

function closeEmployeeDetailModal() {
  document.getElementById('employeeDetailModal').classList.remove('active');
  currentEmployeeReports = [];
  currentEmployeeDetail = null;
}

function downloadCSV(rows, filename) {
  const csvContent = rows
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function downloadEmployeeReportFile(reportId) {
  const report = currentEmployeeReports.find(r => r.id === reportId);
  if (!report) return;

  const attachments = report.attachments;

  if (!attachments || attachments.length === 0) {
    showNotification('This report has no uploaded file attached', 'info');
    return;
  }

  if (attachments.length === 1) {
    window.open(attachments[0].downloadURL, '_blank', 'noopener,noreferrer');
    return;
  }

  attachments.forEach((a, i) => {
    setTimeout(() => {
      window.open(a.downloadURL, '_blank', 'noopener,noreferrer');
    }, i * 300);
  });
}

function exportAllEmployeeReports() {
  if (currentEmployeeReports.length === 0) {
    showNotification('No reports to export', 'info');
    return;
  }

  const header = ['Date', 'Status', 'Late', 'Hours', 'Priority', 'Progress', 'Tasks Completed'];
  const rows = [header, ...currentEmployeeReports.map(r => [
    formatDate(r.reportDate),
    r.status,
    r.isLate ? 'Yes' : 'No',
    r.hoursWorked || 0,
    r.priorityLevel || '',
    `${r.progressPercentage || 0}%`,
    r.tasksCompleted || ''
  ])];

  const name = currentEmployeeDetail ? currentEmployeeDetail.fullName.replace(/\s+/g, '-') : 'employee';
  downloadCSV(rows, `all-reports-${name}.csv`);
}

async function deleteEmployeeReport(reportId) {
  const report = currentEmployeeReports.find(r => r.id === reportId);
  if (!report) return;

  const confirmed = confirm(`Delete this report from ${formatDate(report.reportDate)}? This cannot be undone.`);
  if (!confirmed) return;

  try {
    await db.collection('reports').doc(reportId).delete();
    showNotification('Report deleted', 'success');
    currentEmployeeReports = currentEmployeeReports.filter(r => r.id !== reportId);
    renderEmployeeReports(currentEmployeeReports);
  } catch (error) {
    console.error('Delete report error:', error);
    showNotification('Failed to delete report', 'error');
  }
}

function setupEventListeners() {
  document.getElementById('logoutBtn').addEventListener('click', () => {
    authManager.logout();
  });

  document.getElementById('employeeSearch').addEventListener('input', applyFilters);
  document.getElementById('statusFilter').addEventListener('change', applyFilters);
  document.getElementById('roleFilter').addEventListener('change', applyFilters);

  document.getElementById('editEmployeeForm').addEventListener('submit', saveEmployeeEdit);
  document.getElementById('closeEditModalBtn').addEventListener('click', closeEditModal);
  document.getElementById('cancelEditBtn').addEventListener('click', closeEditModal);

  document.getElementById('editModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('editModal')) {
      closeEditModal();
    }
  });

  document.getElementById('closeEmployeeDetailModalBtn').addEventListener('click', closeEmployeeDetailModal);
  document.getElementById('employeeDetailModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('employeeDetailModal')) {
      closeEmployeeDetailModal();
    }
  });

  document.getElementById('exportAllReportsBtn').addEventListener('click', exportAllEmployeeReports);

  document.getElementById('closeEmployeeReportDetailModalBtn').addEventListener('click', closeEmployeeReportDetailModal);
  document.getElementById('employeeReportDetailModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('employeeReportDetailModal')) {
      closeEmployeeReportDetailModal();
    }
  });
}