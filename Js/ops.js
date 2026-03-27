// ---- OPS OVERZICHT ----
const CAT_LABELS = { porto: 'Noodhulp', opco: 'OPCO', ovd: 'OVD', oc: 'OC' };
let _alleTijden = [];

window.onload = () => {
  laadTijden();
};

function laadTijden() {
  fetch(`${API_URL}/api/tijden-overzicht`)
    .then(r => r.json())
    .then(data => {
      _alleTijden = data;

      // Vul week filter
      const weken = [...new Set(data.map(d => d.week))].sort((a, b) => b - a);
      const weekFilter = document.getElementById('week-filter');
      weken.forEach(w => {
        const opt = document.createElement('option');
        opt.value = w; opt.textContent = 'Week ' + w;
        weekFilter.appendChild(opt);
      });

      // Vul persoon filter
      const namen = [...new Set(data.map(d => d.naam))].sort();
      const persoonFilter = document.getElementById('persoon-filter');
      namen.forEach(n => {
        const opt = document.createElement('option');
        opt.value = n; opt.textContent = n;
        persoonFilter.appendChild(opt);
      });

      filterTijden();
      renderTop10();
    })
    .catch(() => {
      document.getElementById('ops-tbody').innerHTML = '<tr><td colspan="4" style="color:#555;text-align:center">Kan data niet laden</td></tr>';
    });
}

function filterTijden() {
  const week = document.getElementById('week-filter').value;
  const cat = document.getElementById('cat-filter').value;
  const persoon = document.getElementById('persoon-filter').value;

  let gefilterd = _alleTijden;
  if (week) gefilterd = gefilterd.filter(d => d.week == week);
  if (cat) gefilterd = gefilterd.filter(d => d.categorie === cat);
  if (persoon) gefilterd = gefilterd.filter(d => d.naam === persoon);

  const tbody = document.getElementById('ops-tbody');
  if (gefilterd.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="color:#555;text-align:center">Geen data</td></tr>';
    return;
  }

  tbody.innerHTML = gefilterd.map(d => `
    <tr>
      <td>${d.naam}</td>
      <td><span class="badge badge-purple">${CAT_LABELS[d.categorie] || d.categorie}</span></td>
      <td>Week ${d.week}</td>
      <td style="font-family:monospace">${d.uren}</td>
      <td style="text-align:right;position:relative">
        <button class="btn-ghost" style="padding:2px 10px;font-size:1.1rem" onclick="toggleActieMenu(event,'${d.user_id}','${d.categorie}',${d.week})">&#8943;</button>
      </td>
    </tr>
  `).join('');
}

function renderTop10() {
  // Tel totale ms per persoon over alle categorieën
  const totalen = {};
  _alleTijden.forEach(d => {
    const ms = tijdNaarMs(d.uren);
    totalen[d.naam] = (totalen[d.naam] || 0) + ms;
  });

  const gesorteerd = Object.entries(totalen)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const tbody = document.getElementById('top10-tbody');
  tbody.innerHTML = gesorteerd.map(([naam, ms], i) => `
    <tr>
      <td style="color:#a78bfa;font-weight:bold">#${i + 1}</td>
      <td>${naam}</td>
      <td style="font-family:monospace">${msNaarTijd(ms)}</td>
    </tr>
  `).join('');
}

let _verwijderData = null;

function toggleActieMenu(event, userId, categorie, week) {
  event.stopPropagation();
  // Verwijder bestaand menu
  document.querySelectorAll('.actie-dropdown').forEach(el => el.remove());

  const menu = document.createElement('div');
  menu.className = 'actie-dropdown';
  menu.innerHTML = `<div class="actie-dropdown-item actie-delete" onclick="verwijderTijd('${userId}','${categorie}',${week})">&#128465; Verwijderen</div>`;

  const btn = event.currentTarget;
  const rect = btn.getBoundingClientRect();
  menu.style.cssText = `position:fixed;top:${rect.bottom + 4}px;right:${window.innerWidth - rect.right}px;z-index:999`;
  document.body.appendChild(menu);

  setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 0);
}

function verwijderTijd(userId, categorie, week) {
  document.querySelectorAll('.actie-dropdown').forEach(el => el.remove());
  _verwijderData = { userId, categorie, week };
  document.getElementById('verwijder-modal').classList.remove('hidden');
}

function bevestigVerwijder() {
  if (!_verwijderData) return;
  const { userId, categorie, week } = _verwijderData;
  document.getElementById('verwijder-modal').classList.add('hidden');
  fetch(`${API_URL}/api/tijden/${userId}/${categorie}/${week}`, { method: 'DELETE' })
    .then(() => { _verwijderData = null; laadTijden(); showToast('Tijdregel verwijderd'); });
}

function tijdNaarMs(tijdStr) {
  const [h, m, s] = tijdStr.split(':').map(Number);
  return ((h * 3600) + (m * 60) + s) * 1000;
}

function msNaarTijd(ms) {
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
  return `${h}:${m}:${s}`;
}
