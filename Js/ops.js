// ---- OPS OVERZICHT ----
const CAT_LABELS = { porto: 'Noodhulp', opco: 'OPCO', ovd: 'OVD', oc: 'OC' };
let _alleTijden = [];

window.onload = () => {
  if (!sessionStorage.getItem('loggedIn')) { window.location.href = '../index.html'; return; }
  laadTijden();
  laadMeldingen();
};

function laadMeldingen() {
  fetch(`${API_URL}/api/meldingen-inactiviteit`)
    .then(r => r.json())
    .then(data => {
      const el = document.getElementById('meldingen-inactiviteit');
      if (data.length === 0) {
        el.innerHTML = '<span style="color:#4ade80">✓ Iedereen is de afgelopen week indienst geweest</span>';
        return;
      }
      el.innerHTML = data.map(m => `
        <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #3a1a1a">
          <span style="color:#f87171">●</span>
          <span style="color:#cdd6f4">${m.naam}</span>
          <span style="color:#888;font-size:0.78rem">— niet indienst geweest afgelopen week</span>
        </div>
      `).join('');
    }).catch(() => {
      document.getElementById('meldingen-inactiviteit').innerHTML = '<span style="color:#888">Kan meldingen niet laden</span>';
    });
}

function laadTijden() {
  fetch(`${API_URL}/api/tijden-overzicht`)
    .then(r => r.json())
    .then(data => {
      _alleTijden = data;

      // Vul week filter (unieke weken, geen duplicates)
      const weekFilter = document.getElementById('week-filter');
      const weken = [...new Set(data.map(d => d.week))].sort((a, b) => b - a);
      weekFilter.innerHTML = '<option value="">Alle weken</option>';
      weken.forEach(w => {
        const opt = document.createElement('option');
        opt.value = w; opt.textContent = 'Week ' + w;
        weekFilter.appendChild(opt);
      });

      // Vul persoon filter is verwijderd - nu zoekveld
      // De zoekfunctie werkt met het input veld

      renderTijden();
      renderTop10();
    })
    .catch(() => {
      document.getElementById('ops-tbody').innerHTML = '<tr><td colspan="5" style="color:#555;text-align:center">Kan data niet laden</td></tr>';
    });
}

