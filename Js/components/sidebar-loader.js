// ---- SIDEBAR LOADER ----
// Functie om sidebar HTML te laden en injecteren

async function loadSidebar() {
  try {
    console.log('[SIDEBAR] Loading sidebar...');
    
    // Haal sidebar HTML template op
    const response = await fetch('../../components/sidebar.html');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const sidebarHTML = await response.text();
    console.log('[SIDEBAR] HTML template loaded');
    
    // Zoek sidebar placeholder in de pagina
    const sidebarPlaceholder = document.querySelector('aside.sidebar');
    if (sidebarPlaceholder) {
      // Vervang placeholder innerHTML met sidebar content
      sidebarPlaceholder.innerHTML = sidebarHTML;
      console.log('[SIDEBAR] Sidebar HTML injected');
      
      // Remove inline opacity styles to let CSS classes work
      setTimeout(() => {
        const labels = sidebarPlaceholder.querySelectorAll('.sidebar-label');
        labels.forEach(label => {
          label.style.removeProperty('opacity');
        });
        console.log('[SIDEBAR] Inline opacity styles removed');
      }, 50);
    } else {
      console.error('[SIDEBAR] No sidebar placeholder found');
      return;
    }
    
    // Laad sidebar component JavaScript
    await loadSidebarScript();
    console.log('[SIDEBAR] Sidebar script loaded');
    
    // Initialiseer sidebar component
    if (window.initSidebar) {
      window.initSidebar();
      console.log('[SIDEBAR] Sidebar component initialized');
    } else {
      console.error('[SIDEBAR] initSidebar function not found');
    }
    
  } catch (error) {
    console.error('[SIDEBAR] Error loading sidebar:', error);
    // Fallback: gebruik bestaande sidebar als deze bestaat
    if (window.initSidebar) {
      window.initSidebar();
    }
  }
}

async function loadSidebarScript() {
  // Als sidebar component al geladen is, skip
  if (window.sidebarComponent) {
    return;
  }
  
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '../Js/components/sidebar.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Automatische sidebar loading
function initSidebarLoader() {
  // Wacht tot DOM klaar is
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadSidebar);
  } else {
    loadSidebar();
  }
}

// Export voor gebruik in andere scripts
window.loadSidebar = loadSidebar;
window.initSidebarLoader = initSidebarLoader;

// Automatische initialisatie
initSidebarLoader();
