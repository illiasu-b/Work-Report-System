// firebase/functions/index.js

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_EMAIL,
    pass: process.env.GMAIL_PASSWORD
  }
});

// Send email notification
exports.sendEmailNotification = functions.firestore
  .document('notifications/{notificationId}')
  .onCreate(async (snap, context) => {
    const notification = snap.data();
    
    try {
      const userDoc = await admin.firestore()
        .collection('users')
        .doc(notification.userId)
        .get();
      
      if (!userDoc.exists) return;
      
      const user = userDoc.data();
      
      const mailOptions = {
        from: process.env.GMAIL_EMAIL,
        to: user.email,
        subject: notification.title,
        html: `
          <h2>${notification.title}</h2>
          <p>${notification.message}</p>
          <p>Best regards,<br>Work Report Management System</p>
        `
      };
      
      await transporter.sendMail(mailOptions);
      console.log('Email sent to:', user.email);
    } catch (error) {
      console.error('Error sending email:', error);
    }
  });

// Scheduled task - Send daily reminder
exports.sendDailyReminder = functions.pubsub
  .schedule('0 9 * * *')
  .timeZone('America/New_York')
  .onRun(async (context) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Get employees
      const employeesSnap = await admin.firestore()
        .collection('users')
        .where('role', '==', 'employee')
        .where('accountStatus', '==', 'active')
        .get();
      
      // Get today's reports
      const reportsSnap = await admin.firestore()
        .collection('reports')
        .where('reportDate', '==', today)
        .get();
      
      const reportedEmployees = new Set(
        reportsSnap.docs.map(doc => doc.data().employeeId)
      );
      
      // Send reminders to employees who haven't submitted
      const reminderPromises = employeesSnap.docs
        .filter(doc => !reportedEmployees.has(doc.id))
        .map(employeeDoc => {
          return admin.firestore()
            .collection('notifications')
            .add({
              userId: employeeDoc.id,
              title: 'Daily Report Reminder',
              message: 'Please submit your daily work report',
              type: 'reminder',
              read: false,
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });
      
      await Promise.all(reminderPromises);
      console.log('Daily reminders sent');
    } catch (error) {
      console.error('Error sending daily reminders:', error);
    }
  });

// Admin functions
exports.addAdminUser = functions.https
  .onCall(async (data, context) => {
    // Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    try {
      const adminDoc = await admin.firestore()
        .collection('users')
        .doc(context.auth.uid)
        .get();
      
      if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
        throw new functions.https.HttpsError(
          'permission-denied',
          'User must be admin'
        );
      }

      // Create new admin user
      const newUser = await admin.auth().createUser({
        email: data.email,
        password: data.password,
        displayName: data.fullName
      });

      // Add user document
      await admin.firestore()
        .collection('users')
        .doc(newUser.uid)
        .set({
          email: data.email,
          fullName: data.fullName,
          role: 'admin',
          accountStatus: 'active',
          dateJoined: admin.firestore.FieldValue.serverTimestamp(),
          lastLogin: null
        });

      return { uid: newUser.uid };
    } catch (error) {
      throw new functions.https.HttpsError('internal', error.message);
    }
  });
