// ---- LOGS PAGE ----
const ACTIE_LABELS = {
  uren_gereset: 'Uren gereset',
  promotie: 'Promotie',
  demotie: 'Demote',
  roepnummer_wijziging: 'Roepnummer wijziging',
  roepnummer_en_rang_wijziging: 'Roepnummer en rang wijziging',
  ontslag: 'Ontslag',
  blacklist_toegevoegd: 'Toegevoegd aan blacklist',
  blacklist_verwijderd: 'Verwijderd uit blacklist',
  BLACKLIST: 'Blacklist',
};

let _alleLogs = [];

window.onload = () => {
  if (!localStorage.getItem('loggedIn')) { window.location.href = '../index.html'; return; }
  laadLogs();
  
  // Luister naar logsUpdated events van andere pagina's
  window.addEventListener('logsUpdated', (event) => {
    console.log('[LOGS] ===== LOGS UPDATED EVENT START =====');
    console.log('[LOGS] logsUpdated event ontvangen:', event.detail);
    console.log('[LOGS] Event type:', event.type);
    console.log('[LOGS] Current _alleLogs length:', _alleLogs.length);
    
    if (event.detail && Array.isArray(event.detail)) {
      console.log('[LOGS] Nieuwe logs ontvangen:', event.detail.length, 'items');
      _alleLogs = event.detail;
      console.log('[LOGS] _alleLogs bijgewerkt, nieuwe length:', _alleLogs.length);
      filterLogs();
      console.log('[LOGS] filterLogs() aangeroepen');
    } else {
      console.log('[LOGS] Ongeldig event detail:', event.detail);
    }
    
    console.log('[LOGS] ===== LOGS UPDATED EVENT END =====');
  });
};

function laadLogs() {
  console.log('[LOGS] Laden van logs...');
  const logsApiUrl = window.location.origin;
  console.log('[LOGS] API URL:', logsApiUrl);
  
  fetch(`${logsApiUrl}/api/logs`)
    .then(r => {
      console.log('[LOGS] Response status:', r.status);
      return r.json();
    })
    .then(data => {
      console.log('[LOGS] Data ontvangen:', data);
      console.log('[LOGS] Aantal logs:', Array.isArray(data) ? data.length : 'Not an array');
      
      // Zorg dat data altijd een array is
      _alleLogs = Array.isArray(data) ? data : [];
      console.log('Logs data:', _alleLogs);
      filterLogs();
    })
    .catch(error => {
      console.log('[LOGS] Fout bij laden logs:', error);
      _alleLogs = [];
      filterLogs();
    });
}

