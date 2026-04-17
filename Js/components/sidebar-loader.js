// ---- SIDEBAR LOADER ----
// Functie om sidebar HTML te laden en injecteren

async function loadSidebar() {
  try {
    // Haal sidebar HTML template op
    const response = await fetch('../components/sidebar.html');
    const sidebarHTML = await response.text();
    
    // Zoek sidebar placeholder in de pagina
    const sidebarPlaceholder = document.querySelector('aside.sidebar');
    if (sidebarPlaceholder) {
      // Vervang bestaande sidebar met component
      sidebarPlaceholder.outerHTML = sidebarHTML;
    } else {
      // Als er geen sidebar is, voeg deze toe aan de layout
      const layout = document.querySelector('.layout');
      if (layout) {
        layout.insertAdjacentHTML('afterbegin', sidebarHTML);
      }
    }
    
    // Laad sidebar component JavaScript
    await loadSidebarScript();
    
    // Initialiseer sidebar component
    if (window.initSidebar) {
      window.initSidebar();
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
