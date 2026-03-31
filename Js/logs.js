// ---- LOGS PAGE ----
const ACTIE_LABELS = {
  uren_verwijderd: 'Uren verwijderd',
  uren_aangepast: 'Uren aangepast',
  uren_gereset: 'Uren gereset',
  reset: 'Reset gebruiker',
  rol_toewijzen: 'Rol toegekend',
  indeling: 'Indeling gewijzigd',
  status: 'Status gewijzigd',
  voertuig: 'Voertuig gewijzigd',
  login: 'Login',
  logout: 'Logout',
  account_update: 'Account gewijzigd',
  koppel: 'Gekoppeld',
  ontkoppel: 'Ontkoppeld',
};

let _alleLogs = [];

window.onload = () => {
  if (!sessionStorage.getItem('loggedIn')) { window.location.href = '../index.html'; return; }
  laadLogs();
};

function laadLogs() {
  fetch(`${API_URL}/api/logs`)
    .then(r => r.json())
    .then(data => {
      _alleLogs = data;
      filterLogs();
    })
    .catch(() => {
      document.getElementById('logs-tbody').innerHTML = '<tr><td colspan="5" style="color:#555;text-align:center">Kan logs niet laden</td></tr>';
    });
}

function filterLogs() {
  const actie = document.getElementById('log-actie-filter')?.value || '';
  const zoek = document.getElementById('log-zoek-filter')?.value.toLowerCase() || '';
  const datum = document.getElementById('log-date-filter')?.value || '';

  let gefilterd = _alleLogs;
  
  // Filter op actie
  if (actie) gefilterd = gefilterd.filter(l => l.actie === actie);
  
  // Filter op zoekterm
  if (zoek) gefilterd = gefilterd.filter(l => (l.door + l.details).toLowerCase().includes(zoek));
  
  // Filter op datum
  if (datum) {
    const filterDatum = new Date(datum);
    gefilterd = gefilterd.filter(l => {
      const logDatum = new Date(l.tijd);
      return logDatum.toDateString() === filterDatum.toDateString();
    });
  }

  const tbody = document.getElementById('logs-tbody');
  if (gefilterd.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="color:#555;text-align:center">Geen logs</td></tr>';
    return;
  }
  
  tbody.innerHTML = gefilterd.map(l => `
    <tr>
      <td style="white-space:nowrap;color:#888;font-size:0.8rem">${new Date(l.tijd).toLocaleString('nl-NL')}</td>
      <td><span class="badge badge-purple">${ACTIE_LABELS[l.actie] || l.actie}</span></td>
      <td>${l.door || '-'}</td>
      <td>${l.wie || '-'}</td>
      <td style="color:#cdd6f4">${l.wat || '-'}</td>
    </tr>
  `).join('');
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
