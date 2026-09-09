// check-deadlines.js
// Runs daily via GitHub Actions. Checks who hasn't submitted today's report
// and emails them via EmailJS's REST API (server-side, so it needs the
// EmailJS Private Key to bypass the browser-origin check).

const admin = require('firebase-admin');
const fetch = require('node-fetch');

// Loaded from GitHub Actions secrets (see workflow yml)
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID; // same generic template as the browser code
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY;
const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY;

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function sendEmail(toEmail, employeeName, reportDate) {
  const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_ID,
      user_id: EMAILJS_PUBLIC_KEY,
      accessToken: EMAILJS_PRIVATE_KEY,
      template_params: {
        to_email: toEmail,
        subject_line: 'You missed today\'s report deadline',
        message_body: `Hi ${employeeName}, you haven't submitted your report for ${reportDate} yet.`
      }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`EmailJS send failed (${response.status}): ${text}`);
  }
}

async function main() {
  const settingsDoc = await db.collection('settings').doc('app').get();
  const settings = settingsDoc.exists ? settingsDoc.data() : {};

  if (!settings.notifyOnMissing) {
    console.log('notifyOnMissing is off - skipping.');
    return;
  }

  const tz = settings.timezone || 'UTC';
  const todayInTz = new Date().toLocaleDateString('en-CA', { timeZone: tz }); // YYYY-MM-DD

  const employeesSnapshot = await db.collection('users').where('role', '==', 'employee').get();
  const reportsTodaySnapshot = await db.collection('reports').where('reportDate', '==', todayInTz).get();
  const submittedIds = new Set(reportsTodaySnapshot.docs.map(d => d.data().employeeId));

  const missed = employeesSnapshot.docs.filter(
    doc => !submittedIds.has(doc.id) && doc.data().accountStatus !== 'disabled'
  );

  console.log(`${missed.length} employee(s) missed today's (${todayInTz}) deadline.`);

  for (const doc of missed) {
    const userData = doc.data();
    if (!userData.email) continue;

    try {
      await sendEmail(userData.email, userData.fullName || '', todayInTz);
      console.log(`Emailed ${userData.email}`);
    } catch (err) {
      console.error(`Failed to email ${userData.email}:`, err.message);
    }

    // Also write the matching in-app notification, same as the other two flows
    await db.collection('notifications').add({
      userId: doc.id,
      title: 'Missed Report Deadline',
      message: `You haven't submitted your report for ${todayInTz} yet.`,
      type: 'warning',
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Deadline check failed:', err);
    process.exit(1);
  });