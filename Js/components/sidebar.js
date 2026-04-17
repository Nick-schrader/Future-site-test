// ---- SIDEBAR COMPONENT ----
class SidebarComponent {
  constructor() {
    this.currentPage = window.location.pathname.split('/').pop() || 'porto.html';
    console.log('[SIDEBAR] Component initialized for page:', this.currentPage);
    this.init();
  }

  init() {
    console.log('[SIDEBAR] Initializing component...');
    this.updateNavigation();
    this.setupEventListeners();
    console.log('[SIDEBAR] Component ready');
  }

  updateNavigation() {
    console.log('[SIDEBAR] Updating navigation...');
    
    const u = window.getUser?.() || {};
    const rollen = (u.rollen || []).map(r => r.naam || r);
    const isAdmin = u.isAdmin === 1 || u.id === '1196035736823156790';
    const userRole = rollen[0] || 'user';

    console.log('[SIDEBAR] User data:', { userRole, isAdmin, rollen: rollen.slice(0, 3) });

    // Verwijder active class van alle sidebar items
    document.querySelectorAll('.sidebar-item').forEach(item => {
      item.classList.remove('active');
    });

    // Toon/verberg menu items op basis van rol en admin status
    const navOps = document.getElementById('nav-ops');
    const navLogs = document.getElementById('nav-logs');
    const navSettings = document.getElementById('nav-settings');
    
    if (navOps) {
      const showOps = ['ovd', 'opco'].includes(userRole) || isAdmin;
      navOps.style.display = showOps ? '' : 'none';
      console.log('[SIDEBAR] OPS visibility:', showOps);
    }
    
    if (navLogs) {
      const showLogs = ['ovd', 'opco'].includes(userRole) || isAdmin;
      navLogs.style.display = showLogs ? '' : 'none';
      console.log('[SIDEBAR] Logs visibility:', showLogs);
    }
    
    if (navSettings) {
      const showSettings = ['ovd', 'opco'].includes(userRole) || isAdmin;
      navSettings.style.display = showSettings ? '' : 'none';
      console.log('[SIDEBAR] Settings visibility:', showSettings);
    }

    // Voeg active class toe aan huidige pagina
    const navItem = document.querySelector(`[href="${this.currentPage}"]`);
    if (navItem) {
      navItem.classList.add('active');
      console.log('[SIDEBAR] Active item set:', this.currentPage);
    } else {
      console.log('[SIDEBAR] No nav item found for:', this.currentPage);
    }
  }

  setupEventListeners() {
    // Luister naar gebruiker data updates
    window.addEventListener('userUpdated', () => {
      console.log('[SIDEBAR] User updated event received');
      this.updateNavigation();
    });

    // Luister naar Discord rol updates
    window.addEventListener('discordRolesUpdated', () => {
      console.log('[SIDEBAR] Discord roles updated event received');
      this.updateNavigation();
    });
  }

  // Methode om handmatig navigatie bij te werken
  refresh() {
    console.log('[SIDEBAR] Manual refresh requested');
    this.updateNavigation();
  }
}

// Global sidebar instance
window.sidebarComponent = null;

// Initialisatie functie
function initSidebar() {
  if (!window.sidebarComponent) {
    window.sidebarComponent = new SidebarComponent();
  }
  return window.sidebarComponent;
}

// Automatische initialisatie wanneer DOM klaar is
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSidebar);
} else {
  initSidebar();
}
