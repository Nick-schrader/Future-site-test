// ---- SIDEBAR COMPONENT ----
class SidebarComponent {
  constructor() {
    this.currentPage = window.location.pathname.split('/').pop() || 'porto.html';
    this.init();
  }

  init() {
    this.updateNavigation();
    this.setupEventListeners();
  }

  updateNavigation() {
    const u = getUser();
    const rollen = (u.rollen || []).map(r => r.naam || r);
    const isAdmin = u.isAdmin === 1 || u.id === '1196035736823156790';
    const userRole = rollen[0] || 'user';

    // Verwijder active class van alle sidebar items
    document.querySelectorAll('.sidebar-item').forEach(item => {
      item.classList.remove('active');
    });

    // Toon/verberg menu items op basis van rol en admin status
    const navOps = document.getElementById('nav-ops');
    const navLogs = document.getElementById('nav-logs');
    const navSettings = document.getElementById('nav-settings');
    
    if (navOps) navOps.style.display = ['ovd', 'opco'].includes(userRole) || isAdmin ? '' : 'none';
    if (navLogs) navLogs.style.display = ['ovd', 'opco'].includes(userRole) || isAdmin ? '' : 'none';
    if (navSettings) navSettings.style.display = ['ovd', 'opco'].includes(userRole) || isAdmin ? '' : 'none';

    // Voeg active class toe aan huidige pagina
    const navItem = document.querySelector(`[href="${this.currentPage}"]`);
    if (navItem) {
      navItem.classList.add('active');
    }
  }

  setupEventListeners() {
    // Luister naar gebruiker data updates
    window.addEventListener('userUpdated', () => {
      this.updateNavigation();
    });

    // Luister naar Discord rol updates
    window.addEventListener('discordRolesUpdated', () => {
      this.updateNavigation();
    });
  }

  // Methode om handmatig navigatie bij te werken
  refresh() {
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
