// Globale Sidebar State Management
// Zorgt ervoor dat sidebar collapse state persistent is tussen pagina's

// Initialiseer sidebar state bij laden van pagina
function initializeSidebarState() {
  // Laad opgeslagen state uit localStorage
  try {
    const opgeslagen = localStorage.getItem('sidebarState');
    const sidebarState = opgeslagen ? JSON.parse(opgeslagen) : {};
    
    // Pas state toe op alle sidebar categories
    document.querySelectorAll('.sidebar-category').forEach(category => {
      const categoryName = category.textContent.trim();
      const isCollapsed = sidebarState[categoryName] || false;
      
      if (isCollapsed) {
        category.classList.add('collapsed');
        const itemsContainer = category.nextElementSibling;
        if (itemsContainer) {
          itemsContainer.classList.add('collapsed');
        }
      }
    });
  } catch (error) {
    console.error('Fout bij laden sidebar state:', error);
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
  setTimeout(initializeSidebarState, 100);
});

// Maak functie globaal beschikbaar
window.toggleCategory = toggleCategory;
window.initializeSidebarState = initializeSidebarState;
