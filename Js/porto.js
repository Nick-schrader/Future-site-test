// ---- PORTO PAGE ----
window.onload = async () => {
  await syncUserFromDB();
  
  // Initialize audio volume from user settings
  const user = getUser();
  window.audioVolume = (user.audioVolume || 30) / 100;
  
  fetch(`${API_URL}/api/instellingen-systeem`).then(r=>r.json()).then(d=>{ if(d.ping_interval) window._pingInterval = parseInt(d.ping_interval); }).catch(()=>{});
  const u = getUser();
  
  // Clear any existing timers when page loads
  clearTimeout(window._alertPingTimer);
  clearTimeout(window._pingHerhaalTimer);
  window._alertPingTimer = null;
  window._pingHerhaalTimer = null;
  
  // Add page visibility change listener to handle tab switching
  document.addEventListener('visibilitychange', () => {
    const currentUser = getUser();
    if (document.hidden && currentUser && currentUser.id) {
      // Page is hidden but user is still logged in, don't clear timers
      // This allows pings to continue while gaming
      return;
    }
    
    if (!document.hidden && currentUser && currentUser.id) {
      // Page is visible again, restart pings if needed
      // Pings will be restarted by renderMeldingen() call
      renderMeldingen();
    }
  });
  const isOvdOpco = ['ovd', 'opco', 'oc', 'ops'].includes(u.role);

  if (isOvdOpco) {
    document.getElementById('ovd-view').classList.remove('hidden');
    laadEenheden();
    renderMeldingen();
    setInterval(() => { laadEenheden(); renderMeldingen(); ovdUpdateInfo(); }, 3000);
    setInterval(renderLeaderboard, 1000);
    setInterval(checkIndeling, 3000);

    // Altijd DB checken voor status/voertuig/indienstStart
    if (u.id) {
      fetch(`${API_URL}/api/indeling/${u.id}`)
        .then(r => r.json())
        .then(data => {
          if (data.indienstStart && !u.indienstStart) u.indienstStart = data.indienstStart;
          if (!u.indienstStart) u.indienstStart = Date.now();
          if (data.status) u.status = data.status;
          if (data.voertuig) u.voertuig = data.voertuig;
          saveUser(u);
          // Toon ovd-porto-main
          const main = document.getElementById('ovd-porto-main');
          if (main) { main.style.display = ''; }
          startIndienstTimer('ovd-oc-tijd');
          ovdUpdateInfo();
          if (u.status) {
            highlightStatus(u.status);
            ['status-error','ovd-status-error'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
          }
          if (data.voertuigNaam) {
            highlightVoertuig(data.voertuig || '');
            ['voertuig-error','ovd-voertuig-error'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
          }
        }).catch(() => {
          if (!u.indienstStart) { u.indienstStart = Date.now(); saveUser(u); }
          const main = document.getElementById('ovd-porto-main');
          if (main) { main.style.display = ''; }
          startIndienstTimer('ovd-oc-tijd');
          ovdUpdateInfo();
        });
    }
  } else {
    document.getElementById('user-view').classList.remove('hidden');
    document.querySelector('.content').scrollTop = 0;
    // Laad eenheden voor leaderboard ook in user view
    laadEenheden();
    setInterval(laadEenheden, 5000);
    setInterval(updateOCInfo, 3000);
    setInterval(renderLeaderboard, 1000);

    // Verberg inloggen knoppen op basis van DC rollen
    const rollen = (u.rollen || []).map(r => r.naam || r);
    const heeftOpco = rollen.some(r => r.includes('OPCO-K'));
    const heeftOvd  = rollen.some(r => r.includes('OVD-K') || r.includes('OvD-K'));
    const heeftOc   = rollen.includes('OC');
    const heeftOps  = rollen.some(r => r.includes('OPS'));
    if (!heeftOpco) { const b = document.getElementById('btn-opco'); if (b) b.remove(); }
    if (!heeftOvd)  { const b = document.getElementById('btn-ovd');  if (b) b.remove(); }
    if (!heeftOc)   { const b = document.getElementById('btn-oc');   if (b) b.remove(); }
    if (!heeftOps)  { const b = document.getElementById('btn-ops');  if (b) b.remove(); }

    // Verberg overnemen knoppen op basis van rollen
    if (!heeftOpco) { const b = document.getElementById('btn-overname-opco'); if (b) b.remove(); }
    if (!heeftOvd)  { const b = document.getElementById('btn-overname-ovd');  if (b) b.remove(); }
    if (!heeftOps)  { const b = document.getElementById('btn-overname-ops');  if (b) b.remove(); }
    if (!heeftOpco && !heeftOvd && !heeftOc && !heeftOps) {
      const btns = document.getElementById('inloggen-btns');
      if (btns) btns.closest('.card').style.display = 'none';
    }

    // Altijd DB checken voor correcte staat
    if (!u.id) {
      document.querySelector('.porto-aanmeld-section').classList.remove('hidden');
      return;
    }
    fetch(`${API_URL}/api/indeling/${u.id}`)
      .then(r => r.json())
      .then(data => {
        if (!data.indienstStart) {
          // Niet in dienst - toon aanmeld sectie
          u.indienstStart = null;
          u.ingedeeld = false;
          u.status = null;
          u.voertuig = null;
          u.dienstnummer = '';
          saveUser(u);
          document.querySelector('.porto-aanmeld-section').classList.remove('hidden');
          // Reset scroll naar boven
          const content = document.querySelector('.content');
          if (content) content.scrollTop = 0;
          return;
        }
        document.querySelector('.porto-aanmeld-section').classList.add('hidden');
        if (data.indienstStart && !u.indienstStart) {
          u.indienstStart = data.indienstStart;
          saveUser(u);
        }
        if (data.ingedeeld) {
          u.ingedeeld = true;
          u.voertuig = data.voertuig;
          u.dienstnummer = data.roepnummer;
          saveUser(u);
          document.getElementById('porto-main').style.display = '';
          document.getElementById('porto-main').classList.remove('hidden');
          const content = document.querySelector('.content');
          if (content) content.scrollTop = 0;
          updateOCInfo();
          if (u.status) {
            highlightStatus(u.status);
            ['status-error','ovd-status-error'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
          }
          highlightVoertuig(data.voertuig || u.voertuig || '');
          ['voertuig-error','ovd-voertuig-error'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
          startIndienstTimer('oc-tijd');
        } else {
          u.ingedeeld = false;
          saveUser(u);
          document.getElementById('porto-wacht').classList.remove('hidden');
          startIndienstTimer('oc-tijd');
        }
      }).catch(() => {
        document.querySelector('.porto-aanmeld-section').classList.remove('hidden');
      });
  }
};

function laadEenheden() {
  Promise.all([
    fetch(`${API_URL}/api/eenheden`).then(r => r.json()),
    fetch(`${API_URL}/api/specialisaties`).then(r => r.json()).catch(() => []),
  ]).then(([data, specs]) => {
    window._specialisaties = specs;
    appData.eenheden = data.map(e => ({
      id: e.roepnummer || e.dienstnummer || '-',
      medewerkers: e.koppel_id
        ? `${e.shortname || e.display_name} + ${e.koppel_naam || e.koppel_display || '?'}`
        : (e.shortname || e.display_name),
      voertuig: e.voertuig_naam || '-',
      type: e.voertuig || '-',
      taak: 'Surveillance',
      status: e.status || 1,
      userId: e.id,
      koppelId: e.koppel_id || null,
      rollen: e.rollen || '[]',
      indienstStart: e.indienst_start || null,
    }));
    renderEenheden();
    renderLeaderboard();
  }).catch(() => {});
}

function renderEenheden() {
  const tbody = document.getElementById('eenheden-tbody');
  const u = getUser();
  const canEdit = ['ovd', 'opco', 'oc', 'ops'].includes(u.role);

  if (!window._groepIngeklapt) window._groepIngeklapt = {};

  const GROEPEN = ['17', '18', '20'];
  const groepen = {};
  GROEPEN.forEach(p => groepen[p] = []);
  groepen['Wachtrij'] = [];

  appData.eenheden.forEach(e => {
    if (!e.id || e.id === '-') {
      groepen['Wachtrij'].push(e);
      return;
    }
    const prefix = e.id.trim().length >= 2 ? e.id.trim().substring(0, 2) : null;
    if (prefix && groepen[prefix] !== undefined) {
      groepen[prefix].push(e);
    } else {
      if (!groepen['Overig']) groepen['Overig'] = [];
      groepen['Overig'].push(e);
    }
  });

  const labels = ['Wachtrij', ...GROEPEN, ...(groepen['Overig'] ? ['Overig'] : [])];

  let html = '';
  labels.forEach(prefix => {
    const groep = groepen[prefix] || [];
    const label = prefix === 'Overig' ? 'Overig' : prefix === 'Wachtrij' ? 'Wachtrij' : `${prefix} Nummer`;
    const ingeklapt = window._groepIngeklapt[label] || false;
    const pijl = ingeklapt ? '▶' : '▼';

    // Check min eenheden warnings voor specialisaties in deze groep
    let warnings = '';

    html += `<tr class="group-header" onclick="toggleGroep('${label}')" style="cursor:pointer">
      <td colspan="7"><span style="margin-right:6px;font-size:0.7rem">${pijl}</span>${label} <span class="badge-tag">Totaal ${groep.length}</span></td>
    </tr>`;
    if (!ingeklapt) {
      groep.forEach(e => html += eenheidRow(e));
    }
  });

  tbody.innerHTML = html;
}

function eenheidRow(e) {
  const u = getUser();
  const canEdit = ['ovd', 'opco', 'oc', 'ops'].includes(u.role);
  const click = canEdit ? `onclick="openVoertuigModal('${e.id}')"` : '';
  const tijdIndienst = e.indienstStart ? formatDuur(Date.now() - e.indienstStart) : '-';

  // Check of dit voertuig type onder min_eenheden zit
  let typeWarn = '';
  if (e.type && e.type !== '-' && window._specialisaties) {
    const spec = window._specialisaties.find(s => s.voertuig === e.type);
    if (spec && spec.min_eenheden > 0) {
      const huidig = appData.eenheden.filter(x => x.type === e.type).length;
      if (huidig < spec.min_eenheden) {
        typeWarn = ` <span style="color:#f87171" title="Te weinig eenheden: ${huidig}/${spec.min_eenheden}">⚠</span>`;
      }
    }
  }

  return `<tr ${click} style="${canEdit ? 'cursor:pointer' : ''}">
    <td>${e.id}</td><td>${e.medewerkers}</td><td>${e.voertuig}</td>
    <td>${e.type}${typeWarn}</td><td>${e.taak}</td><td>${tijdIndienst}</td><td>${statusBadge(e.status)}</td>
  </tr>`;
}

function renderLeaderboard() {
  const metTijd = appData.eenheden.filter(e => e.indienstStart);
  const gesorteerd = [...metTijd].sort((a, b) => a.indienstStart - b.indienstStart).slice(0, 10);
  const html = gesorteerd.length
    ? gesorteerd.map((e, i) => `
        <div class="oc-row">
          <span>${i + 1}. ${e.medewerkers}</span>
          <span style="color:#4ade80;font-variant-numeric:tabular-nums">${formatDuur(Date.now() - e.indienstStart)}</span>
        </div>`).join('')
    : '<div style="color:#888;font-size:0.82rem;padding:4px 0">Geen actieve eenheden</div>';

  ['leaderboard-list-ovd'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  });

  renderSpecOverzicht();
}

function renderSpecOverzicht() {
  const el = document.getElementById('spec-overzicht');
  if (!el) return;

  fetch(`${API_URL}/api/specialisaties`)
    .then(r => r.json())
    .then(specialisaties => {
      window._specialisaties = specialisaties;
      const nu = new Date();
      const nowMin = nu.getHours() * 60 + nu.getMinutes();

      const html = specialisaties
        .filter(s => s.vereiste_rol || s.tijdslot_start || s.min_eenheden > 0)
        .map(s => {
          let tijdslotActief = true;
          let tijdLabel = 'Altijd';
          if (s.tijdslot_start) {
            const [sh, sm] = s.tijdslot_start.split(':').map(Number);
            const startMin = sh * 60 + sm;
            if (s.tijdslot_eind) {
              const [eh, em] = s.tijdslot_eind.split(':').map(Number);
              const eindMin = eh * 60 + em;
              tijdslotActief = startMin > eindMin
                ? (nowMin >= startMin || nowMin < eindMin)
                : (nowMin >= startMin && nowMin < eindMin);
              tijdLabel = `${s.tijdslot_start} - ${s.tijdslot_eind}`;
            } else {
              tijdslotActief = nowMin >= startMin;
              tijdLabel = `vanaf ${s.tijdslot_start}`;
            }
          }

          // Check min eenheden - totaal in dienst, niet per voertuig type
          const totaalIndienst = appData.eenheden ? appData.eenheden.length : 0;
          const minOk = s.min_eenheden > 0 ? totaalIndienst >= s.min_eenheden : true;
          // Tijdslot alleen relevant als het voertuig een tijdslot heeft
          const tijdOk = s.tijdslot_start ? tijdslotActief : true;
          const ok = tijdOk && minOk;

          const kleur = ok ? '#4ade80' : '#f87171';
          const status = ok ? '✓' : '✗';
          const rolLabel = s.vereiste_rol ? `${s.vereiste_rol}` : '';
          const tijdLabel2 = s.tijdslot_start ? ` · ${tijdLabel}` : '';
          const minLabel = s.min_eenheden > 0 ? ` · Min ${s.min_eenheden} (${totaalIndienst})` : '';

          return `<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 0;border-bottom:1px solid #2a2a3a;gap:8px">
            <span style="color:#a78bfa;font-weight:bold;font-size:0.8rem;min-width:80px">${s.voertuig}</span>
            <span style="color:#888;font-size:0.75rem;flex:1">${rolLabel}${tijdLabel2}${minLabel}</span>
            <span style="color:${kleur};font-size:0.8rem">${status}</span>
          </div>`;
        }).join('');

      el.innerHTML = html || '<span style="color:#888">Geen specialisaties ingesteld</span>';
    }).catch(() => {});
}

function formatDuur(ms) {
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
  return `${h}:${m}`;
}

function toggleGroep(label) {
  if (!window._groepIngeklapt) window._groepIngeklapt = {};
  window._groepIngeklapt[label] = !window._groepIngeklapt[label];
  renderEenheden();
}

function dragEenheid(event, userId) {
  event.dataTransfer.setData('userId', userId);
}

function dropEenheid(event, channelId) {
  event.preventDefault();
  const userId = event.dataTransfer.getData('userId');
  if (!userId || !channelId) return;
  fetch(`${API_URL}/api/voice-move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, channelId }),
  }).then(r => r.json()).then(data => {
    if (data.success) { laadEenheden(); showToast('Eenheid verplaatst'); }
    else showToast('Verplaatsen mislukt: ' + (data.error || 'onbekend'));
  });
}

function statusBadge(s) {
  const map = {
    1: ['badge-green','1-Beschikbaar'],
    2: ['badge-blue','2-Aanrijdend'],
    3: ['badge-yellow','3-Ter Plaatse'],
    4: ['badge-green','4-Melding Afgerond'],
    5: ['badge-blue','5-Transport'],
    6: ['badge-blue','6-Spraakaanvraag'],
    7: ['badge-red','7-Spraak Urgent'],
    8: ['badge-purple','8-Incidentmelding'],
    9: ['badge-gray','9-Tijdelijk N.B.'],
    10: ['badge-gray','10-Uit Dienst'],
  };
  const [cls, label] = map[s] || ['badge-gray', s + '-Onbekend'];
  return `<span class="badge ${cls}">${label}</span>`;
}

function renderGPS() {
  const container = document.getElementById('gps-units');
  container.innerHTML = '';
  appData.eenheden.forEach(e => {
    if (e.status === 5) return;
    const dot = document.createElement('div');
    dot.className = 'gps-unit-dot';
    dot.style.left = e.x + '%';
    dot.style.top = e.y + '%';
    dot.textContent = e.id;
    container.appendChild(dot);
  });
}

let vorigeWachtrijCount = 0;

function speelAanmeldGeluid() {
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
}

function speelVoertuigGeluid() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  const volume = window.audioVolume || 0.3;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
  [660, 880].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.connect(gain);
    osc.frequency.value = freq;
    osc.type = 'sine';
    osc.start(ctx.currentTime + i * 0.15);
    osc.stop(ctx.currentTime + i * 0.15 + 0.2);
  });
}

function renderMeldingen() {
  const list = document.getElementById('meldingen-list');
  if (!list) return;

  Promise.all([
    fetch(`${API_URL}/api/wachtrij`).then(r => r.json()),
    fetch(`${API_URL}/api/status-alerts`).then(r => r.json()),
  ]).then(([wachtrij, alerts]) => {
      // Only play sound if there are MORE items than before (new addition)
      // Don't play on initial page load
      if (vorigeWachtrijCount !== null && wachtrij.length > vorigeWachtrijCount) {
        speelAanmeldGeluid();
      }
      vorigeWachtrijCount = wachtrij.length;

      // Herhaal ping na interval als er nog aanmeldingen zijn
      if (wachtrij.length > 0) {
        if (!window._pingHerhaalTimer) {
          clearTimeout(window._pingHerhaalTimer);
          const interval = (window._pingInterval || 30) * 1000;
          window._pingHerhaalTimer = setTimeout(() => speelAanmeldGeluid(), interval);
        }
      } else {
        if (window._pingHerhaalTimer) {
          clearTimeout(window._pingHerhaalTimer);
          window._pingHerhaalTimer = null;
        }
      }

      // Speel geluid bij nieuwe status 6/7 alerts
      // Don't play on initial page load
      if (window._vorigeAlerts !== null && alerts.length > window._vorigeAlerts) {
        speelAanmeldGeluid();
      }
      window._vorigeAlerts = alerts.length;

      // Herhaal ping voor status alerts
      if (alerts.length > 0) {
        if (!window._alertPingTimer) {
          const alertInterval = (window._pingInterval || 30) * 1000; // Use same interval as aanmelden
          console.log('Setting status alert ping timer for', alertInterval/1000, 'seconds');
          window._alertPingTimer = setTimeout(() => {
            console.log('Status alert ping triggered!');
            // Clear timer first to prevent race condition
            window._alertPingTimer = null;
            speelAanmeldGeluid();
            if (window._currentAlerts && window._currentAlerts.length > 0) {
              renderMeldingen(); // This will set the next timer
            }
          }, alertInterval);
        }
      } else {
        // No alerts - clear timer immediately and stop any pending callbacks
        if (window._alertPingTimer) {
          clearTimeout(window._alertPingTimer);
          window._alertPingTimer = null;
          console.log('Cleared alert ping timer - no alerts');
        }
      }
      
      window._currentAlerts = alerts;

      window._wachtrij = wachtrij;

      if (wachtrij.length === 0) {
        list.innerHTML = '<div style="color:#888;font-size:0.85rem;padding:8px">Geen aanmeldingen</div>';
        return;
      }

      list.innerHTML = wachtrij.map((w, i) => {
        let rollen = [];
        try { rollen = JSON.parse(w.rollen || '[]'); } catch {}
        const rolNamen = rollen.map(r => typeof r === 'string' ? r : (r.naam || ''));
        const heeftIbt = rolNamen.some(r => r.includes('IBT') || r.includes('ibt'));
        const specs = [];
        if (rolNamen.some(r => r.toLowerCase().includes('siv'))) specs.push('SIV');
        if (rolNamen.some(r => r.toLowerCase().includes('gpt'))) specs.push('GPT');
        if (rolNamen.some(r => r.toLowerCase().includes('motor'))) specs.push('Motor');
        if (rolNamen.some(r => r.toLowerCase().includes('boot'))) specs.push('Boot');
        if (rolNamen.some(r => r.toLowerCase().includes('zulu'))) specs.push('Zulu');
        if (rolNamen.some(r => r.toLowerCase().includes('offroad'))) specs.push('Offroad');
        return `
        <div class="melding-item melding-aanmeld">
          <div>
            <strong>&#128100; ${w.naam}</strong>
            ${!heeftIbt ? `<br/><span style="color:#f87171;font-size:0.78rem;font-weight:bold">⚠ Geen IBT</span>` : ''}
            ${specs.length ? `<br/><span style="color:#a78bfa;font-size:0.78rem">${specs.join(', ')}</span>` : ''}
            ${w.bijzonderheden ? `<br/><em style="color:#888;font-size:0.78rem">${w.bijzonderheden}</em>` : ''}
          </div>
          <button class="btn-purple small" onclick="openIndelenModal(${i})">Indelen</button>
        </div>`;
      }).join('');
    }).catch(() => {
      if (list) list.innerHTML = '<div style="color:#888;font-size:0.85rem">Kan aanmeldingen niet laden</div>';
    });
}

function dismissAlert(id) {
  fetch(`${API_URL}/api/status-alerts/${id}`, { method: 'DELETE' })
    .then(() => renderMeldingen());
}

function dismissAlert(id) {
  fetch(`${API_URL}/api/status-alerts/${id}`, { method: 'DELETE' })
    .then(() => renderMeldingen());
}

function clearMeldingen() {
  appData.meldingen = [];
  renderMeldingen();
  showToast('Alle meldingen verwijderd');
}

function slaEigenVoertuigOp() {
  const u = getUser();
  const naam = document.getElementById('eigen-voertuig-input')?.value.trim() || '';
  fetch(`${API_URL}/api/voertuig-naam`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: u.id, voertuigNaam: naam }),
  }).then(() => {
    const huidig = document.getElementById('eigen-voertuig-huidig');
    if (huidig) huidig.textContent = naam ? 'Huidig: ' + naam : '';
    const vn1 = document.getElementById('oc-voertuig-naam');
    if (vn1) vn1.textContent = naam || '-';
    showToast('Voertuig opgeslagen: ' + naam);
  });
}

function updateOCInfo() {
  const u = getUser();
  const roepnummer = document.getElementById('oc-roepnummer');
  const voertuig = document.getElementById('oc-voertuig');
  const koppel = document.getElementById('oc-koppel');
  if (roepnummer) roepnummer.textContent = u.dienstnummer || '-';
  if (voertuig) voertuig.textContent = u.voertuig || 'Niet geselecteerd';
  if (koppel) koppel.textContent = u.koppelNaam || '-';

  // Laad voertuig_naam en koppel informatie vanuit DB en vul input
  if (u.id) {
    fetch(`${API_URL}/api/indeling/${u.id}`)
      .then(r => r.json())
      .then(data => {
        const vn = document.getElementById('oc-voertuig-naam');
        const koppel = document.getElementById('oc-koppel');
        if (vn) vn.textContent = data.voertuigNaam || '-';
        if (koppel) koppel.textContent = data.koppelNaam || '-';
        // Vul eigen voertuig input
        const input = document.getElementById('eigen-voertuig-input');
        if (input && data.voertuigNaam) {
          input.value = data.voertuigNaam;
          const huidig = document.getElementById('eigen-voertuig-huidig');
          if (huidig) huidig.textContent = 'Huidig: ' + data.voertuigNaam;
        }
      }).catch(() => {});
  }

  fetch(`${API_URL}/api/dienst-rollen`)
    .then(r => r.json())
    .then(data => {
      const opco = document.getElementById('oc-opco');
      const ovd = document.getElementById('oc-ovd');
      if (opco) opco.textContent = data.opco !== '-' ? data.opco : (u.role === 'opco' ? (u.shortname || u.displayName || '-') : '-');
      if (ovd) ovd.textContent = data.ovd !== '-' ? data.ovd : (u.role === 'ovd' ? (u.shortname || u.displayName || '-') : '-');
      const btn = document.getElementById('btn-status0');
      if (btn) {
        const geenDienst = data.ovd === '-' && data.opco === '-';
        btn.style.opacity = geenDienst ? '0.5' : '1';
        btn.style.outline = geenDienst ? '2px solid #f87171' : '';
      }
    }).catch(() => {});
}

function setStatus(s) {
  if (s === 10) {
    document.getElementById('uitdienst-modal').classList.remove('hidden');
    return;
  }
  const u = getUser();
  u.status = s;
  saveUser(u);
  highlightStatus(s);
  ['status-error', 'ovd-status-error'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  // Opslaan in DB
  if (u.id) fetch(`${API_URL}/api/status`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: u.id, status: s }),
  });
  showToast('Status ' + s + ' ingesteld');
}

function latRolVallen() {
  const u = getUser();
  fetch(`${API_URL}/api/rol-laten-vallen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: u.id }),
  }).then(() => {
    u.role = 'user';
    u.ingedeeld = false; // reset zodat de indeling opnieuw gecheckt wordt na reload
    saveUser(u);
    showToast('Rol losgelaten — je blijft in dienst als eenheid');
    setTimeout(() => window.location.reload(), 800);
  });
}

