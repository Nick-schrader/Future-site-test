// ---- LOGS PAGE ----
const ACTIE_LABELS = {
  uren_verwijderd: 'Uren verwijderd',
};

window.onload = () => {
  laadLogs();
};

function laadLogs() {
  fetch(`${API_URL}/api/logs`)
    .then(r => r.json())
    .then(data => {
      const tbody = document.getElementById('logs-tbody');
      if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="color:#555;text-align:center">Geen logs</td></tr>';
        return;
      }
      tbody.innerHTML = data.map(l => `
        <tr>
          <td style="white-space:nowrap;color:#888;font-size:0.8rem">${new Date(l.tijd).toLocaleString('nl-NL')}</td>
          <td><span class="badge badge-purple">${ACTIE_LABELS[l.actie] || l.actie}</span></td>
          <td>${l.door}</td>
          <td style="color:#cdd6f4">${l.details}</td>
        </tr>
      `).join('');
    })
    .catch(() => {
      document.getElementById('logs-tbody').innerHTML = '<tr><td colspan="4" style="color:#555;text-align:center">Kan logs niet laden</td></tr>';
    });
}
