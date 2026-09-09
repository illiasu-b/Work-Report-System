// public/js/utils.js

// Notification System
function showNotification(message, type = 'info') {
  const container = document.getElementById('notificationContainer') || createNotificationContainer();
  
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <div>${message}</div>
  `;
  
  container.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease forwards';
    setTimeout(() => notification.remove(), 300);
  }, APP_CONFIG.NOTIFICATION_DURATION);
}

function createNotificationContainer() {
  const container = document.createElement('div');
  container.id = 'notificationContainer';
  container.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-width: 400px;
  `;
  document.body.appendChild(container);
  return container;
}

// Date Formatting
function formatDate(date) {
  if (!date) return '';
  if (typeof date === 'string') date = new Date(date);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function formatDateTime(date) {
  if (!date) return '';
  if (typeof date === 'string') date = new Date(date);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// File Utilities
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Export to PDF
async function exportToPDF(reportData, fileName = 'report.pdf') {
  try {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    
    const pageHeight = pdf.internal.pageSize.getHeight();
    const pageWidth = pdf.internal.pageSize.getWidth();
    let yPosition = 20;

    // Add title
    pdf.setFontSize(18);
    pdf.text('Work Report', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    // Add report info
    pdf.setFontSize(10);
    pdf.text(`Employee: ${reportData.employeeName}`, 20, yPosition);
    yPosition += 7;
    pdf.text(`Date: ${formatDate(reportData.reportDate)}`, 20, yPosition);
    yPosition += 7;
    pdf.text(`Department: ${reportData.department}`, 20, yPosition);
    yPosition += 10;

    // Add sections
    const sections = [
      { title: 'Tasks Completed', content: reportData.tasksCompleted },
      { title: 'Challenges Faced', content: reportData.challengesFaced },
      { title: 'Solutions Implemented', content: reportData.solutionsImplemented },
      { title: 'Tomorrow\'s Plan', content: reportData.tomorrowsPlan }
    ];

    sections.forEach(section => {
      if (yPosition > pageHeight - 30) {
        pdf.addPage();
        yPosition = 20;
      }

      pdf.setFontSize(12);
      pdf.setFont(undefined, 'bold');
      pdf.text(section.title, 20, yPosition);
      yPosition += 8;

      pdf.setFontSize(10);
      pdf.setFont(undefined, 'normal');
      const lines = pdf.splitTextToSize(section.content || '', pageWidth - 40);
      pdf.text(lines, 20, yPosition);
      yPosition += lines.length * 5 + 10;
    });

    pdf.save(fileName);
    showNotification('Report exported to PDF successfully!', 'success');
  } catch (error) {
    console.error('PDF export error:', error);
    showNotification('Failed to export PDF', 'error');
  }
}

// Export to Excel
async function exportToExcel(data, fileName = 'reports.xlsx') {
  try {
    const header = Object.keys(data[0]);
    const rows = data.map(item => header.map(field => item[field]));
    
    const csvContent = [
      header.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    window.URL.revokeObjectURL(url);

    showNotification('Report exported to Excel successfully!', 'success');
  } catch (error) {
    console.error('Excel export error:', error);
    showNotification('Failed to export Excel', 'error');
  }
}

// Confirm Dialog
function showConfirm(message, onConfirm, onCancel = null) {
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.innerHTML = `
    <div class="modal-content">
      <h3>Confirm Action</h3>
      <p>${message}</p>
      <div style="display: flex; gap: 10px; margin-top: 20px;">
        <button class="btn btn-danger" id="confirmBtn">Confirm</button>
        <button class="btn btn-secondary" id="cancelBtn">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('confirmBtn').addEventListener('click', () => {
    onConfirm();
    modal.remove();
  });

  document.getElementById('cancelBtn').addEventListener('click', () => {
    if (onCancel) onCancel();
    modal.remove();
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      if (onCancel) onCancel();
      modal.remove();
    }
  });
}

// Email validation
function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

// Password strength checker
function checkPasswordStrength(password) {
  let strength = 0;
  if (password.length >= 8) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^A-Za-z0-9]/.test(password)) strength++;
  
  return ['Weak', 'Fair', 'Good', 'Strong'][strength];
}

// Deep clone object
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// Add animations CSS
const style = document.createElement('style');
style.textContent = `
  @keyframes slideOut {
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);
