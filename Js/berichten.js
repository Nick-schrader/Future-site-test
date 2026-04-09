// ---- Berichten Systeem ----
// Systeem voor het tonen van promoties en roepnummer wijzigingen per Discord ID


class BerichtenSysteem {
  constructor() {
    this.berichten = [];
    this.user = null;
    this.init();
  }

  async init() {
    // Wacht op DOM en user data
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  async setup() {
    // Haal user data op
    this.user = this.getUser();
    
    if (this.user && this.user.id) {
      await this.loadBerichten();
      
            
      this.updateBerichtenMenu();
    }
  }

  getUser() {
    const saved = sessionStorage.getItem('user');
    if (!saved || saved === 'null' || saved === 'undefined') {
      return null;
    }
    try {
      return JSON.parse(saved);
    } catch (e) {
      return null;
    }
  }

  async loadBerichten() {
    try {
      // Haal berichten op voor deze gebruiker via Discord ID
      const response = await fetch(`${window.CONFIG.API_URL}/api/berichten/${this.user.id}`);
      if (response.ok) {
        this.berichten = await response.json();
      } else {
        // Fallback naar localStorage als API niet beschikbaar is
        const saved = localStorage.getItem(`berichten_${this.user.id}`);
        if (saved) {
          this.berichten = JSON.parse(saved);
        }
      }
    } catch (error) {
      console.log('[BERICHTEN] Fout bij laden berichten:', error);
      // Fallback naar localStorage
      const saved = localStorage.getItem(`berichten_${this.user.id}`);
      if (saved) {
        this.berichten = JSON.parse(saved);
      }
    }
  }

  updateBerichtenMenu() {
    const berichtenMenu = document.querySelector('.berichten-menu');
    const berichtenMenuName = document.querySelector('.berichten-menu-name');
    const berichtenBadge = document.querySelector('.berichten-badge');
    
    console.log('[BERICHTEN] updateBerichtenMenu called');
    console.log('[BERICHTEN] User:', this.user);
    console.log('[BERICHTEN] Total berichten:', this.berichten.length);
    console.log('[BERICHTEN] Elements found:', {
      berichtenMenu: !!berichtenMenu,
      berichtenMenuName: !!berichtenMenuName,
      berichtenBadge: !!berichtenBadge
    });
    
    if (!berichtenMenu || !berichtenMenuName) {
      console.log('[BERICHTEN] Elements not found, creating fallback...');
      
      // Create fallback berichten menu if it doesn't exist
      if (!berichtenMenu) {
        const newMenu = document.createElement('div');
        newMenu.className = 'berichten-menu';
        newMenu.style.cssText = `
          position: fixed;
          top: 60px;
          right: 20px;
          background: white;
          border: 1px solid #ddd;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          min-width: 300px;
          max-height: 400px;
          overflow-y: auto;
          z-index: 1000;
          display: none;
        `;
        
        // Add CSS for berichten items
        const style = document.createElement('style');
        style.textContent = `
          .bericht-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
          }
          .bericht-verwijder {
            background: #ff4444;
            color: white;
            border: none;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
          }
          .bericht-verwijder:hover {
            background: #cc0000;
          }
          .berichten-menu-item {
            padding: 12px;
            border-bottom: 1px solid #eee;
            cursor: pointer;
            transition: background 0.2s;
          }
          .berichten-menu-item:hover {
            background: #f5f5f5;
          }
          .bericht-type {
            font-weight: bold;
            color: #333;
            text-transform: capitalize;
          }
          .bericht-tekst {
            margin: 8px 0;
            color: #555;
          }
          .bericht-tijd {
            font-size: 12px;
            color: #888;
          }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(newMenu);
        berichtenMenu = newMenu;
      }
      
      if (!berichtenMenuName) {
        berichtenMenuName = document.createElement('div');
        berichtenMenuName.className = 'berichten-menu-name';
        berichtenMenu.appendChild(berichtenMenuName);
      }
      
      console.log('[BERICHTEN] Fallback elements created');
    }

    // Toon alle berichten (zowel gelezen als ongelezen)
    console.log('[BERICHTEN] Alle berichten:', this.berichten.length);
    console.log('[BERICHTEN] Alle berichten details:', this.berichten.map(b => ({
      id: b.id,
      type: b.type,
      gelezen: b.gelezen,
      bericht: b.bericht
    })));
    
    if (this.berichten.length > 0) {
      // Bereken ongelezen berichten voor badge (alle berichten, niet alleen laatste 3)
      const ongelezenBerichten = this.berichten.filter(b => !b.gelezen);
      const totaalAantal = this.berichten.length;
      const aantalGetoond = Math.min(3, totaalAantal);
      
      berichtenMenuName.textContent = `${ongelezenBerichten.length} nieuwe berichten (toon ${aantalGetoond}/${totaalAantal})`;
      console.log('[BERICHTEN] Menu name updated:', berichtenMenuName.textContent);
      
      // Update badge
      if (berichtenBadge) {
        berichtenBadge.textContent = ongelezenBerichten.length;
        berichtenBadge.style.display = 'flex';
        console.log('[BERICHTEN] Badge updated:', berichtenBadge.textContent);
      }
      
      // Maak berichten items aan
      const bestaandeItems = berichtenMenu.querySelectorAll('.berichten-menu-item');
      bestaandeItems.forEach(item => item.remove());
      
      console.log('[BERICHTEN] Creating berichten items, total:', this.berichten.length);
      
      // Laat alleen laatste 3 berichten zien
      const laatsteBerichten = this.berichten.slice(-3);
      console.log('[BERICHTEN] Laatste 3 berichten:', laatsteBerichten.length);
      
      laatsteBerichten.forEach((bericht, index) => {
        console.log('[BERICHTEN] Creating item for bericht:', bericht);
        const berichtItem = document.createElement('div');
        berichtItem.className = 'berichten-menu-item';
        berichtItem.style.cssText = `
          padding: 12px;
          border-bottom: 1px solid #444;
          cursor: pointer;
          transition: background 0.2s;
          width: 100%;
          box-sizing: border-box;
          background: #1a1a2e;
          color: white;
        `;
        berichtItem.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="font-weight: bold; color: #ffffffb2; text-transform: capitalize;">${bericht.type}</div>
            <button onclick="window.verwijderBericht('${bericht.id}', event)" 
                    style="background: #e74c3c; color: white; border: 1px solid #c0392b; border-radius: 4px; 
                           width: 24px; height: 24px; cursor: pointer; font-size: 14px; font-weight: bold;
                           display: flex; align-items: center; justify-content: center; 
                           transition: all 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.2);" 
                    onmouseover="this.style.background='#c0392b'; this.style.transform='scale(1.1)'" 
                    onmouseout="this.style.background='#e74c3c'; this.style.transform='scale(1)'"
                    title="Verwijder bericht">×</button>
          </div>
          <div style="margin: 8px 0; color: #ffffffb2; width: 100%; word-wrap: break-word; white-space: normal; line-height: 1.4;">${bericht.bericht}</div>
          <div style="font-size: 12px; color: #b0b0b0;">${new Date(bericht.tijd).toLocaleString('nl-NL')}</div>
        `;
        berichtItem.onclick = (e) => {
          // Don't mark as read if clicking on the delete button
          if (e.target.tagName === 'BUTTON' || e.target.onclick?.toString().includes('verwijderBericht')) {
            return;
          }
          this.markeerGelezen(bericht.id);
        };
        berichtenMenu.appendChild(berichtItem);
        console.log('[BERICHTEN] Bericht item added:', index + 1);
      });
      
      console.log('[BERICHTEN] Total items added:', this.berichten.length);
      console.log('[BERICHTEN] Menu children count:', berichtenMenu.children.length);
      
      // Toon berichten menu
      berichtenMenu.style.display = 'block';
      console.log('[BERICHTEN] Menu displayed');
    } else {
      // Geen nieuwe berichten, verberg menu en badge
      berichtenMenu.style.display = 'none';
      if (berichtenBadge) {
        berichtenBadge.style.display = 'none';
      }
      console.log('[BERICHTEN] No unread messages, menu hidden');
    }
  }

