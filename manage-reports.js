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

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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

  // Group by employee, A to Z
  const groups = {};
  reports.forEach(r => {
    const name = employeeNameFor(r);
    (groups[name] = groups[name] || []).push(r);
  });

  tbody.innerHTML = Object.keys(groups).sort((a, b) => a.localeCompare(b)).map(name => {
    const items = groups[name];
    const header = `
      <tr class="group-row">
        <td colspan="6"><strong>${esc(name)}</strong> (${items.length} report${items.length === 1 ? '' : 's'})</td>
      </tr>`;

    const rows = items.map(report => {
      const status = report.status || 'pending';
      const fileCount = (report.attachments || []).length;
      return `
      <tr>
        <td>${esc(name)}</td>
        <td>${formatDate(report.reportDate)}</td>
        <td>${esc((report.priorityLevel || '').toUpperCase())}</td>
        <td>${report.hoursWorked || 0}h</td>
        <td>
          <span class="status-badge status-${esc(status)}">${esc(status.toUpperCase())}</span>
          ${report.isLate ? '<span class="late-badge">LATE</span>' : ''}
        </td>
        <td>
          <a href="#" class="action-link" onclick="openReviewModal('${report.id}'); return false;">Review</a>
          · <a href="#" class="action-link" onclick="downloadReportFile('${report.id}'); return false;">Download${fileCount > 1 ? ' (' + fileCount + ')' : ''}</a>
          · <a href="#" class="action-link" onclick="printReport('${report.id}'); return false;">Print</a>
          · <a href="#" class="action-link" style="color: var(--danger-color);" onclick="deleteReport('${report.id}'); return false;">Delete</a>
        </td>
      </tr>`;
    }).join('');

    return header + rows;
  }).join('');
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
   ${renderAttachmentsList(report)}
    ${report.reviewComment ? `<hr><p><strong>Previous Comment:</strong><br>${report.reviewComment}</p>` : ''}
  `;

  document.getElementById('reviewComment').value = '';
  document.getElementById('reviewModal').classList.add('active');
}

function renderAttachmentsList(report) {
  const attachments = report.attachments || [];
  if (attachments.length === 0) return '';

  return `
    <hr>
    <p><strong>Attachments:</strong></p>
    <div class="attachments-list">
      ${attachments.map((a, i) => `
        <div class="attachment-item">
          <div class="file-info">
            <span class="file-icon">${getFileIconForName(a.fileName)}</span>
            <div class="file-details">
              <span class="file-name">${esc(a.fileName)}</span>
              <span class="file-size">${formatFileSizeDisplay(a.fileSize)}</span>
            </div>
          </div>
          <span>
            <button type="button" class="btn btn-text" onclick="previewAttachment('${report.id}', ${i})">👁️ Preview</button>
            <button type="button" class="btn btn-text" onclick="downloadAttachment('${report.id}', ${i})">⬇️ Download</button>
          </span>
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

// ---------- Attachment helpers (work for both stored-in-Firestore and URL files) ----------
const fileUrlCache = {};

function findAttachment(reportId, index) {
  const r = allReports.find(x => x.id === reportId);
  return r && r.attachments ? r.attachments[index] : null;
}

async function getAttachmentUrl(a) {
  if (a.downloadURL) return a.downloadURL;               // old Storage files
  if (fileUrlCache[a.fileId]) return fileUrlCache[a.fileId];

  const doc = await db.collection('reportFiles').doc(a.fileId).get();
  if (!doc.exists) throw new Error('File not found');
  const blob = await (await fetch(doc.data().data)).blob();
  const url = URL.createObjectURL(blob);
  fileUrlCache[a.fileId] = url;
  return url;
}

function attachmentKind(a) {
  const name = (a.fileName || '').toLowerCase();
  if ((a.fileType || '').startsWith('image/') || /\.(png|jpe?g|gif|webp)$/.test(name)) return 'image';
  if (a.fileType === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  return 'other';
}

async function downloadAttachment(reportId, index) {
  const a = findAttachment(reportId, index);
  if (!a) return;
  try {
    const url = await getAttachmentUrl(a);
    const link = document.createElement('a');
    link.href = url;
    link.download = a.fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (error) {
    console.error('Download error:', error);
    showNotification('Could not download file: ' + error.message, 'error');
  }
}

async function downloadReportFile(reportId) {
  const report = allReports.find(r => r.id === reportId);
  if (!report) return;

  const attachments = report.attachments || [];
  if (attachments.length === 0) {
    showNotification('This report has no uploaded file attached', 'info');
    return;
  }
  for (let i = 0; i < attachments.length; i++) {
    await downloadAttachment(reportId, i);
  }
}

async function previewAttachment(reportId, index) {
  const a = findAttachment(reportId, index);
  if (!a) return;

  try {
    const url = await getAttachmentUrl(a);
    const kind = attachmentKind(a);

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:10000;display:flex;flex-direction:column;align-items:center;padding:16px;';

    let viewer = '';
    if (kind === 'image') viewer = `<img src="${url}" style="max-width:100%;max-height:100%;object-fit:contain">`;
    else if (kind === 'pdf') viewer = `<iframe id="previewFrame" src="${url}" style="width:100%;height:100%;border:0;background:#fff"></iframe>`;
    else viewer = `<p style="color:#fff">No preview is available for this file type. Use Download.</p>`;

    overlay.innerHTML = `
      <div style="width:100%;max-width:900px;display:flex;justify-content:space-between;align-items:center;color:#fff;margin-bottom:8px;gap:8px;flex-wrap:wrap">
        <strong>${esc(a.fileName)}</strong>
        <span>
          <button type="button" id="pvDownload" class="btn">Download</button>
          ${kind !== 'other' ? '<button type="button" id="pvPrint" class="btn btn-primary">Print</button>' : ''}
          <button type="button" id="pvClose" class="btn">Close</button>
        </span>
      </div>
      <div style="width:100%;max-width:900px;flex:1;min-height:0;display:flex;justify-content:center;align-items:center;">${viewer}</div>`;

    document.body.appendChild(overlay);

    overlay.querySelector('#pvClose').onclick = () => overlay.remove();
    overlay.querySelector('#pvDownload').onclick = () => downloadAttachment(reportId, index);
    const printBtn = overlay.querySelector('#pvPrint');
    if (printBtn) {
      printBtn.onclick = () => {
        if (kind === 'pdf') {
          try { overlay.querySelector('#previewFrame').contentWindow.print(); }
          catch (e) { window.open(url, '_blank'); showNotification('Opened in a new tab. Press Ctrl+P to print.', 'info'); }
        } else {
          const w = window.open('', '_blank');
          if (!w) { showNotification('Allow pop-ups to print', 'error'); return; }
          w.document.write(`<html><body style="margin:0"><img src="${url}" style="max-width:100%" onload="window.print()"></body></html>`);
          w.document.close();
        }
      };
    }
  } catch (error) {
    console.error('Preview error:', error);
    showNotification('Could not open file: ' + error.message, 'error');
  }
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

async function printReport(reportId) {
  const r = allReports.find(x => x.id === reportId);
  if (!r) return;

  // Open the window first so the browser doesn't block the pop-up
  const w = window.open('', '_blank');
  if (!w) { showNotification('Allow pop-ups to print', 'error'); return; }
  w.document.write('<p style="font-family:Arial">Preparing report...</p>');

  try {
    const atts = r.attachments || [];
    const isImg = a => attachmentKind(a) === 'image';

    // Get a usable link for each image (works for Firestore-stored and URL files)
    const imgUrls = await Promise.all(atts.filter(isImg).map(a => getAttachmentUrl(a)));
    const images = imgUrls.map(u => `<p><img src="${u}" style="max-width:100%"></p>`).join('');
    const others = atts.filter(a => !isImg(a)).map(a => `<li>${esc(a.fileName)}</li>`).join('');

    w.document.open();
    w.document.write(`<!DOCTYPE html><html><head><title>Report - ${esc(employeeNameFor(r))}</title>
      <style>body{font-family:Arial,sans-serif;padding:24px;line-height:1.5} h1{font-size:1.4rem} .b{white-space:pre-wrap}</style></head><body>
      <h1>Work Report: ${esc(employeeNameFor(r))}</h1>
      <p><strong>Date:</strong> ${esc(formatDate(r.reportDate))} &nbsp; <strong>Status:</strong> ${esc((r.status || 'pending').toUpperCase())}<br>
         <strong>Hours:</strong> ${r.hoursWorked || 0} &nbsp; <strong>Progress:</strong> ${r.progressPercentage || 0}% &nbsp; <strong>Priority:</strong> ${esc((r.priorityLevel || '').toUpperCase())}</p>
      <p class="b"><strong>Tasks Completed:</strong><br>${esc(r.tasksCompleted || '-')}</p>
      <p class="b"><strong>Challenges Faced:</strong><br>${esc(r.challengesFaced || '-')}</p>
      <p class="b"><strong>Solutions Implemented:</strong><br>${esc(r.solutionsImplemented || '-')}</p>
      <p class="b"><strong>Tomorrow's Plan:</strong><br>${esc(r.tomorrowsPlan || '-')}</p>
      ${r.additionalNotes ? `<p class="b"><strong>Additional Notes:</strong><br>${esc(r.additionalNotes)}</p>` : ''}
      ${r.reviewComment ? `<p class="b"><strong>Admin Comment:</strong><br>${esc(r.reviewComment)}</p>` : ''}
      ${others ? `<h3>Attached files</h3><ul>${others}</ul>` : ''}
      ${images}
      <script>window.onload = () => setTimeout(() => window.print(), 500)<\/script>
      </body></html>`);
    w.document.close();
  } catch (error) {
    console.error('Print error:', error);
    w.close();
    showNotification('Could not prepare the report for printing: ' + error.message, 'error');
  }
}

function setupEventListeners() {
  document.getElementById('logoutBtn').addEventListener('click', () => {
    authManager.logout();
  });

  document.getElementById('reportSearch').addEventListener('input', applyFilters);
  document.getElementById('statusFilter').addEventListener('change', applyFilters);
document.getElementById('printListBtn').addEventListener('click', () => window.print());
  document.getElementById('closeReviewModalBtn').addEventListener('click', closeReviewModal);
  document.getElementById('approveBtn').addEventListener('click', () => reviewReport('approved'));
  document.getElementById('rejectBtn').addEventListener('click', () => reviewReport('rejected'));

  document.getElementById('reviewModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('reviewModal')) {
      closeReviewModal();
    }
  });
}