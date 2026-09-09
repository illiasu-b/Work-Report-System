// firebase.js

const firebaseConfig = {
  apiKey: "AIzaSyCzLq34XMFUvhvYf1iKm8GLjXkLnhw4O_c",
  authDomain: "work-report-system-c5050.firebaseapp.com",
  projectId: "work-report-system-c5050",
  storageBucket: "work-report-system-c5050.firebasestorage.app",
  messagingSenderId: "545851431000",
  appId: "1:545851431000:web:93e6cc3af33b3489f8922d"
};

// Initialize Firebase (using the compat SDK loaded via <script> tags)
firebase.initializeApp(firebaseConfig);

// Initialize Services
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Enable offline persistence for better UX
db.enablePersistence()
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.log('Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.code === 'unimplemented') {
      console.log('The current browser does not support offline persistence');
    }
  });

// Global config object
const APP_CONFIG = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_FILE_TYPES: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png'],
  NOTIFICATION_DURATION: 5000,
  REPORTS_PER_PAGE: 10
};