  async markeerGelezen(berichtId) {
    // Markeer bericht als gelezen
    const bericht = this.berichten.find(b => b.id === berichtId);
    if (bericht) {
      bericht.gelezen = true;
      
      // Update localStorage
      localStorage.setItem(`berichten_${this.user.id}`, JSON.stringify(this.berichten));
      
      // Probeer te syncen met API
      try {
        await fetch(`${window.CONFIG.API_URL}/api/berichten/${berichtId}/gelezen`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });
      } catch (error) {
        console.log('[BERICHTEN] Fout bij markeren als gelezen:', error);
      }
      
      // Update menu
      this.updateBerichtenMenu();
    }
  }

  // Functie voor admins om berichten te sturen
  static async stuurBericht(discordId, type, bericht) {
    const nieuwBericht = {
      id: Date.now().toString(),
      discord_id: discordId, // Use discord_id for backend compatibility
      type: type, // 'promotie', 'roepnummer', 'demotie', 'ontslag'
      bericht: bericht,
      tijd: new Date().toISOString(),
      gelezen: false
    };

    console.log('[BERICHTEN] Bericht versturen naar:', discordId);
    console.log('[BERICHTEN] Bericht type:', type);
    console.log('[BERICHTEN] Bericht tekst:', bericht);
    console.log('[BERICHTEN] API URL:', window.CONFIG.API_URL);
    console.log('[BERICHTEN] Nieuw bericht object:', nieuwBericht);

    try {
      // Probeer naar API te sturen
      const response = await fetch(`${window.CONFIG.API_URL}/api/berichten`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(nieuwBericht)
      });
      
      console.log('[BERICHTEN] API response status:', response.status);
      if (response.ok) {
        console.log('[BERICHTEN] Bericht succesvol verstuurd');
      } else {
        console.error('[BERICHTEN] API error:', response.status, response.statusText);
      }
    } catch (error) {
      console.log('[BERICHTEN] Fout bij versturen bericht, sla lokaal op:', error);
      
      // Fallback: sla op in localStorage van de gebruiker
      const saved = localStorage.getItem(`berichten_${discordId}`);
      const berichten = saved ? JSON.parse(saved) : [];
      berichten.push(nieuwBericht);
      localStorage.setItem(`berichten_${discordId}`, JSON.stringify(berichten));
      
      // Forceer directe update van berichten menu
      setTimeout(() => {
        console.log('[BERICHTEN] Forcing berichten menu update...');
        berichtenSysteem.updateBerichtenMenu();
      }, 100);
    }
  }
}