function filterTijden() {
  const week = document.getElementById('week-filter').value;
  const cat = document.getElementById('cat-filter').value;
  const zoek = document.getElementById('persoon-filter').value.toLowerCase();

  let gefilterd = _alleTijden;
  if (week) gefilterd = gefilterd.filter(d => d.week == week);
  if (cat) gefilterd = gefilterd.filter(d => d.categorie === cat);
  if (zoek) gefilterd = gefilterd.filter(d => d.naam.toLowerCase().includes(zoek));

  // Als geen week filter: toon totaal per persoon per categorie
  if (!week) {
    const totaalPerPersoon = {};
    gefilterd.forEach(d => {
      const key = `${d.naam}_${d.categorie}`;
      if (!totaalPerPersoon[key]) totaalPerPersoon[key] = { naam: d.naam, categorie: d.categorie, user_id: d.user_id, ms: 0 };
      totaalPerPersoon[key].ms += tijdNaarMs(d.uren);
    });
    gefilterd = Object.values(totaalPerPersoon).map(t => ({
      naam: t.naam, categorie: t.categorie, user_id: t.user_id, week: 'Totaal', uren: msNaarTijd(t.ms)
    }));
  }

  const tbody = document.getElementById('ops-tbody');
  if (gefilterd.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="color:#555;text-align:center">Geen data</td></tr>';
    return;
  }

  tbody.innerHTML = gefilterd.map(d => `
    <tr>
      <td>${d.naam}</td>
      <td><span class="badge badge-purple">${CAT_LABELS[d.categorie] || d.categorie}</span></td>
      <td>${d.week === 'Totaal' ? 'Totaal' : 'Week ' + d.week}</td>
      <td style="font-family:monospace">${d.uren}</td>
      <td style="text-align:right;position:relative">
        ${d.week !== 'Totaal' ? `<button class="btn-ghost" style="padding:2px 10px;font-size:1.1rem" onclick="toggleActieMenu(event,'${d.user_id}','${d.categorie}',${d.week})">&#8943;</button>` : `<button class="btn-ghost" style="padding:2px 10px;font-size:1.1rem" onclick="toggleActieMenuUser(event,'${d.user_id}')">&#8943;</button>`}
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

function toggleActieMenuUser(event, userId) {
  event.stopPropagation();
  document.querySelectorAll('.actie-dropdown').forEach(el => el.remove());
  const menu = document.createElement('div');
  menu.className = 'actie-dropdown';
  menu.innerHTML = `
    <div class="actie-dropdown-item" onclick="aanpassenTijdTotaal('${userId}')">✏ Aanpassen</div>
    <div class="actie-dropdown-item actie-delete" onclick="resetTijd('${userId}')">↺ Resetten</div>
  `;
  const btn = event.currentTarget;
  const rect = btn.getBoundingClientRect();
  menu.style.cssText = `position:fixed;top:${rect.bottom + 4}px;right:${window.innerWidth - rect.right}px;z-index:999`;
  document.body.appendChild(menu);
  setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 0);
}

function aanpassenTijdTotaal(userId) {
  document.querySelectorAll('.actie-dropdown').forEach(el => el.remove());
  // Gebruik huidige week en porto als default categorie
  const nu = new Date();
  const week = getWeekNummer(nu);
  _aanpassenData = { userId, categorie: 'porto', week };
  document.getElementById('aanpassen-minuten').value = '';
  document.getElementById('aanpassen-reden').value = '';
  // Toon categorie keuze
  document.getElementById('aanpassen-modal').classList.remove('hidden');
}

function getWeekNummer(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

function toggleActieMenu(event, userId, categorie, week) {
  event.stopPropagation();
  // Verwijder bestaand menu
  document.querySelectorAll('.actie-dropdown').forEach(el => el.remove());

  const menu = document.createElement('div');
  menu.className = 'actie-dropdown';
  menu.innerHTML = `
    <div class="actie-dropdown-item" onclick="aanpassenTijd('${userId}','${categorie}',${week})">✏ Aanpassen</div>
    <div class="actie-dropdown-item" onclick="resetTijd('${userId}')">↺ Resetten</div>
    <div class="actie-dropdown-item actie-delete" onclick="verwijderTijd('${userId}','${categorie}',${week})">🗑 Verwijderen</div>
  `;

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
  const reden = document.getElementById('verwijder-reden').value.trim();
  if (!reden) { showToast('Vul een reden in'); return; }
  const { userId, categorie, week } = _verwijderData;
  const u = getUser();
  document.getElementById('verwijder-modal').classList.add('hidden');
  fetch(`${API_URL}/api/tijden/${userId}/${categorie}/${week}?door=${encodeURIComponent(u.shortname || u.fullname || u.username || 'onbekend')}&reden=${encodeURIComponent(reden)}`, { method: 'DELETE' })
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

let _aanpassenData = null;
let _resetUserId = null;

function aanpassenTijd(userId, categorie, week) {
  document.querySelectorAll('.actie-dropdown').forEach(el => el.remove());
  _aanpassenData = { userId, categorie, week };
  document.getElementById('aanpassen-minuten').value = '';
  document.getElementById('aanpassen-reden').value = '';
  const catEl = document.getElementById('aanpassen-categorie');
  if (catEl) catEl.value = categorie;
  document.getElementById('aanpassen-modal').classList.remove('hidden');
}

function bevestigAanpassen() {
  if (!_aanpassenData) return;
  const minuten = parseInt(document.getElementById('aanpassen-minuten').value);
  const reden = document.getElementById('aanpassen-reden').value.trim();
  const catEl = document.getElementById('aanpassen-categorie');
  if (catEl && !_aanpassenData.categorie) _aanpassenData.categorie = catEl.value;
  else if (catEl) _aanpassenData.categorie = catEl.value;
  if (!reden) { showToast('Vul een reden in'); return; }
  if (isNaN(minuten)) { showToast('Vul een geldig aantal minuten in'); return; }
  const u = getUser();
  document.getElementById('aanpassen-modal').classList.add('hidden');
  fetch(`${API_URL}/api/tijden-aanpassen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ..._aanpassenData, minuten, reden, door: u.shortname || u.fullname || u.username }),
  }).then(() => { _aanpassenData = null; laadTijden(); showToast('Uren aangepast'); });
}

function resetTijd(userId) {
  document.querySelectorAll('.actie-dropdown').forEach(el => el.remove());
  _resetUserId = userId;
  document.getElementById('reset-reden').value = '';
  document.getElementById('reset-modal').classList.remove('hidden');
}

function bevestigReset() {
  if (!_resetUserId) return;
  const reden = document.getElementById('reset-reden').value.trim();
  if (!reden) { showToast('Vul een reden in'); return; }
  const u = getUser();
  document.getElementById('reset-modal').classList.add('hidden');
  fetch(`${API_URL}/api/tijden-reset/${_resetUserId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reden, door: u.shortname || u.fullname || u.username }),
  }).then(() => { _resetUserId = null; laadTijden(); showToast('Uren gereset'); });
}
