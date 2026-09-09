// mobile-nav.js
// Wires up the hamburger button to open/close .sidebar on mobile.
// Include this on any admin page that has .sidebar (admin.html,
// manage-reports.html, employees.html, analytics.html, settings.html).

document.addEventListener('DOMContentLoaded', () => {
  // Guard against this script running twice on the same page (e.g. an
  // accidental duplicate <script> tag) - without this, two independent
  // click listeners would each toggle the sidebar/overlay separately,
  // causing them to fall out of sync with each other.
  if (window.__mobileNavInitialized) return;
  window.__mobileNavInitialized = true;

  const toggle = document.getElementById('mobileMenuToggle');
  const sidebar = document.querySelector('.sidebar');

  if (!toggle || !sidebar) return; // page doesn't have a sidebar - nothing to do

  // Remove any pre-existing overlay first, in case one is already sitting
  // in the DOM from an earlier partial run.
  document.querySelectorAll('.sidebar-overlay').forEach(el => el.remove());

  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  document.body.appendChild(overlay);

  // Single source of truth: this function sets the open/closed state
  // explicitly on both elements together, rather than toggling each
  // independently - so they can never drift out of sync with each other.
  function setSidebarOpen(isOpen) {
    sidebar.classList.toggle('active', isOpen);
    overlay.classList.toggle('active', isOpen);
  }

  toggle.addEventListener('click', () => {
    const isCurrentlyOpen = sidebar.classList.contains('active');
    setSidebarOpen(!isCurrentlyOpen);
  });

  overlay.addEventListener('click', () => setSidebarOpen(false));

  // Close automatically if a nav link is tapped (better UX than staying open)
  sidebar.querySelectorAll('a.menu-item').forEach(link => {
    link.addEventListener('click', () => setSidebarOpen(false));
  });
});