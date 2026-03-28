// ---- LOGS PAGE ----
const ACTIE_LABELS = {
  uren_verwijderd: 'Uren verwijderd',
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
      document.getElementById('logs-tbody').innerHTML = '<tr><td colspan="4" style="color:#555;text-align:center">Kan logs niet laden</td></tr>';
    });
}

function filterLogs() {
  const actie = document.getElementById('log-actie-filter')?.value || '';
  const zoek = document.getElementById('log-zoek-filter')?.value.toLowerCase() || '';

  let gefilterd = _alleLogs;
  if (actie) gefilterd = gefilterd.filter(l => l.actie === actie);
  if (zoek) gefilterd = gefilterd.filter(l => (l.door + l.details).toLowerCase().includes(zoek));

  const tbody = document.getElementById('logs-tbody');
  if (gefilterd.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="color:#555;text-align:center">Geen logs</td></tr>';
    return;
  }
  tbody.innerHTML = gefilterd.map(l => `
    <tr>
      <td style="white-space:nowrap;color:#888;font-size:0.8rem">${new Date(l.tijd).toLocaleString('nl-NL')}</td>
      <td><span class="badge badge-purple">${ACTIE_LABELS[l.actie] || l.actie}</span></td>
      <td>${l.door}</td>
      <td style="color:#cdd6f4">${l.details}</td>
    </tr>
  `).join('');
}
