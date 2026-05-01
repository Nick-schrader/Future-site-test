// Globale Sidebar State Management
// Zorgt ervoor dat sidebar collapse state persistent is tussen pagina's

// Initialiseer sidebar state bij laden van pagina
function initializeSidebarState() {
  // Debug logging
  console.log('🔧 Initializing sidebar state...');
  
  // Controleer of sidebar categories bestaan
  const categories = document.querySelectorAll('.sidebar-category');
  console.log(`🔧 Found ${categories.length} sidebar categories`);
  
  if (categories.length === 0) {
    console.log('🔧 No sidebar categories found, retrying in 100ms...');
    setTimeout(initializeSidebarState, 100);
    return;
  }
  
  // Laad opgeslagen state uit localStorage
  try {
    const opgeslagen = localStorage.getItem('sidebarState');
    const sidebarState = opgeslagen ? JSON.parse(opgeslagen) : {};
    console.log('🔧 Loaded sidebar state:', sidebarState);
    
    // Pas state toe op alle sidebar categories
    categories.forEach(category => {
      const categoryName = category.textContent.trim();
      const isCollapsed = sidebarState[categoryName] || false;
      
      console.log(`🔧 Category "${categoryName}": ${isCollapsed ? 'collapsed' : 'expanded'}`);
      
      if (isCollapsed) {
        category.classList.add('collapsed');
        const itemsContainer = category.nextElementSibling;
        if (itemsContainer) {
          itemsContainer.classList.add('collapsed');
        }
      } else {
        category.classList.remove('collapsed');
        const itemsContainer = category.nextElementSibling;
        if (itemsContainer) {
          itemsContainer.classList.remove('collapsed');
        }
      }
    });
    
    console.log('✅ Sidebar state initialized successfully');
  } catch (error) {
    console.error('❌ Fout bij laden sidebar state:', error);
  }
}

// Toggle sidebar category met persistentie
function toggleCategory(categoryElement) {
  const itemsContainer = categoryElement.nextElementSibling;
  const categoryName = categoryElement.textContent.trim();
  const isCollapsed = categoryElement.classList.contains('collapsed');
  
  // Laad huidige state
  let sidebarState = {};
  try {
    const opgeslagen = localStorage.getItem('sidebarState');
    sidebarState = opgeslagen ? JSON.parse(opgeslagen) : {};
  } catch (error) {
    console.error('Fout bij laden sidebar state:', error);
  }
  
  // Toggle classes
  if (isCollapsed) {
    categoryElement.classList.remove('collapsed');
    if (itemsContainer) {
      itemsContainer.classList.remove('collapsed');
    }
    sidebarState[categoryName] = false;
  } else {
    categoryElement.classList.add('collapsed');
    if (itemsContainer) {
      itemsContainer.classList.add('collapsed');
    }
    sidebarState[categoryName] = true;
  }
  
  // Sla state op in localStorage
  try {
    localStorage.setItem('sidebarState', JSON.stringify(sidebarState));
  } catch (error) {
    console.error('Fout bij opslaan sidebar state:', error);
  }
}

// Initialiseer zodra DOM ready is
document.addEventListener('DOMContentLoaded', function() {
  // Wacht even op volledige DOM
  setTimeout(initializeSidebarState, 50);
});

// Fallback: initialiseer ook als DOM al geladen is
if (document.readyState === 'loading') {
  // DOM is nog aan het laden
  document.addEventListener('DOMContentLoaded', initializeSidebarState);
} else {
  // DOM is al geladen
  setTimeout(initializeSidebarState, 50);
}

// Extra fallback: initialiseer bij window load
window.addEventListener('load', function() {
  setTimeout(initializeSidebarState, 100);
});

// Extra fallback: initialiseer na een korte vertraging
setTimeout(initializeSidebarState, 200);

// Maak functie globaal beschikbaar
window.toggleCategory = toggleCategory;
window.initializeSidebarState = initializeSidebarState;