function bevestigUitdienst() {
  document.getElementById('uitdienst-modal').classList.add('hidden');
  const u = getUser();

  // Reset in database
  fetch(`${API_URL}/api/reset/${u.id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ indienstStart: u.indienstStart, dcnaam: u.dcnaam || '', roepnummer: '' }),
  })
    .then(() => {
      // Reset lokale state
      u.indienstStart = null;
      u.ingedeeld = false;
      u.status = null;
      u.voertuig = null;
      u.dienstnummer = '';
      u.role = 'user';
      saveUser(u);

      showToast('Je bent uit dienst gegaan');

      setTimeout(() => window.location.reload(), 1500);
    });
}

function highlightStatus(s) {
  document.querySelectorAll('.status-btn').forEach(b => {
    // Exacte match op het statusnummer via data-status attribuut of de onclick
    const match = b.getAttribute('onclick')?.match(/setStatus\((\d+)\)/);
    if (match) b.classList.toggle('active', parseInt(match[1]) === s);
  });
}

function selectVoertuig(v) {
  const u = getUser();
  highlightVoertuig(v);
  ['voertuig-error', 'ovd-voertuig-error'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  if (document.getElementById('oc-voertuig-naam')) document.getElementById('oc-voertuig-naam').textContent = v;
  if (document.getElementById('ovd-oc-voertuig-naam')) document.getElementById('ovd-oc-voertuig-naam').textContent = v;
  if (u.id) fetch(`${API_URL}/api/voertuig-naam`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: u.id, voertuigNaam: v }),
  }).then(() => showToast('Voertuig: ' + v));
}

function highlightVoertuig(v) {
  document.querySelectorAll('.voertuig-btn').forEach(b => {
    b.classList.toggle('active', b.textContent.trim().toLowerCase() === v.toLowerCase());
  });
}

let _kandidatenRol = '';
let _kandidatenLijst = [];

function openKoppelModal() {
  const id = document.getElementById('edit-unit-id').value;
  const unit = appData.eenheden.find(e => e.id === id);
  if (!unit) return;
  closeVoertuigModal();
  document.getElementById('koppel-modal').classList.remove('hidden');

  fetch(`${API_URL}/api/koppel-kandidaten/${unit.userId}`)
    .then(r => r.json())
    .then(kandidaten => {
      const lijst = document.getElementById('koppel-lijst');
      if (kandidaten.length === 0) {
        lijst.innerHTML = '<div style="color:#888;text-align:center;padding:12px">Geen beschikbare eenheden</div>';
        return;
      }
      lijst.innerHTML = kandidaten.map(k => `
        <div style="display:flex;justify-content:space-between;align-items:center;background:#1e2130;padding:10px 14px;border-radius:6px">
          <span>${k.shortname || k.display_name} ${k.roepnummer ? '(' + k.roepnummer + ')' : ''}</span>
          <button class="btn-purple small" onclick="koppelEenheden('${unit.userId}','${k.id}','${unit.id}','${k.roepnummer || ''}')">Koppelen</button>
        </div>
      `).join('');
    });
}

let _koppelData = null;

function koppelEenheden(userId1, userId2, roep1, roep2) {
  _koppelData = { userId1, userId2, roepnummers: [roep1, roep2] };
  document.getElementById('koppel-roep-btn1').textContent = roep1 || 'Geen roepnummer';
  document.getElementById('koppel-roep-btn2').textContent = roep2 || 'Geen roepnummer';
  document.getElementById('koppel-roepnummer-sectie').style.display = 'block';
}

function bevestigKoppel(keuze) {
  if (!_koppelData) return;
  const { userId1, userId2, roepnummers } = _koppelData;
  const gekozenRoepnummer = roepnummers[keuze];
  fetch(`${API_URL}/api/koppel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId1, userId2, roepnummer: gekozenRoepnummer }),
  }).then(r => r.json()).then(data => {
    document.getElementById('koppel-modal').classList.add('hidden');
    document.getElementById('koppel-roepnummer-sectie').style.display = 'none';
    _koppelData = null;
    if (data.error) { showToast('Fout: ' + data.error); return; }
    laadEenheden();
    showToast('Eenheden gekoppeld met roepnummer ' + gekozenRoepnummer);
  });
}

