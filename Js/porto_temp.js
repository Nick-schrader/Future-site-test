function openKandidatenModal(rol) {
  _kandidatenRol = rol;
  document.getElementById('kandidaten-titel').textContent = 'Nieuwe ' + rol.toUpperCase() + ' kiezen';
  document.getElementById('kandidaten-modal').classList.remove('hidden');

  fetch(`${API_URL}/api/kandidaten/${rol}`)
    .then(r => r.json())
    .then(kandidaten => {
      _kandidatenLijst = kandidaten;
      const lijst = document.getElementById('kandidaten-lijst');
      
      // Filter kandidaten op basis van rol - check zowel rollen array als role property
      const gefilterdeKandidaten = kandidaten.filter(k => {
        // Check of kandidaat de juiste rol heeft (case-insensitive)
        const heeftJuisteRol = k.rollen && k.rollen.some(r => {
          const rolString = typeof r === 'string' ? r : (r.naam || '');
          return rolString.toLowerCase().includes(rol.toLowerCase());
        });
        
        // Fallback: check ook role property als rollen leeg is
        const heeftRolProperty = k.role && k.role.toLowerCase() === rol.toLowerCase();
        
        return heeftJuisteRol || heeftRolProperty;
      });
      
      console.log('🔍 KANDIDATEN FILTER - Rol:', rol, 'Totaal:', kandidaten.length, 'Gefilterd:', gefilterdeKandidaten.length);
      
      if (gefilterdeKandidaten.length === 0) {
        lijst.innerHTML = '<div style="color:#888;text-align:center;padding:12px">Geen actieve kandidaten met rol: ' + rol + '</div>';
      } else {
        lijst.innerHTML = gefilterdeKandidaten.map(k => `
          <div style="display:flex;justify-content:space-between;align-items:center;background:#1e2130;padding:10px 14px;border-radius:6px">
            <span>${k.shortname || k.display_name}</span>
            <button class="btn-purple small" onclick="kiesKandidaat('${k.id}','${rol}')">Kiezen</button>
          </div>
        `).join('');
      }
    })
    .catch(error => {
      console.error('Fout bij ophalen kandidaten:', error);
      lijst.innerHTML = '<div style="color:#f87171;text-align:center;padding:12px">Kan kandidaten niet laden</div>';
    });
}
