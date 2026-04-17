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
    
    // Debug: Check if sidebar items exist
    const navOps = document.getElementById('nav-ops');
    const navLogs = document.getElementById('nav-logs');
    const navSettings = document.getElementById('nav-settings');
    
    console.log('[SIDEBAR] Sidebar items found:', {
      navOps: !!navOps,
      navLogs: !!navLogs,
      navSettings: !!navSettings,
      totalItems: document.querySelectorAll('.sidebar-item').length
    });

    // Verwijder active class van alle sidebar items
    document.querySelectorAll('.sidebar-item').forEach(item => {
      item.classList.remove('active');
    });
    
    // Admin ziet altijd alle menu items
    if (isAdmin) {
      console.log('[SIDEBAR] Admin user - showing all menu items');
      if (navOps) navOps.style.display = '';
      if (navLogs) navLogs.style.display = '';
      if (navSettings) navSettings.style.display = '';
    } else {
      // Normale gebruikers: toon op basis van rollen
      const hasAccess = ['ovd', 'opco'].includes(userRole);
      
      if (navOps) {
        navOps.style.display = hasAccess ? '' : 'none';
        console.log('[SIDEBAR] OPS visibility:', hasAccess);
      }
      
      if (navLogs) {
        navLogs.style.display = hasAccess ? '' : 'none';
        console.log('[SIDEBAR] Logs visibility:', hasAccess);
      }
      
      if (navSettings) {
        navSettings.style.display = hasAccess ? '' : 'none';
        console.log('[SIDEBAR] Settings visibility:', hasAccess);
      }
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

    // Setup unified sidebar hover behavior
    this.setupUnifiedHover();
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

    // Remove inline styles to let CSS hover work (original behavior)
    setTimeout(() => {
      const sidebar = document.querySelector('.sidebar');
      if (sidebar) {
        sidebar.style.removeProperty('width');
        const labels = sidebar.querySelectorAll('.sidebar-label');
        labels.forEach(label => {
          label.style.removeProperty('opacity');
        });
        console.log('[SIDEBAR] Original CSS hover behavior restored');
      }
    }, 100);
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
