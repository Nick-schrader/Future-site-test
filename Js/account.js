// ---- ACCOUNT PAGE ----
window.onload = async () => {
  if (!localStorage.getItem('loggedIn')) { window.location.href = '../index.html'; return; }
  await syncUserFromDB();
  const u = getUser();

  // Vul info card
  document.getElementById('info-username').textContent = u.username || '-';
  document.getElementById('info-id').textContent = u.id || '-';
  document.getElementById('info-dienst').textContent = 'Defensie';
  
  // Roepnummer ophalen uit personeel data
  if (u.id) {
    console.log('[ACCOUNT] Zoek roepnummer voor Discord ID:', u.id);
    fetch('/api/roepnummer/bestand')
      .then(response => response.json())
      .then(data => {
        console.log('[ACCOUNT] Personeel data ontvangen:', data.personeel);
        const personeel = data.personeel?.find(p => p.discord_id === u.id || p.discordId === u.id);
        console.log('[ACCOUNT] Gevonden personeel:', personeel);
        
        if (personeel && personeel.roepnummer) {
          console.log('[ACCOUNT] Roepnummer gevonden:', personeel.roepnummer);
          const roepnummerElement = document.getElementById('info-roepnummer-val');
          const roepnummerField = document.getElementById('info-roepnummer');
          
          if (roepnummerElement && roepnummerField) {
            roepnummerElement.textContent = personeel.roepnummer;
            roepnummerField.setAttribute('data-roepnummer', personeel.roepnummer);
          }
        } else {
          console.log('[ACCOUNT] Geen roepnummer gevonden voor deze gebruiker');
        }
      })
      .catch(error => console.error('Fout bij ophalen roepnummer:', error));
  }

  // Avatar
  if (u.avatar) {
    document.querySelectorAll('.avatar img').forEach(img => img.src = u.avatar);
  }

  // Vul instellingen
  document.getElementById('set-fullname').value = u.fullname || '';
  document.getElementById('set-rangicoon').value = u.rangicoon || '';
  
  // Audio volume slider
  const volumeSlider = document.getElementById('audio-volume');
  const volumeValue = document.getElementById('audio-volume-value');
  const savedVolume = u.audioVolume || 30;
  volumeSlider.value = savedVolume;
  volumeValue.textContent = savedVolume + '%';
  
  // Update audio volume when slider changes
  volumeSlider.addEventListener('input', (e) => {
    const volume = e.target.value;
    volumeValue.textContent = volume + '%';
    // Apply volume to all audio contexts
    updateAudioVolume(volume);
  });
  
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
  u.rangicoon  = document.getElementById('set-rangicoon').value;
  u.audioVolume = document.getElementById('audio-volume').value;
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

function updateAudioVolume(volume) {
  // Store volume globally for audio functions
  window.audioVolume = volume / 100;
  
  // Update user object
  const u = getUser();
  u.audioVolume = volume;
  saveUser(u);
}

function testAudioVolume() {
  // Use the same sound function as pings
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = 880;
  osc.type = 'sine';
  const volume = window.audioVolume || 0.3;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.5);
  
  showToast('Test geluid afgespeeld');
}

function renderTrainingen() {
  const grid = document.getElementById('trainingen-grid');
  if (!grid) return;
  grid.innerHTML = (window.appData || {}).trainingen?.map(t => `
    <div class="training-item">
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
          tbody.innerHTML = '<tr><td colspan="3" style="color:#555">Geen data</td></tr>';
        } else {
          tbody.innerHTML = data[cat].map(t => `
            <tr>
              <td>${t.week}</td>
              <td>${t.uren}</td>
              <td style="text-align:right">
                <!-- Delete button removed -->
              </td>
            </tr>
          `).join('');
        }
      });
    })
    .catch(() => {
      ['porto', 'opco', 'ovd', 'oc'].forEach(cat => {
        const tbody = document.getElementById('tijden-' + cat);
        if (tbody) tbody.innerHTML = '<tr><td colspan="3" style="color:#555">Geen data</td></tr>';
      });
    });
}

function verwijderTijd(categorie, week) {
  const u = getUser();
  if (!u.id) return;
  
  if (!confirm(`Weet je zeker dat je de tijd van week ${week} (${categorie}) wilt verwijderen?`)) return;
  
  fetch(`${API_URL}/api/tijden/${u.id}/${categorie}/${week}`, { method: 'DELETE' })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        showToast('Tijd verwijderd');
        renderTijden(); // Refresh de lijst
      } else {
        showToast('Fout bij verwijderen', 'error');
      }
    })
    .catch(err => {
      console.error('Fout bij verwijderen:', err);
      showToast('Fout bij verwijderen', 'error');
    });
}
