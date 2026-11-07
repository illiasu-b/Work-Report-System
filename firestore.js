// public/js/firestore.js

class ReportManager {
  // Submit new report
  async submitReport(reportData) {
    try {
      const employeeId = authManager.getCurrentUserId();
      const userDoc = await db.collection('users').doc(employeeId).get();
      const userData = userDoc.data();

      const report = {
        employeeId,
        employeeName: userData.fullName,
        employeeEmail: userData.email,
        department: userData.department,
        position: userData.position,
        ...reportData,
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        approvedBy: null,
        approvedAt: null,
        rejectionReason: null,
        comments: []
      };

      const docRef = await db.collection('reports').add(report);

      // Log activity
      await authManager.logActivity(
        employeeId,
        'report_submitted',
        `Report submitted for ${reportData.reportDate}`
      );

      // Create notification for admin
      const admins = await db.collection('users')
        .where('role', '==', 'admin')
        .get();

      admins.forEach(adminDoc => {
        authManager.createNotification(
          adminDoc.id,
          'New Report Submitted',
          `${userData.fullName} submitted a new report on ${reportData.reportDate}`,
          'info'
        );
      });

      showNotification('Report submitted successfully!', 'success');
      return docRef.id;
    } catch (error) {
      console.error('Report submission error:', error);
      showNotification(error.message, 'error');
      return null;
    }
  }

  // Update report (only if status is draft)
  async updateReport(reportId, reportData) {
    try {
      const reportRef = db.collection('reports').doc(reportId);
      const reportDoc = await reportRef.get();

      if (!reportDoc.exists) {
        showNotification('Report not found', 'error');
        return false;
      }

      if (reportDoc.data().status !== 'pending') {
        showNotification('Can only edit pending reports', 'error');
        return false;
      }

      await reportRef.update({
        ...reportData,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Log activity
      await authManager.logActivity(
        authManager.getCurrentUserId(),
        'report_updated',
        `Report ${reportId} updated`
      );

      showNotification('Report updated successfully!', 'success');
      return true;
    } catch (error) {
      console.error('Report update error:', error);
      showNotification(error.message, 'error');
      return false;
    }
  }

  // Delete report (only if status is draft)
  async deleteReport(reportId) {
    try {
      const reportRef = db.collection('reports').doc(reportId);
      const reportDoc = await reportRef.get();

      if (!reportDoc.exists) {
        showNotification('Report not found', 'error');
        return false;
      }

      if (reportDoc.data().status !== 'pending') {
        showNotification('Can only delete pending reports', 'error');
        return false;
      }

      // Delete attachments
      await this.deleteAttachments(reportId);

      // Delete report
      await reportRef.delete();

      // Log activity
      await authManager.logActivity(
        authManager.getCurrentUserId(),
        'report_deleted',
        `Report ${reportId} deleted`
      );

      showNotification('Report deleted successfully!', 'success');
      return true;
    } catch (error) {
      console.error('Report deletion error:', error);
      showNotification(error.message, 'error');
      return false;
    }
  }

  // Get employee's own reports
  async getMyReports(limit = 100) {
    try {
      const employeeId = authManager.getCurrentUserId();
      const snapshot = await db.collection('reports')
        .where('employeeId', '==', employeeId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        approvedAt: doc.data().approvedAt?.toDate()
      }));
    } catch (error) {
      console.error('Fetch reports error:', error);
      return [];
    }
  }