function openKandidatenModal(rol) {
  _kandidatenRol = rol;
  document.getElementById('kandidaten-titel').textContent = 'Nieuwe ' + rol.toUpperCase() + ' kiezen';
  document.getElementById('kandidaten-modal').classList.remove('hidden');

  fetch(`${API_URL}/api/kandidaten/${rol}`)
    .then(r => r.json())
    .then(kandidaten => {
      _kandidatenLijst = kandidaten;
      const lijst = document.getElementById('kandidaten-lijst');
      if (kandidaten.length === 0) {
        lijst.innerHTML = '<div style="color:#888;text-align:center;padding:12px">Geen actieve kandidaten</div>';
        return;
      }
      lijst.innerHTML = kandidaten.map(k => `
        <div style="display:flex;justify-content:space-between;align-items:center;background:#1e2130;padding:10px 14px;border-radius:6px">
          <span>${k.shortname || k.display_name}</span>
          <button class="btn-purple small" onclick="kiesKandidaat('${k.id}','${rol}')">Kiezen</button>
        </div>
      `).join('');
    });
}

function radVanFortuin() {
  if (!_kandidatenLijst.length) { showToast('Geen kandidaten beschikbaar'); return; }
  const winnaar = _kandidatenLijst[Math.floor(Math.random() * _kandidatenLijst.length)];
  kiesKandidaat(winnaar.id, _kandidatenRol);
}

