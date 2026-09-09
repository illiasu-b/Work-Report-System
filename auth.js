// auth.js

class AuthManager {
  constructor() {
    this.currentUser = null;
    this.userRole = null;
    // Resolves the first time Firebase tells us whether someone is logged in.
    // Pages should await this before checking isAuthenticated()/isAdmin(),
    // otherwise they may act on stale info before Firebase has responded.
    this._authReadyResolve = null;
    this.authReadyPromise = new Promise((resolve) => {
      this._authReadyResolve = resolve;
    });
    this.initializeAuthListener();
  }

  // Wait until Firebase has confirmed the current auth state at least once
  async waitForAuthReady() {
    return this.authReadyPromise;
  }

  // Initialize auth state listener
  initializeAuthListener() {
    auth.onAuthStateChanged(async (user) => {
      if (user) {
        this.currentUser = user;
        const userDoc = await db.collection('users').doc(user.uid).get();
        
        if (userDoc.exists) {
          this.userRole = userDoc.data().role;

          // Safe to write here — token is fully active inside onAuthStateChanged
          try {
            await db.collection('users').doc(user.uid).update({
              lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            });
            await this.logActivity(user.uid, 'login', 'User logged in');
          } catch (e) {
            console.warn('lastLogin update skipped:', e.message);
          }

          this.redirectBasedOnRole();
        }
      } else {
        this.currentUser = null;
        this.userRole = null;
        this.redirectToLogin();
      }

      // Signal "ready" only once, after the first check completes
      if (this._authReadyResolve) {
        this._authReadyResolve();
        this._authReadyResolve = null;
      }
    });
  }

  // Register new employee
  async registerEmployee(email, password, fullName, employeeId, department) {
    try {
      const result = await auth.createUserWithEmailAndPassword(email, password);
      const userId = result.user.uid;

      // Force token refresh so Firestore rules see request.auth.token.email
      await result.user.getIdToken(true);

      // Create user document
      await db.collection('users').doc(userId).set({
        email,
        fullName,
        employeeId,
        department,
        role: 'employee',
        profilePicture: '',
        phone: '',
        position: '',
        dateJoined: new Date(),
        lastLogin: new Date(),
        accountStatus: 'active',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Log activity
      await this.logActivity(userId, 'account_created', 'Employee account created');

      // Send verification email
      await result.user.sendEmailVerification();

      showNotification('Account created successfully! Please verify your email.', 'success');
      return true;
    } catch (error) {
      console.error('Registration error:', error);
      showNotification(error.message, 'error');
      return false;
    }
  }

  // Login user
  async loginUser(email, password) {
    try {
      await auth.signInWithEmailAndPassword(email, password);
      // lastLogin and activity log are handled inside onAuthStateChanged
      // where the session token is fully active — doing it here causes
      // a permissions error because the token hasn't propagated yet.
      showNotification('Login successful!', 'success');
      return true;
    } catch (error) {
      console.error('Login error:', error);
      showNotification(error.message, 'error');
      return false;
    }
  }

  // Reset password
  async resetPassword(email) {
    try {
      await auth.sendPasswordResetEmail(email);
      showNotification('Password reset email sent successfully!', 'success');
      return true;
    } catch (error) {
      console.error('Password reset error:', error);
      showNotification(error.message, 'error');
      return false;
    }
  }

  // Change password
  async changePassword(newPassword) {
    try {
      await this.currentUser.updatePassword(newPassword);
      
      // Log activity
      await this.logActivity(this.currentUser.uid, 'password_changed', 'User changed password');
      
      // Create notification
      await this.createNotification(
        this.currentUser.uid,
        'Password Changed',
        'Your password has been successfully changed',
        'security'
      );

      showNotification('Password changed successfully!', 'success');
      return true;
    } catch (error) {
      console.error('Password change error:', error);
      showNotification(error.message, 'error');
      return false;
    }
  }

  // Update user profile
  async updateProfile(userId, profileData) {
    try {
      await db.collection('users').doc(userId).set({
        ...profileData,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // Log activity
      await this.logActivity(userId, 'profile_updated', 'User updated profile');

      showNotification('Profile updated successfully!', 'success');
      return true;
    } catch (error) {
      console.error('Profile update error:', error);
      showNotification(error.message, 'error');
      return false;
    }
  }

  // Upload profile picture
  async uploadProfilePicture(userId, file) {
    try {
      if (file.size > APP_CONFIG.MAX_FILE_SIZE) {
        showNotification('File size exceeds 5MB limit', 'error');
        return false;
      }

      const fileName = `${Date.now()}_${file.name}`;
      const storageRef = storage.ref(`profile-pictures/${userId}/${fileName}`);
      
      const snapshot = await storageRef.put(file);
      const downloadURL = await snapshot.ref.getDownloadURL();

      // Update user document
      await db.collection('users').doc(userId).update({
        profilePicture: downloadURL,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Log activity
      await this.logActivity(userId, 'profile_picture_updated', 'User updated profile picture');

      showNotification('Profile picture uploaded successfully!', 'success');
      return downloadURL;
    } catch (error) {
      console.error('Profile picture upload error:', error);
      showNotification(error.message, 'error');
      return null;
    }
  }

  // Log activity
  async logActivity(userId, activityType, description) {
    try {
      await db.collection('activityLogs').add({
        userId,
        activityType,
        description,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        ipAddress: 'tracked_by_server'
      });
    } catch (error) {
      console.error('Activity log error:', error);
    }
  }

  // Create notification
  async createNotification(userId, title, message, type = 'info') {
    try {
      await db.collection('notifications').add({
        userId,
        title,
        message,
        type,
        read: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error('Notification creation error:', error);
    }
  }

  // Logout
  async logout() {
    try {
      await auth.signOut();
      showNotification('Logged out successfully!', 'success');
      window.location.href = 'login.html';
    } catch (error) {
      console.error('Logout error:', error);
      showNotification(error.message, 'error');
    }
  }

  // Redirect based on role
  redirectBasedOnRole() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    // Shared/public pages: once logged in, send the user straight to their dashboard
    const sharedPages = ['login.html', 'register.html', 'index.html', ''];

    // Pages that belong exclusively to one role or the other
    const adminOnlyPages = ['admin.html', 'analytics.html', 'employees.html', 'settings.html', 'manage-reports.html'];
    const employeeOnlyPages = ['employee-dashboard.html', 'report.html', 'my-reports.html', 'profile.html', 'employee-analytics.html'];

    if (sharedPages.includes(currentPage)) {
      window.location.href = this.userRole === 'admin' ? 'admin.html' : 'employee-dashboard.html';
      return;
    }

    if (this.userRole === 'admin' && employeeOnlyPages.includes(currentPage)) {
      window.location.href = 'admin.html';
    } else if (this.userRole === 'employee' && adminOnlyPages.includes(currentPage)) {
      window.location.href = 'employee-dashboard.html';
    }
    // Otherwise: already on a page that matches their role - no redirect needed.
  }

  // Redirect to login if not authenticated
  redirectToLogin() {
    const currentPage = window.location.pathname;
    if (!currentPage.includes('login') && !currentPage.includes('register') && !currentPage.includes('index')) {
      window.location.href = 'login.html';
    }
  }

  // Check if user is authenticated
  isAuthenticated() {
    return this.currentUser !== null;
  }

  // Check if user is admin
  isAdmin() {
    return this.userRole === 'admin';
  }

  // Get current user ID
  getCurrentUserId() {
    return this.currentUser?.uid;
  }
}

// Initialize auth manager
const authManager = new AuthManager();