// Initialiseer berichten systeem
const berichtenSysteem = new BerichtenSysteem();

// Export voor gebruik in andere files
window.BerichtenSysteem = BerichtenSysteem;

// Verwijder bericht functie
window.verwijderBericht = function(berichtId, event) {
    if (event) {
        event.stopPropagation();
    }
    
    console.log('[BERICHTEN] Bericht verwijderen:', berichtId);
    
    // Verwijder uit frontend
    const index = berichtenSysteem.berichten.findIndex(b => b.id === berichtId);
    if (index > -1) {
        berichtenSysteem.berichten.splice(index, 1);
        console.log('[BERICHTEN] Bericht verwijderd uit frontend');
    }
    
    // Verwijder uit database via API
    fetch(`${window.CONFIG.API_URL}/api/berichten/${berichtId}`, {
        method: 'DELETE'
    })
    .then(response => {
        if (response.ok) {
            console.log('[BERICHTEN] Bericht succesvol verwijderd uit database');
        } else {
            console.error('[BERICHTEN] Fout bij verwijderen bericht uit database:', response.status);
            // Remove from localStorage as fallback
            const saved = localStorage.getItem(`berichten_${berichtenSysteem.user.id}`);
            if (saved) {
                const berichten = JSON.parse(saved);
                const filtered = berichten.filter(b => b.id !== berichtId);
                localStorage.setItem(`berichten_${berichtenSysteem.user.id}`, JSON.stringify(filtered));
                console.log('[BERICHTEN] Bericht verwijderd uit localStorage als fallback');
            }
        }
    })
    .catch(error => {
        console.error('[BERICHTEN] API fout bij verwijderen bericht:', error);
        // Remove from localStorage as fallback
        const saved = localStorage.getItem(`berichten_${berichtenSysteem.user.id}`);
        if (saved) {
            const berichten = JSON.parse(saved);
            const filtered = berichten.filter(b => b.id !== berichtId);
            localStorage.setItem(`berichten_${berichtenSysteem.user.id}`, JSON.stringify(filtered));
            console.log('[BERICHTEN] Bericht verwijderd uit localStorage als fallback');
        }
    });
    
    // Update menu and reload data
    berichtenSysteem.updateBerichtenMenu();
    
    // Forceer directe data refresh
    setTimeout(async () => {
        await berichtenSysteem.loadBerichten();
        berichtenSysteem.updateBerichtenMenu();
    }, 100);
};

// Test function - direct bericht sturen
window.testBericht = function() {
    console.log('[TEST] Direct bericht test...');
    berichtenSysteem.stuurBericht('1196035736823156790', 'test', 'Dit is een testbericht');
};

console.log('[BERICHTEN] Test functie beschikbaar:', typeof window.testBericht);

// Reload berichten bij pagina focus/wissel
document.addEventListener('visibilitychange', async () => {
  if (!document.hidden && berichtenSysteem.user) {
    await berichtenSysteem.loadBerichten();
    berichtenSysteem.updateBerichtenMenu();
  }
});

// Periodieke refresh (elke 30 seconden)
setInterval(async () => {
  if (berichtenSysteem.user) {
    await berichtenSysteem.loadBerichten();
    berichtenSysteem.updateBerichtenMenu();
  }
}, 30000);