function kiesKandidaat(userId, rol) {
  const u = getUser();
  fetch(`${API_URL}/api/rol-toewijzen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, nieuweRol: rol, oudeRol: rol }),
  }).then(() => {
    document.getElementById('kandidaten-modal').classList.add('hidden');
    ovdUpdateInfo();
    showToast('Nieuwe ' + rol.toUpperCase() + ' ingesteld');
  });
}

function overnemen(type) {
  const u = getUser();
  u.role = type;
  saveUser(u);

  // Sync naar DB
  fetch(`${API_URL}/api/rol`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: u.id, role: type, indienstStart: u.indienstStart || Date.now(), roepnummer: u.dienstnummer, rangicoon: u.rangicoon || '' }),
  });

  showToast(type.toUpperCase() + ' overgenomen');
  setTimeout(() => window.location.reload(), 800);
}

async function aanmeldenDirect() {
  const dienstRollen = await fetch(`${API_URL}/api/dienst-rollen`).then(r=>r.json()).catch(()=>({ovd:'-',opco:'-'}));
  if (dienstRollen.ovd === '-' && dienstRollen.opco === '-') {
    showToast('Aanmelden niet mogelijk: geen OVD/OPCO actief');
    return;
  }
  const u = getUser();
  u.indienstStart = Date.now();
  saveUser(u);

  fetch(`${API_URL}/api/aanmelden`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: u.id,
      naam: u.displayName || u.username,
      bijzonderheden: document.getElementById('aanmeld-bijzonderheden').value.trim(),
      rangicoon: u.rangicoon || '',
    }),
  });

  document.querySelector('.porto-aanmeld-section').classList.add('hidden');
  document.getElementById('porto-wacht').classList.remove('hidden');
  startIndienstTimer('oc-tijd');
  showToast('Aangemeld - wacht op indeling door OVD/OPCO');
}

function inloggenDirect(type) {
  const u = getUser();
  const rollen = (u.rollen || []).map(r => r.naam || r);

  if (type === 'OVD' && !rollen.some(r => r.includes('OVD-K') || r.includes('OvD-K'))) {
    showToast('Je hebt de OVD-K rol niet'); return;
  }
  if (type === 'OPCO' && !rollen.some(r => r.includes('OPCO-K'))) {
    showToast('Je hebt de OPCO-K rol niet'); return;
  }
  if (type === 'OPS' && !rollen.some(r => r.includes('OPS'))) {
    showToast('Je hebt de OPS rol niet'); return;
  }

  // Always use specific call numbers regardless of input field
  let roep = '';
  if (type === 'OVD') roep = '17-00';
  if (type === 'OPCO') roep = '17-01';
  if (type === 'OPS') roep = document.getElementById('inloggen-roepnummer').value.trim() || '';
  
  // Update input field to show the assigned call number
  if (type === 'OVD' || type === 'OPCO') {
    document.getElementById('inloggen-roepnummer').value = roep;
  }

  u.role = type.toLowerCase();
  u.dienstnummer = roep;
  saveUser(u);

  // Sync naar DB inclusief roepnummer
  fetch(`${API_URL}/api/rol`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: u.id, role: u.role, indienstStart: u.indienstStart || Date.now(), roepnummer: roep, rangicoon: u.rangicoon || '' }),
  }).then(r => r.json()).then(data => {
    if (data.indienstStart) { u.indienstStart = data.indienstStart; saveUser(u); }
  });

  showToast('Ingelogd als ' + type + ' (' + roep + ')');
  setTimeout(() => window.location.reload(), 800);
}

function startIndienstTimer(elId) {
  const targetId = elId || 'oc-tijd';
  const u = getUser();
  if (!u.indienstStart) return;
  setInterval(() => {
    const diff = Date.now() - u.indienstStart;
    const h = String(Math.floor(diff / 3600000)).padStart(2, '0');
    const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
    const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
    const el = document.getElementById(targetId);
    if (el) el.textContent = `${h}:${m}:${s}`;
  }, 1000);
}

// ---- VOERTUIG MODAL ----
function openVoertuigModal(id) {
  const unit = appData.eenheden.find(e => e.id === id);
  if (!unit) return;
  document.getElementById('edit-unit-id').value = id;
  document.getElementById('edit-unit-naam').textContent = unit.medewerkers;
  document.getElementById('edit-roepnummer').value = unit.id !== unit.medewerkers ? unit.id : '';
  document.getElementById('edit-voertuig').value = unit.type !== '-' ? unit.type : 'Noodhulp';

  // IBT check
  let rollen = [];
  try { rollen = JSON.parse(unit.rollen || '[]'); } catch {}
  const rolNamen = rollen.map(r => typeof r === 'string' ? r : (r.naam || ''));
  const heeftIbt = rolNamen.some(r => r.includes('IBT') || r.includes('ibt'));
  document.getElementById('edit-ibt-warn').style.display = heeftIbt ? 'none' : 'block';

  // Toon koppelen of ontkoppelen knop
  const isGekoppeld = !!unit.koppelId;
  document.getElementById('koppel-btn').classList.toggle('hidden', isGekoppeld);
  document.getElementById('ontkoppel-btn').classList.toggle('hidden', !isGekoppeld);

  document.getElementById('voertuig-modal').classList.remove('hidden');
}

function setStatusVoorEenheid(status) {
  const id = document.getElementById('edit-unit-id').value;
  const unit = appData.eenheden.find(e => e.id === id);
  if (!unit) return;
  fetch(`${API_URL}/api/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: unit.userId, status }),
  }).then(() => {
    // Update lokaal zodat het direct zichtbaar is
    unit.status = status;
    closeVoertuigModal();
    renderEenheden();
    showToast(`${unit.medewerkers} → Status ${status}`);
  });
}