  // Get all reports (admin only)
  async getAllReports(filters = {}) {
    try {
      let query = db.collection('reports');

      // Apply filters
      if (filters.status) {
        query = query.where('status', '==', filters.status);
      }

      if (filters.department) {
        query = query.where('department', '==', filters.department);
      }

      if (filters.employeeId) {
        query = query.where('employeeId', '==', filters.employeeId);
      }

      if (filters.startDate && filters.endDate) {
        query = query
          .where('reportDate', '>=', filters.startDate)
          .where('reportDate', '<=', filters.endDate);
      }

      const snapshot = await query
        .orderBy('createdAt', 'desc')
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        approvedAt: doc.data().approvedAt?.toDate()
      }));
    } catch (error) {
      console.error('Fetch all reports error:', error);
      return [];
    }
  }

  // Get single report
  async getReport(reportId) {
    try {
      const reportDoc = await db.collection('reports').doc(reportId).get();

      if (!reportDoc.exists) {
        showNotification('Report not found', 'error');
        return null;
      }

      return {
        id: reportDoc.id,
        ...reportDoc.data(),
        createdAt: reportDoc.data().createdAt?.toDate(),
        updatedAt: reportDoc.data().updatedAt?.toDate(),
        approvedAt: reportDoc.data().approvedAt?.toDate()
      };
    } catch (error) {
      console.error('Fetch report error:', error);
      return null;
    }
  }

  // Approve report (admin only)
  async approveReport(reportId, comment = '') {
    try {
      const adminId = authManager.getCurrentUserId();
      const adminDoc = await db.collection('users').doc(adminId).get();

      await db.collection('reports').doc(reportId).update({
        status: 'approved',
        approvedBy: adminId,
        approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Add comment
      if (comment) {
        await this.addComment(reportId, adminId, comment, 'approval');
      }

      // Get report details
      const reportDoc = await db.collection('reports').doc(reportId).get();
      const reportData = reportDoc.data();

      // Notify employee
      await authManager.createNotification(
        reportData.employeeId,
        'Report Approved',
        `Your report for ${reportData.reportDate} has been approved`,
        'success'
      );

      // Log activity
      await authManager.logActivity(
        adminId,
        'report_approved',
        `Report ${reportId} approved by admin`
      );

      showNotification('Report approved successfully!', 'success');
      return true;
    } catch (error) {
      console.error('Report approval error:', error);
      showNotification(error.message, 'error');
      return false;
    }
  }

  // Reject report (admin only)
  async rejectReport(reportId, reason, comment = '') {
    try {
      const adminId = authManager.getCurrentUserId();

      await db.collection('reports').doc(reportId).update({
        status: 'rejected',
        rejectionReason: reason,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Add comment
      if (comment) {
        await this.addComment(reportId, adminId, comment, 'rejection');
      }

      // Get report details
      const reportDoc = await db.collection('reports').doc(reportId).get();
      const reportData = reportDoc.data();

      // Notify employee
      await authManager.createNotification(
        reportData.employeeId,
        'Report Rejected',
        `Your report for ${reportData.reportDate} has been rejected. Reason: ${reason}`,
        'error'
      );

      // Log activity
      await authManager.logActivity(
        adminId,
        'report_rejected',
        `Report ${reportId} rejected: ${reason}`
      );

      showNotification('Report rejected successfully!', 'success');
      return true;
    } catch (error) {
      console.error('Report rejection error:', error);
      showNotification(error.message, 'error');
      return false;
    }
  }

  // Add comment to report
  async addComment(reportId, userId, commentText, commentType = 'regular') {
    try {
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data();

      const comment = {
        userId,
        userName: userData.fullName,
        userRole: userData.role,
        text: commentText,
        type: commentType,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      };

      await db.collection('reports').doc(reportId).update({
        comments: firebase.firestore.FieldValue.arrayUnion(comment),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      return true;
    } catch (error) {
      console.error('Add comment error:', error);
      return false;
    }
  }

    // Upload attachment (stored in Firestore, no Cloud Storage needed)
  async uploadAttachment(reportId, file) {
    const MAX_BYTES = 650 * 1024; // Firestore documents are limited to about 1 MB
    let fileDocRef = null;

    try {
      if (file.size > MAX_BYTES) {
        showNotification('File is too large. Maximum size is 650 KB.', 'error');
        return null;
      }

      const employeeId = authManager.getCurrentUserId();

      // Read the file as a data URL (text)
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      // Save the file content in its own collection
      fileDocRef = await db.collection('reportFiles').add({
        reportId,
        employeeId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || '',
        data: dataUrl,
        uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Link it to the report (no serverTimestamp inside arrays)
      const attachment = {
        fileId: fileDocRef.id,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || '',
        uploadedAt: new Date()
      };

      await db.collection('reports').doc(reportId).update({
        attachments: firebase.firestore.FieldValue.arrayUnion(attachment),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      return attachment;
    } catch (error) {
      console.error('Attachment upload error:', error);
      // Clean up the orphan file document if linking failed
      if (fileDocRef) { try { await fileDocRef.delete(); } catch (e) {} }
      showNotification('Attachment failed: ' + error.message, 'error');
      return null;
    }
  }

  // Delete attachments
  async deleteAttachments(reportId) {
    try {
      const reportDoc = await db.collection('reports').doc(reportId).get();
      const attachments = reportDoc.data().attachments || [];

      for (const attachment of attachments) {
        if (attachment.fileId) {
          await db.collection('reportFiles').doc(attachment.fileId).delete();
        } else if (attachment.downloadURL) {
          await storage.refFromURL(attachment.downloadURL).delete();
        }
      }
    } catch (error) {
      console.error('Delete attachments error:', error);
    }
  }

  // Search reports
  async searchReports(query) {
    try {
      const employeeId = authManager.getCurrentUserId();
      const reports = await db.collection('reports')
        .where('employeeId', '==', employeeId)
        .get();

      const filtered = reports.docs
        .filter(doc => {
          const data = doc.data();
          return (
            data.tasksCompleted.toLowerCase().includes(query.toLowerCase()) ||
            data.reportDate.includes(query) ||
            data.department.toLowerCase().includes(query.toLowerCase())
          );
        })
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate()
        }));

      return filtered;
    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  }

  // Get reports by date range
  async getReportsByDateRange(startDate, endDate) {
    try {
      const employeeId = authManager.getCurrentUserId();
      const snapshot = await db.collection('reports')
        .where('employeeId', '==', employeeId)
        .where('reportDate', '>=', startDate)
        .where('reportDate', '<=', endDate)
        .orderBy('reportDate', 'desc')
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      }));
    } catch (error) {
      console.error('Date range query error:', error);
      return [];
    }
  }
}

// Initialize report manager
const reportManager = new ReportManager();


// Employee Manager
class EmployeeManager {
  // Get all employees (admin only)
  async getAllEmployees() {
    try {
      const snapshot = await db.collection('users')
        .where('role', '==', 'employee')
        .orderBy('dateJoined', 'desc')
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        dateJoined: doc.data().dateJoined?.toDate(),
        lastLogin: doc.data().lastLogin?.toDate()
      }));
    } catch (error) {
      console.error('Fetch employees error:', error);
      return [];
    }
  }

  // Search employees
  async searchEmployees(query) {
    try {
      const employees = await this.getAllEmployees();
      return employees.filter(emp =>
        emp.fullName.toLowerCase().includes(query.toLowerCase()) ||
        emp.employeeId.toLowerCase().includes(query.toLowerCase()) ||
        emp.email.toLowerCase().includes(query.toLowerCase()) ||
        emp.department.toLowerCase().includes(query.toLowerCase())
      );
    } catch (error) {
      console.error('Search employees error:', error);
      return [];
    }
  }

  // Disable employee
  async disableEmployee(employeeId) {
    try {
      await db.collection('users').doc(employeeId).update({
        accountStatus: 'disabled',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Create notification
      await authManager.createNotification(
        employeeId,
        'Account Disabled',
        'Your account has been disabled by administrator',
        'error'
      );

      showNotification('Employee account disabled successfully!', 'success');
      return true;
    } catch (error) {
      console.error('Disable employee error:', error);
      showNotification(error.message, 'error');
      return false;
    }
  }

  // Enable employee
  async enableEmployee(employeeId) {
    try {
      await db.collection('users').doc(employeeId).update({
        accountStatus: 'active',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      await authManager.createNotification(
        employeeId,
        'Account Enabled',
        'Your account has been re-enabled by administrator',
        'success'
      );

      showNotification('Employee account enabled successfully!', 'success');
      return true;
    } catch (error) {
      console.error('Enable employee error:', error);
      showNotification(error.message, 'error');
      return false;
    }
  }

  // Get employee statistics
  async getEmployeeStats(employeeId) {
    try {
      const reportsSnapshot = await db.collection('reports')
        .where('employeeId', '==', employeeId)
        .get();

      const reports = reportsSnapshot.docs.map(doc => doc.data());

      return {
        totalReports: reports.length,
        approvedReports: reports.filter(r => r.status === 'approved').length,
        rejectedReports: reports.filter(r => r.status === 'rejected').length,
        pendingReports: reports.filter(r => r.status === 'pending').length,
        averageHours: (reports.reduce((sum, r) => sum + (r.hoursWorked || 0), 0) / reports.length).toFixed(2)
      };
    } catch (error) {
      console.error('Get employee stats error:', error);
      return null;
    }
  }
}

// Initialize employee manager
const employeeManager = new EmployeeManager();
