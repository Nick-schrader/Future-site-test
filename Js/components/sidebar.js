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

  setupUnifiedHover() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    let isExpanded = false;
    let hoverTimeout;
    let isHovering = false;

    // Complete JavaScript state management - no CSS hover
    const setExpandedState = (expanded) => {
      isExpanded = expanded;
      if (expanded) {
        sidebar.classList.add('expanded');
        sidebar.style.width = '220px';
      } else {
        sidebar.classList.remove('expanded');
        sidebar.style.width = '64px';
      }
      
      // Update all labels immediately
      const labels = sidebar.querySelectorAll('.sidebar-label');
      labels.forEach(label => {
        label.style.opacity = expanded ? '1' : '0';
      });
      
      console.log(`[SIDEBAR] State changed: ${expanded ? 'expanded' : 'collapsed'}`);
    };

    // Unified hover management - pure JavaScript
    sidebar.addEventListener('mouseenter', () => {
      clearTimeout(hoverTimeout);
      isHovering = true;
      setExpandedState(true);
    });

    sidebar.addEventListener('mouseleave', () => {
      isHovering = false;
      hoverTimeout = setTimeout(() => {
        if (!isHovering) {
          setExpandedState(false);
        }
      }, 150);
    });

    // Handle item hover within sidebar
    const items = sidebar.querySelectorAll('.sidebar-item');
    items.forEach(item => {
      item.addEventListener('mouseenter', () => {
        if (!isExpanded) {
          setExpandedState(true);
        }
      });
    });

    // Initialize state
    setExpandedState(false);
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