function ontkoppelEenheid() {
  const id = document.getElementById('edit-unit-id').value;
  const unit = appData.eenheden.find(e => e.id === id);
  if (!unit) return;
  fetch(`${API_URL}/api/ontkoppel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: unit.userId }),
  }).then(() => {
    closeVoertuigModal();
    laadEenheden();
    showToast('Eenheden ontkoppeld');
  });
}

function closeVoertuigModal() {
  document.getElementById('voertuig-modal').classList.add('hidden');
}

function saveEenheidEdit() {
  const id = document.getElementById('edit-unit-id').value;
  const unit = appData.eenheden.find(e => e.id === id);
  if (!unit) return;
  const roepnummer = document.getElementById('edit-roepnummer').value.trim();
  const voertuig = document.getElementById('edit-voertuig').value;

  fetch(`${API_URL}/api/eenheid-update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: unit.userId, roepnummer, voertuig }),
  }).then(() => {
    // Als je jezelf bewerkt, update ook lokale state
    const u = getUser();
    if (unit.userId === u.id) {
      u.voertuig = voertuig;
      if (roepnummer) u.dienstnummer = roepnummer;
      saveUser(u);
      highlightVoertuig(voertuig);
      ['voertuig-error','ovd-voertuig-error'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
      if (document.getElementById('ovd-oc-voertuig')) document.getElementById('ovd-oc-voertuig').textContent = voertuig;
    }
    closeVoertuigModal();
    laadEenheden();
    showToast(unit.medewerkers + ' bijgewerkt');
  });
}

