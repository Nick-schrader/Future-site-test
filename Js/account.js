// ---- ACCOUNT PAGE ----
window.onload = async () => {
  if (!sessionStorage.getItem('loggedIn')) { window.location.href = '../index.html'; return; }
  await syncUserFromDB();
  const u = getUser();

  // Vul info card
  document.getElementById('info-username').textContent = u.username || '-';
  document.getElementById('info-id').textContent = u.id || '-';
  document.getElementById('info-dienst').textContent = u.dienst || '-';

  // Avatar
  if (u.avatar) {
    document.querySelectorAll('.avatar img').forEach(img => img.src = u.avatar);
  }

  // Vul instellingen
  document.getElementById('set-fullname').value = u.fullname || '';
  document.getElementById('set-shortname').value = u.shortname || '';
  document.getElementById('set-dcnaam').value = u.dcnaam || '';
  document.getElementById('set-rangicoon').value = u.rangicoon || '';
  renderTrainingen();
  renderDiscordRollen(u.rollen || []);
  renderTijden();

  // Haal altijd verse rollen op van bot
  laadDiscordRollen().then(() => {
    const vers = getUser();
    renderDiscordRollen(vers.rollen || []);
  });
};

function saveAccount() {
  const u = getUser();
  u.fullname   = document.getElementById('set-fullname').value;
  u.shortname  = document.getElementById('set-shortname').value;
  u.dcnaam     = document.getElementById('set-dcnaam').value;
  u.rangicoon  = document.getElementById('set-rangicoon').value;
  saveUser(u);

  // Sla ook op in database
  if (u.id) {
    fetch(`${API_URL}/api/instellingen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(u),
    });
  }

  showToast('Account geüpdatet');
}

function renderTrainingen() {
  const grid = document.getElementById('trainingen-grid');
  if (!grid) return;
  grid.innerHTML = appData.trainingen.map(t =>
    `<div class="training-item">
      <div class="dot ${t.actief ? 'dot-green' : 'dot-red'}"></div>
      <span>${t.naam}</span>
    </div>`).join('');
}

function renderDiscordRollen(userRollen) {
  const rollen = (userRollen && userRollen.length > 0)
    ? userRollen
    : appData.discordRollen;

  document.getElementById('discord-rollen-grid').innerHTML = rollen.map(r => {
    const naam = typeof r === 'string' ? r : (r.naam || r.name || '?');
    const kleur = r.kleur || r.color || '#4b5563';
    return `<div style="
      display:inline-flex;align-items:center;gap:6px;
      background:${kleur}22;
      border:1px solid ${kleur}66;
      border-radius:4px;
      padding:3px 10px 3px 7px;
      font-size:0.8rem;color:#e5e7eb;
    ">
      <span style="width:10px;height:10px;border-radius:50%;background:${kleur};flex-shrink:0;display:inline-block"></span>
      ${naam}
    </div>`;
  }).join('');
}

function renderTijden() {
  const u = getUser();
  if (!u.id) return;

  fetch(`${API_URL}/api/tijden/${u.id}`)
    .then(r => r.json())
    .then(data => {
      ['porto', 'opco', 'ovd', 'oc'].forEach(cat => {
        const tbody = document.getElementById('tijden-' + cat);
        if (!tbody) return;
        if (!data[cat] || data[cat].length === 0) {
          tbody.innerHTML = '<tr><td colspan="2" style="color:#555">Geen data</td></tr>';
        } else {
          tbody.innerHTML = data[cat].map(t => `<tr><td>${t.week}</td><td>${t.uren}</td></tr>`).join('');
        }
      });
    })
    .catch(() => {
      ['porto', 'opco', 'ovd', 'oc'].forEach(cat => {
        const tbody = document.getElementById('tijden-' + cat);
        if (tbody) tbody.innerHTML = '<tr><td colspan="2" style="color:#555">Geen data</td></tr>';
      });
    });
}
