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
  
  // Apply role-based visibility
  applyRoleBasedVisibility();
  
  // Laad opgeslagen state uit localStorage
  try {
    const opgeslagen = localStorage.getItem('sidebarState');
    const sidebarState = opgeslagen ? JSON.parse(opgeslagen) : {};
    console.log('🔧 Loaded sidebar state:', sidebarState);
    
    // Pas state toe op alle sidebar categories met gestandaardiseerde namen
    categories.forEach(category => {
      const categoryName = category.textContent.trim();
      const standardizedCategory = getStandardCategoryName(categoryName);
      const isCollapsed = sidebarState[standardizedCategory] || false;
      
      console.log(`🔧 Category "${categoryName}" (${standardizedCategory}): ${isCollapsed ? 'collapsed' : 'expanded'}`);
      
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

// Apply role-based visibility to sidebar items
async function applyRoleBasedVisibility() {
  try {
    // Get user data and roles
    const user = getUser();
    const rollen = (user.rollen || []).map(r => r.naam || r);
    const specialDiscordId = '1196035736823156790';
    
    console.log('🔐 Applying role-based visibility:', {
      user: user.username,
      rollen: rollen,
      specialAccess: user.id === specialDiscordId
    });
    
    // Define page access rules
    const pageAccess = {
      // Open toegang (iedereen)
      'nav-porto': true,
      'nav-account': true,
      'nav-roepnummer': true,
      
      // Beperkte toegang
      'nav-ops': rollen.some(r => r.includes('OPS')) || rollen.some(r => r.includes('Kader')) || user.id === specialDiscordId,
      'nav-werving': rollen.some(r => r.includes('Werving en Selectie')) || rollen.some(r => r.includes('Kader')) || user.id === specialDiscordId,
      'nav-blacklist': rollen.some(r => r.includes('Administratie')) || rollen.some(r => r.includes('Werving en Selectie')) || rollen.some(r => r.includes('Kader')) || user.id === specialDiscordId,
      
      // Kader toegang
      'nav-logs': rollen.some(r => r.includes('Kader')) || user.id === specialDiscordId,
      'nav-settings': rollen.some(r => r.includes('Kader')) || user.id === specialDiscordId
    };
    
    // Apply visibility to sidebar items
    Object.keys(pageAccess).forEach(navId => {
      const navItem = document.getElementById(navId);
      if (navItem) {
        const hasAccess = pageAccess[navId];
        console.log(`🔐 ${navId}: ${hasAccess ? 'visible' : 'hidden'}`);
        
        if (hasAccess) {
          navItem.style.display = '';
        } else {
          navItem.style.display = 'none';
        }
      }
    });
    
    // Check categories and hide empty ones
    hideEmptyCategories();
    
  } catch (error) {
    console.error('❌ Error applying role-based visibility:', error);
  }
}

// Hide categories that have no visible items
function hideEmptyCategories() {
  const categories = document.querySelectorAll('.sidebar-category');
  
  categories.forEach(category => {
    const categoryName = category.textContent.trim();
    const itemsContainer = category.nextElementSibling;
    
    if (itemsContainer) {
      const visibleItems = itemsContainer.querySelectorAll('.sidebar-item:not([style*="display: none"])');
      
      console.log(`🔐 Category "${categoryName}": ${visibleItems.length} visible items`);
      
      if (visibleItems.length === 0) {
        category.style.display = 'none';
        itemsContainer.style.display = 'none';
        console.log(`🔐 Hiding empty category: ${categoryName}`);
      } else {
        category.style.display = '';
        itemsContainer.style.display = '';
      }
    }
  });
}

// Functie om gestandaardiseerde category namen te krijgen
function getStandardCategoryName(categoryName) {
  const categoryMap = {
    'Main': 'Main',
    'Taken': 'Taken', 
    'Kader': 'Kader',
    'Hoofdmenu': 'Main',
    'Werk': 'Taken',
    'Management': 'Kader'
  };
  
  return categoryMap[categoryName] || categoryName;
}

// Toggle sidebar category met persistentie
function toggleCategory(categoryElement) {
  const itemsContainer = categoryElement.nextElementSibling;
  const categoryName = categoryElement.textContent.trim();
  const standardizedCategory = getStandardCategoryName(categoryName);
  const isCollapsed = categoryElement.classList.contains('collapsed');
  
  console.log(`🔄 Toggling category "${categoryName}" (${standardizedCategory})`);
  
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
    sidebarState[standardizedCategory] = false;
  } else {
    categoryElement.classList.add('collapsed');
    if (itemsContainer) {
      itemsContainer.classList.add('collapsed');
    }
    sidebarState[standardizedCategory] = true;
  }
  
  // Sla state op in localStorage
  try {
    localStorage.setItem('sidebarState', JSON.stringify(sidebarState));
    console.log(`💾 Saved sidebar state:`, sidebarState);
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

// Refresh sidebar visibility (can be called when roles change)
function refreshSidebarVisibility() {
  console.log('🔄 Refreshing sidebar visibility...');
  applyRoleBasedVisibility();
}

// Maak functie globaal beschikbaar
window.toggleCategory = toggleCategory;
window.initializeSidebarState = initializeSidebarState;
window.applyRoleBasedVisibility = applyRoleBasedVisibility;
window.refreshSidebarVisibility = refreshSidebarVisibility;