function saveVoertuigEdit() {
  const id = document.getElementById('edit-unit-id').value;
  const unit = appData.eenheden.find(e => e.id === id);
  if (!unit) return;

  fetch(`${API_URL}/api/reset/${unit.userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ indienstStart: unit.indienstStart, dcnaam: unit.dcnaam || '', roepnummer: '' }),
  }).then(() => {
    closeVoertuigModal();
    
    // Check if current user was signed out
    const u = getUser();
    if (unit.userId === u.id) {
      // Current user was signed out, set to signed out state
      u.indienstStart = null;
      u.ingedeeld = false;
      u.status = null;
      u.voertuig = null;
      u.dienstnummer = '';
      u.role = 'user';
      saveUser(u);
      
      // Clear any active ping timers for this user
      clearTimeout(window._alertPingTimer);
      window._alertPingTimer = null;
      clearTimeout(window._pingHerhaalTimer);
      window._pingHerhaalTimer = null;
      
      location.reload();
    } else {
      // Someone else was signed out, just refresh eenheden
      laadEenheden();
      showToast(unit.medewerkers + ' is uitdienst gemeld');
    }
  });
}

function ovdAanmelden() {
  const u = getUser();
  u.indienstStart = Date.now();
  saveUser(u);
  fetch(`${API_URL}/api/aanmelden`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: u.id,
      naam: u.displayName || u.username,
      bijzonderheden: document.getElementById('ovd-bijzonderheden').value.trim(),
    }),
  });
  document.getElementById('ovd-aanmeld-section').classList.add('hidden');
  document.getElementById('ovd-porto-wacht').classList.remove('hidden');
  startIndienstTimer('ovd-oc-tijd');
  showToast('Aangemeld - wacht op indeling');
}

function ovdUpdateInfo() {
  const u = getUser();
  const naam = document.getElementById('ovd-oc-naam');
  const rol = document.getElementById('ovd-oc-rol');
  const roepnummer = document.getElementById('ovd-oc-roepnummer');
  const voertuig = document.getElementById('ovd-oc-voertuig');
  const koppel = document.getElementById('ovd-oc-koppel');
  if (naam) naam.textContent = u.shortname || u.displayName || '-';
  if (rol) rol.textContent = u.role ? u.role.toUpperCase() : '-';
  if (roepnummer) roepnummer.textContent = u.dienstnummer || '-';
  if (voertuig) voertuig.textContent = u.voertuig || 'Niet geselecteerd';
  if (koppel) koppel.textContent = u.koppelNaam || '-';

  // Laad voertuig_naam en koppel informatie vanuit DB
  if (u.id) {
    fetch(`${API_URL}/api/indeling/${u.id}`)
      .then(r => r.json())
      .then(data => {
        const vn = document.getElementById('ovd-oc-voertuig-naam');
        const koppel = document.getElementById('ovd-oc-koppel');
        if (vn) vn.textContent = data.voertuigNaam || '-';
        if (koppel) koppel.textContent = data.koppelNaam || '-';
        if (data.voertuigNaam) highlightVoertuig(data.voertuigNaam);
      }).catch(() => {});
  }

  fetch(`${API_URL}/api/dienst-rollen`)
    .then(r => r.json())
    .then(data => {
      const opco = document.getElementById('ovd-oc-opco');
      const ovd = document.getElementById('ovd-oc-ovd');
      // Als jij de OVD/OPCO bent, toon jezelf als fallback
      if (opco) opco.textContent = data.opco !== '-' ? data.opco : (u.role === 'opco' ? (u.shortname || u.displayName || '-') : '-');
      if (ovd) ovd.textContent = data.ovd !== '-' ? data.ovd : (u.role === 'ovd' ? (u.shortname || u.displayName || '-') : '-');
    }).catch(() => {
      const ovd = document.getElementById('ovd-oc-ovd');
      const opco = document.getElementById('ovd-oc-opco');
      if (ovd && u.role === 'ovd') ovd.textContent = u.shortname || u.displayName || '-';
      if (opco && u.role === 'opco') opco.textContent = u.shortname || u.displayName || '-';
    });
}
function openIndelenModal(index) {
  const w = window._wachtrij && window._wachtrij[index];
  if (!w) return;
  document.getElementById('indelen-user-id').value = w.user_id;
  document.getElementById('indelen-naam').textContent = w.naam + ' indelen';
  document.getElementById('indelen-roepnummer').value = '';

  // Toon modal alvast, IBT/specs worden bijgewerkt zodra rollen binnen zijn
  document.getElementById('indelen-ibt-warn').style.display = 'none';
  const specEl = document.getElementById('indelen-specs');
  if (specEl) specEl.textContent = '';
  document.getElementById('indelen-modal').classList.remove('hidden');

  // Haal rollen + specialisaties tegelijk op
  Promise.all([
    fetch(`${API_URL}/api/rollen/${w.user_id}`).then(r => r.json()).catch(() => {
      let rollen = [];
      try { rollen = JSON.parse(w.rollen || '[]'); } catch {}
      return rollen;
    }),
    fetch(`${API_URL}/api/specialisaties`).then(r => r.json()).catch(() => []),
  ]).then(([rollen, specialisaties]) => {
    const rolNamen = rollen.map(r => typeof r === 'string' ? r : (r.naam || ''));
    const heeftIbt = rolNamen.some(r => r.includes('IBT') || r.includes('ibt'));

    // Bouw opties op basis van vereiste_rol in specialisaties
    const opties = specialisaties
      .filter(s => {
        if (!s.vereiste_rol) return true; // geen vereiste = altijd beschikbaar (Noodhulp)
        return rolNamen.some(r => r.toLowerCase().includes(s.vereiste_rol.toLowerCase()));
      })
      .map(s => s.voertuig);

    const select = document.getElementById('indelen-voertuig');
    select.innerHTML = opties.map(o => `<option value="${o}">${o}</option>`).join('');

    const specs = opties.filter(o => o !== 'Noodhulp');
    const uniekSpecs = [...new Set(specs.map(s => s.replace(/ \d+$/, '')))];

    document.getElementById('indelen-ibt-warn').style.display = heeftIbt ? 'none' : 'block';
    if (specEl) specEl.textContent = uniekSpecs.length ? 'Specialisaties: ' + uniekSpecs.join(', ') : '';
  });
}

function saveIndeling() {
  const userId = document.getElementById('indelen-user-id').value;
  const roepnummer = document.getElementById('indelen-roepnummer').value.trim();
  const voertuig = document.getElementById('indelen-voertuig').value;
  if (!roepnummer) { showToast('Vul een roepnummer in'); return; }

  const u = getUser();
  fetch(`${API_URL}/api/indelen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, roepnummer, voertuig, ingedeeldDoor: u.displayName || u.username }),
  }).then(r => r.json()).then(data => {
    if (data.error) { showToast('⚠ ' + data.error); return; }
    document.getElementById('indelen-modal').classList.add('hidden');
    renderMeldingen();
    showToast(roepnummer + ' ingedeeld met ' + voertuig);
  });
}

