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
      
      // Voeg test bericht toe voor debugging
      if (this.berichten.length === 0) {
        const testBericht = {
          id: 'test-' + Date.now(),
          discordId: this.user.id,
          type: 'test',
          bericht: 'Dit is een test bericht om het systeem te controleren.',
          tijd: new Date().toISOString(),
          gelezen: false
        };
        this.berichten.push(testBericht);
        
        // Sla test bericht op in localStorage
        localStorage.setItem(`berichten_${this.user.id}`, JSON.stringify(this.berichten));
        console.log('[BERICHTEN] Test bericht toegevoegd:', testBericht);
      }
      
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
      const response = await fetch(`${API_URL}/api/berichten/${this.user.id}`);
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
      console.log('[BERICHTEN] Elements not found, returning');
      return;
    }

    // Filter ongelezen berichten
    const ongelezenBerichten = this.berichten.filter(b => !b.gelezen);
    console.log('[BERICHTEN] Ongelezen berichten:', ongelezenBerichten.length);
    
    if (ongelezenBerichten.length > 0) {
      // Toon aantal ongelezen berichten
      berichtenMenuName.textContent = `${ongelezenBerichten.length} nieuwe berichten`;
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
      
      ongelezenBerichten.forEach((bericht, index) => {
        console.log('[BERICHTEN] Creating item for bericht:', bericht);
        const berichtItem = document.createElement('div');
        berichtItem.className = 'berichten-menu-item';
        berichtItem.innerHTML = `
          <div class="bericht-type">${bericht.type}</div>
          <div class="bericht-tekst">${bericht.bericht}</div>
          <div class="bericht-tijd">${new Date(bericht.tijd).toLocaleString('nl-NL')}</div>
        `;
        berichtItem.onclick = () => this.markeerGelezen(bericht.id);
        berichtenMenu.appendChild(berichtItem);
        console.log('[BERICHTEN] Bericht item added:', index + 1);
      });
      
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
        await fetch(`${API_URL}/api/berichten/${berichtId}/gelezen`, {
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
      discordId: discordId,
      type: type, // 'promotie', 'roepnummer', 'demotie', 'ontslag'
      bericht: bericht,
      tijd: new Date().toISOString(),
      gelezen: false
    };

    try {
      // Probeer naar API te sturen
      const response = await fetch(`${API_URL}/api/berichten`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(nieuwBericht)
      });
      
      if (response.ok) {
        console.log('[BERICHTEN] Bericht succesvol verstuurd');
      }
    } catch (error) {
      console.log('[BERICHTEN] Fout bij versturen bericht, sla lokaal op:', error);
      
      // Fallback: sla op in localStorage van de gebruiker
      const saved = localStorage.getItem(`berichten_${discordId}`);
      const berichten = saved ? JSON.parse(saved) : [];
      berichten.push(nieuwBericht);
      localStorage.setItem(`berichten_${discordId}`, JSON.stringify(berichten));
    }
  }
}

// Initialiseer berichten systeem
const berichtenSysteem = new BerichtenSysteem();

// Export voor gebruik in andere files
window.BerichtenSysteem = BerichtenSysteem;