function filterLogs() {
  const tbody = document.getElementById('logs-tbody');
  if (!tbody) {
    console.error('[LOGS] logs-tbody element niet gevonden');
    return;
  }
  
  // Debug DOM element state
  console.log('[LOGS] Tbody element found:', tbody);
  console.log('[LOGS] Tbody parent:', tbody.parentElement);
  console.log('[LOGS] Tbody visibility:', window.getComputedStyle(tbody).display);
  console.log('[LOGS] Tbody parent visibility:', window.getComputedStyle(tbody.parentElement).display);
  
  const actie = document.getElementById('log-actie-filter')?.value || '';
  const zoek = document.getElementById('log-zoek-filter')?.value.toLowerCase() || '';
  const datum = document.getElementById('log-date-filter')?.value || '';

  console.log('[LOGS] FilterLogs aangeroepen');
  console.log('[LOGS] _alleLogs:', _alleLogs);
  console.log('[LOGS] Filters - actie:', actie, 'zoek:', zoek, 'datum:', datum);

  let gefilterd = _alleLogs;
  
  // Filter op actie
  if (actie) gefilterd = gefilterd.filter(l => l.actie === actie);
  
  // Filter op zoekterm
  if (zoek) gefilterd = gefilterd.filter(l => (l.door + l.details).toLowerCase().includes(zoek));
  
  // Filter op datum
  if (datum) {
    const filterDatum = new Date(datum);
    gefilterd = gefilterd.filter(l => {
      const logDatum = new Date(l.timestamp || l.tijd);
      return logDatum.toDateString() === filterDatum.toDateString();
    });
  }

  console.log('[LOGS] Gefilterde logs:', gefilterd);
  console.log('[LOGS] Aantal gefilterd:', gefilterd.length);

  if (gefilterd.length === 0) {
    console.log('[LOGS] Geen logs gevonden, toon "Geen logs" bericht');
    tbody.innerHTML = '<tr><td colspan="6" style="color:#555;text-align:center">Geen logs</td></tr>';
    return;
  }
  
  const html = gefilterd.map(l => {
    console.log('[LOGS] Rendering log:', l);
    
    // Parse details veld voor wie, reden en uren
    let wie = '-';
    let reden = '-';
    let uren = '-';
    
    if (l.details) {
      // Speciale parsing voor promotie/demotie
      if (l.actie === 'promotie' || l.actie === 'demotie') {
        // Format: "oude rang -> nieuwe rang | Roepnummer: XX-XX"
        if (l.details.includes(' | ')) {
          const parts = l.details.split(' | ');
          const rangPart = parts[0] || '';
          const roepnummerPart = parts[1] || '';
          
          // Parse rang wijziging
          if (rangPart.includes(' -> ')) {
            const rangen = rangPart.split(' -> ');
            reden = `${rangen[0]} naar ${rangen[1]}`;
          } else {
            reden = rangPart;
          }
          
          // Parse roepnummer
          if (roepnummerPart.includes('Roepnummer:')) {
            const roepnummerMatch = roepnummerPart.match(/Roepnummer:\s*(.+)/);
            if (roepnummerMatch) {
              uren = roepnummerMatch[1].trim(); // Gebruik uren kolom voor roepnummer
            }
          }
          
          // Gebruik doelwit als wie, anders fallback
          wie = l.doelwit || '-';
        } else {
          // Fallback zonder roepnummer
          if (l.details.includes(' -> ')) {
            const rangen = l.details.split(' -> ');
            reden = `${rangen[0]} naar ${rangen[1]}`;
          } else {
            reden = l.details;
          }
          wie = l.doelwit || '-';
        }
      } else {
        // Normale parsing voor andere acties
        // Als details " | " bevat, splits het
        if (l.details.includes(' | ')) {
          const parts = l.details.split(' | ');
          wie = parts[0] || '-';
          
          // Probeer uren te extraheren uit het tweede deel
          const urenMatch = parts[1]?.match(/([+-]\d+\.?\d*)/);
          if (urenMatch) {
            uren = urenMatch[1] + ' uur';
            // Verwijder de uren uit de reden
            reden = parts[1].replace(/[+-]\d+\.?\d*\s*uur?/i, '').trim() || '-';
          } else {
            reden = parts[1] || '-';
          }
        } else {
          // Anders proberen te parsen voor uren aanpassingen
          const match = l.details.match(/^([^+]+)\s*([+-]\d+\.?\d*)\s*uur?$/i);
          if (match) {
            wie = match[1].trim();
            uren = match[2] + ' uur';
          } else {
            // Als niets anders werkt, zet alles in reden
            reden = l.details;
          }
        }
      }
    }
    
    return `
    <tr>
      <td style="white-space:nowrap;color:#888;font-size:0.8rem">${new Date(l.timestamp || l.tijd).toLocaleString('nl-NL')}</td>
      <td><span class="badge badge-purple">${ACTIE_LABELS[l.actie] || l.actie}</span></td>
      <td>${l.door || '-'}</td>
      <td>${wie}</td>
      <td>${reden}</td>
      <td style="color:#cdd6f4">${uren}</td>
    </tr>
  `;
  }).join('');
  
  console.log('[LOGS] HTML generated, length:', html.length);
  tbody.innerHTML = html;
  console.log('[LOGS] Tbody innerHTML set');
}

function clearFilters() {
  document.getElementById('log-actie-filter').value = '';
  document.getElementById('log-zoek-filter').value = '';
  document.getElementById('log-date-filter').value = '';
  filterLogs();
}

function verwijderLog(logId) {
  if (!confirm('Weet je zeker dat je deze log wilt verwijderen?')) return;
  
  // Hier zou je een DELETE endpoint kunnen toevoegen aan de backend
  console.log('Verwijder log:', logId);
  showToast('Log verwijderd (implementatie nodig)');
  
  // Voor nu: refresh de logs
  laadLogs();
}