// Controleer of gebruiker is ingedeeld (voor normale gebruiker)
function checkIndeling() {
  const u = getUser();
  if (!u.id) return;

  // Check of rol veranderd is (werd je OVD/OPCO gekozen?)
  if (!['ovd','opco','oc','ops'].includes(u.role)) {
    fetch(`${API_URL}/api/rol-check/${u.id}`)
      .then(r => r.json())
      .then(data => {
        if (['ovd','opco','oc','ops'].includes(data.role)) {
          u.role = data.role;
          if (data.dienstnummer) u.dienstnummer = data.dienstnummer;
          if (data.voertuig) u.voertuig = data.voertuig;
          if (data.indienstStart) u.indienstStart = data.indienstStart;
          saveUser(u);
          showToast('Je bent aangesteld als ' + data.role.toUpperCase() + '!');
          setTimeout(() => window.location.reload(), 1000);
          return;
        }
      }).catch(() => {});
  }

  if (u.ingedeeld) {
    // Check of voertuig type veranderd is door OVD
    fetch(`${API_URL}/api/indeling/${u.id}`)
      .then(r => r.json())
      .then(data => {
        if (data.voertuig && data.voertuig !== u.voertuig) {
          u.voertuig = data.voertuig;
          saveUser(u);
          speelVoertuigGeluid();
          showToast('Voertuig type gewijzigd: ' + data.voertuig);
          const isOvdOpco = ['ovd','opco','oc','ops'].includes(u.role);
          if (isOvdOpco) ovdUpdateInfo(); else updateOCInfo();
        }
      }).catch(() => {});
    return;
  }
  fetch(`${API_URL}/api/indeling/${u.id}`)
    .then(r => r.json())
    .then(data => {
      if (data.ingedeeld) {
        u.dienstnummer = data.roepnummer;
        u.voertuig = data.voertuig;
        u.ingedeeld = true;
        saveUser(u);

        const isOvdOpco = ['ovd', 'opco', 'oc', 'ops'].includes(u.role);
        const wachtId = isOvdOpco ? 'ovd-porto-wacht' : 'porto-wacht';
        const mainId = isOvdOpco ? 'ovd-porto-main' : 'porto-main';

        const wacht = document.getElementById(wachtId);
        if (wacht) wacht.classList.add('hidden');
        const main = document.getElementById(mainId);
        if (main) { main.style.display = ''; main.classList.remove('hidden'); }

        if (isOvdOpco) ovdUpdateInfo();
        else updateOCInfo();

        highlightVoertuig(data.voertuig);
        showToast('Ingedeeld! Roepnummer: ' + data.roepnummer + ' | Voertuig: ' + data.voertuig);
      }
    }).catch(() => {});
}


