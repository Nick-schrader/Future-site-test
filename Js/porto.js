// ---- PORTO PAGE ----

// Helper functions to clear specific ping timers
function clearWachtrijTimer() {
  if (window._pingHerhaalTimer) {
    clearInterval(window._pingHerhaalTimer);
    window._pingHerhaalTimer = null;
  }
}

function clearAlertTimer() {
  if (window._alertPingTimer) {
    clearInterval(window._alertPingTimer);
    window._alertPingTimer = null;
  }
}

// Helper function to clear all ping timers
function clearPingTimers() {
  clearWachtrijTimer();
  clearAlertTimer();
}

window.onload = async () => {
  await syncUserFromDB();
  
  // Initialize audio volume from user settings
  const user = getUser();
  window.audioVolume = (user.audioVolume || 30) / 100;
  
  fetch(`${API_URL}/api/instellingen-systeem`).then(r=>r.json()).then(d=>{ if(d.ping_interval) window._pingInterval = parseInt(d.ping_interval); }).catch(()=>{});
  const u = getUser();
  
  // DEBUG: Show user state after sync
  console.log('🔍 POST-SYNC USER STATE:');
  console.log('User:', u);
  console.log('indienstStart:', u.indienstStart);
  console.log('ingedeeld:', u.ingedeeld);
  console.log('role:', u.role);
  console.log('status:', u.status);
  
  // Clear any existing timers when page loads
  clearPingTimers();
  
  // Reset alert state to prevent phantom pings
  window._vorigeAlerts = null;
  window._currentAlerts = null;
  
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

  // Add page unload listener to clear all timers
  window.addEventListener('beforeunload', () => {
    clearPingTimers();
  });
  const role = (u.role || '').toLowerCase();
  const isAdmin = role === 'admin';
  const isOvdOpco = ['ovd', 'opco', 'oc', 'ops', 'admin'].includes(role);

  // DEBUG: Show screen selection logic
  console.log('🔍 SCREEN SELECTION:');
  console.log('Role:', role);
  console.log('isOvdOpco:', isOvdOpco);
  console.log('isAdmin:', isAdmin);
  console.log('indienstStart:', u.indienstStart);
  console.log('ingedeeld:', u.ingedeeld);

  if (isOvdOpco) {
    console.log('🔍 SHOWING OVD VIEW');
    
    // Check en corrigeer roepnummer voor OVD/OPCO bij pagina load
    if (role === 'ovd' && u.dienstnummer !== '17-00') {
      console.log('🔍 AUTO OVD ROEPNUMMER CORRECTIE - Oud:', u.dienstnummer, '→ Nieuw: 17-00');
      u.dienstnummer = '17-00';
      saveUser(u);
      
      // Sync naar backend
      fetch(`${API_URL}/api/rol`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: u.id, role: u.role, indienstStart: u.indienstStart || Date.now(), roepnummer: '17-00', rangicoon: u.rangicoon || '' }),
      });
    }
    if (role === 'opco' && u.dienstnummer !== '17-01') {
      console.log('🔍 AUTO OPCO ROEPNUMMER CORRECTIE - Oud:', u.dienstnummer, '→ Nieuw: 17-01');
      u.dienstnummer = '17-01';
      saveUser(u);
      
      // Sync naar backend
      fetch(`${API_URL}/api/rol`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: u.id, role: u.role, indienstStart: u.indienstStart || Date.now(), roepnummer: '17-01', rangicoon: u.rangicoon || '' }),
      });
    }
    
    document.getElementById('ovd-view').classList.remove('hidden');
    laadEenheden();
    renderMeldingen();
    setInterval(() => { laadEenheden(); renderMeldingen(); ovdUpdateInfo(); }, 3000);
    setInterval(renderLeaderboard, 1000);

    // Altijd DB checken voor status/voertuig/indienstStart
    if (u.id) {
      fetch(`${API_URL}/api/indeling/${u.id}`)
        .then(r => r.json())
        .then(data => {
          console.log('🔍 INDELING DATA:', data);
          console.log('🔍 data.ingedeeld:', data.ingedeeld);
          console.log('🔍 u.ingedeeld before:', u.ingedeeld);
          
          if (data.indienstStart && !u.indienstStart) u.indienstStart = data.indienstStart;
          // NIET automatisch indienstStart zetten - alleen als database dit heeft
          if (data.status) u.status = data.status;
          if (data.voertuig) u.voertuig = data.voertuig;
          if (data.ingedeeld !== undefined) {
            u.ingedeeld = data.ingedeeld;
            console.log('🔍 u.ingedeeld after update:', u.ingedeeld);
          }
          
          // Als niet ingedeeld, reset rol naar user
          if (!data.ingedeeld && ['ovd','opco','oc','ops'].includes(u.role)) {
            console.log('🔄 NIET INGEDEELD - Rol reset van', u.role, 'naar user');
            u.role = 'user';
          }
          
          saveUser(u);
          console.log('🔍 After saveUser - u.ingedeeld:', u.ingedeeld);
          
          // Alleen ovd-porto-main tonen als echt ingedeeld
          if (data.ingedeeld) {
            console.log('🔍 SHOWING ovd-porto-main because data.ingedeeld is true');
            const main = document.getElementById('ovd-porto-main');
            if (main) { main.style.display = ''; }
            startIndienstTimer('ovd-oc-tijd');
            ovdUpdateInfo();
          } else {
            console.log('🔍 USER NIET INGEDEELD - Porto menu niet tonen, rol reset naar user');
            // Refresh om correcte scherm te tonen
            setTimeout(() => window.location.reload(), 1);
          }
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
    const heeftOpco = rollen.some(r => r.includes('OPCO'));
    const heeftOvd  = rollen.some(r => r.includes('OVD') || r.includes('OvD'));
    const heeftOc   = rollen.includes('OC');
    const heeftOps  = rollen.some(r => r.includes('OPS'));
    if (!heeftOpco && !isAdmin) { const b = document.getElementById('btn-opco'); if (b) b.remove(); }
    if (!heeftOvd && !isAdmin)  { const b = document.getElementById('btn-ovd');  if (b) b.remove(); }
    if (!heeftOc && !isAdmin)   { const b = document.getElementById('btn-oc');   if (b) b.remove(); }
    if (!heeftOps && !isAdmin)  { const b = document.getElementById('btn-ops');  if (b) b.remove(); }

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

  // Haal specialisaties op basis van rollen
  let specialisatie = '';
  if (e.rollen) {
    let rollen = [];
    try { rollen = JSON.parse(e.rollen || '[]'); } catch {}
    const rolNamen = rollen.map(r => typeof r === 'string' ? r : (r.naam || ''));
    
    const specs = [];
    if (rolNamen.some(r => r.toLowerCase().includes('siv'))) specs.push('SIV');
    if (rolNamen.some(r => r.toLowerCase().includes('gpt'))) specs.push('GPT');
    if (rolNamen.some(r => r.toLowerCase().includes('motor'))) specs.push('Motor');
    if (rolNamen.some(r => r.toLowerCase().includes('boot'))) specs.push('Boot');
    if (rolNamen.some(r => r.toLowerCase().includes('zulu'))) specs.push('Zulu');
    if (rolNamen.some(r => r.toLowerCase().includes('offroad'))) specs.push('Offroad');
    
    specialisatie = specs.length ? specs.join(', ') : '-';
  } else {
    specialisatie = '-';
  }

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
    <td>${e.id}</td><td>${e.medewerkers}</td><td>${specialisatie}</td><td>${e.voertuig}</td>
    <td>${e.type}${typeWarn}</td><td>${tijdIndienst}</td><td>${statusBadge(e.status)}</td>
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
          const tijdLabel2 = s.tijdslot_start ? `  ${tijdLabel}` : '';
          const minLabel = s.min_eenheden > 0 ? `  Min ${s.min_eenheden} (${totaalIndienst})` : '';

          return `<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 0;border-bottom:1px solid #2a2a3a;gap:8px">
            <span style="color:#a78bfa;font-weight:bold;font-size:0.8rem;min-width:80px">${s.voertuig}</span>
            <span style="color:#888;font-size:0.75rem;flex:1">${tijdLabel2}${minLabel}</span>
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

function speelAanmeldGeluid(debugInfo = '') {
  // Only play ping for OVD/OPCO/OPS users
  const u = getUser();
  const canHearPings = u && ['ovd','opco','oc','ops'].includes(u.role);
  
  if (!canHearPings) {
    console.log('🔇 PING GEBLOKEERD - User role:', u?.role, 'can hear pings:', canHearPings);
    console.log('🔇 Debug info:', debugInfo);
    return;
  }
  
  console.log('🔊 PING SPELEN - Debug info:', debugInfo);
  console.log('🔊 Current alerts:', window._currentAlerts);
  console.log('🔊 Wachtrij:', window._wachtrij);
  console.log('🔊 Timers active:', {
    alertPingTimer: !!window._alertPingTimer,
    pingHerhaalTimer: !!window._pingHerhaalTimer
  });
  
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
      // Update _currentAlerts to only include relevant alerts (status 6 or 7)
      window._currentAlerts = alerts.filter(alert => {
        const status = alert.status;
        const statusNum = parseInt(status);
        return !isNaN(statusNum) && [6, 7].includes(statusNum);
      });

      // Alleen geluid bij nieuwe alerts
      if (window._vorigeAlerts !== null && window._currentAlerts.length > window._vorigeAlerts) {
        speelAanmeldGeluid('Nieuwe alert detected - vorige: ' + window._vorigeAlerts + ' -> huidige: ' + window._currentAlerts.length);
      }

      vorigeWachtrijCount = wachtrij.length;

      // ---- Wachtrij Ping ----
      if (wachtrij.length > 0) {
        // Play immediate ping for new wachtrij items
        if (window._vorigeWachtrijCount === 0 || wachtrij.length > window._vorigeWachtrijCount) {
          speelAanmeldGeluid('Direct wachtrij ping - new items: ' + wachtrij.length);
        }
        
        if (!window._pingHerhaalTimer) {
          const interval = (window._pingInterval || 30) * 1000;

          window._pingHerhaalTimer = setInterval(() => {
            if (!window._wachtrij || window._wachtrij.length === 0) {
              clearInterval(window._pingHerhaalTimer);
              window._pingHerhaalTimer = null;
              return;
            }

            speelAanmeldGeluid('Wachtrij interval ping');
          }, interval);
        }
      } else {
        clearWachtrijTimer();
      }

      // ---- Status Alert Ping (alleen voor status 6,7) ----
      // _currentAlerts is al gefilterd op status 6/7, dus we hoeven alleen te checken of er alerts zijn
      if (window._currentAlerts.length > 0) {
        if (!window._alertPingTimer) {
          const alertInterval = (window._pingInterval || 30) * 1000;

          window._alertPingTimer = setInterval(() => {
            // Check if we have any alerts to process
            if (!window._currentAlerts || window._currentAlerts.length === 0) {
              clearInterval(window._alertPingTimer);
              window._alertPingTimer = null;
              console.log('No alerts - timer stopped');
              return;
            }

            // Always play ping for current alerts (they're already filtered to 6/7)
            speelAanmeldGeluid('Status alert interval ping - active alerts: ' + window._currentAlerts.length);
            
            // Optional: Check if alerts still exist in database and cleanup if needed
            Promise.all([
              fetch(`${API_URL}/api/status-alerts`).then(r => r.json())
            ]).then(([currentAlerts]) => {
              const validAlerts = window._currentAlerts.filter(alert => {
                // Check if alert still exists in database
                const stillExists = currentAlerts.some(currAlert => currAlert.id === alert.id);
                return stillExists;
              });

              // Update _currentAlerts to remove deleted ones
              if (validAlerts.length !== window._currentAlerts.length) {
                window._currentAlerts = validAlerts;
                console.log('Cleaned up deleted alerts - remaining:', validAlerts.length);
              }

              // Stop timer if no alerts remain
              if (validAlerts.length === 0) {
                clearInterval(window._alertPingTimer);
                window._alertPingTimer = null;
                console.log('All alerts cleared - timer stopped');
              }
            }).catch(() => {
              // API check failed - continue with current alerts
              console.warn('API check failed - continuing with current alerts');
            });
          }, alertInterval);
        }
      } else {
        clearAlertTimer();
      }

      window._vorigeAlerts = window._currentAlerts.length;
      window._wachtrij = wachtrij;
      window._vorigeWachtrijCount = wachtrij.length; // Store previous count

      // ---- UI Render ----
      if (wachtrij.length === 0) {
        list.innerHTML = '<div style="color:#888;font-size:0.85rem;padding:8px">Geen aanmeldingen</div>';
        return;
      }

      list.innerHTML = wachtrij.map((w, i) => {

        let rollen = [];
        try { rollen = JSON.parse(w.rollen || '[]'); } catch {}

        const rolNamen = rollen.map(r => typeof r === 'string' ? r : (r.naam || ''));

        const heeftIbt = rolNamen.some(r => 
          r.includes('IBT') || r.includes('ibt')
        );

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
    if (list) {
      list.innerHTML = '<div style="color:#888;font-size:0.85rem">Kan aanmeldingen niet laden</div>';
    }
  });
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

// Debug function to clear all alerts
function clearAllAlerts() {
  fetch(`${API_URL}/api/status-alerts`, { method: 'GET' })
    .then(r => r.json())
    .then(alerts => {
      console.log('Clearing all alerts:', alerts);
      // Clear each alert individually
      alerts.forEach(alert => {
        fetch(`${API_URL}/api/status-alerts/${alert.id}`, { method: 'DELETE' })
          .catch(err => console.error('Failed to clear alert', alert.id, err));
      });
      showToast('Cleared all alerts - check console');
    })
    .catch(err => console.error('Failed to fetch alerts', err));
}

// Debug function to show alert details
function showAlertDetails() {
  fetch(`${API_URL}/api/status-alerts`, { method: 'GET' })
    .then(r => r.json())
    .then(alerts => {
      console.log('=== ALERT DETAILS ===');
      console.log('Total alerts:', alerts.length);
      alerts.forEach((alert, i) => {
        console.log(`Alert ${i+1}:`, {
          id: alert.id,
          userId: alert.userId,
          status: alert.status,
          name: alert.name,
          timestamp: alert.timestamp
        });
      });
    })
    .catch(err => console.error('Failed to fetch alerts', err));
}

// Debug function to check current ping state
function checkPingState() {
  console.log('=== PING STATE DEBUG ===');
  console.log('Current alerts:', window._currentAlerts);
  console.log('Wachtrij:', window._wachtrij);
  console.log('Vorige alerts count:', window._vorigeAlerts);
  console.log('Timers active:', {
    alertPingTimer: !!window._alertPingTimer,
    pingHerhaalTimer: !!window._pingHerhaalTimer
  });
  
  // Check current API state
  Promise.all([
    fetch(`${API_URL}/api/status-alerts`).then(r => r.json()),
    fetch(`${API_URL}/api/wachtrij`).then(r => r.json())
  ]).then(([alerts, wachtrij]) => {
    console.log('API Alerts:', alerts.length, alerts);
    console.log('API Wachtrij:', wachtrij.length, wachtrij);
  }).catch(err => console.error('API check failed', err));
}

// Function to force cleanup of invalid alerts
function cleanupAlerts() {
  fetch(`${API_URL}/api/status-alerts`)
    .then(r => r.json())
    .then(alerts => {
      const validAlerts = alerts.filter(alert => {
        const status = alert.status;
        const statusNum = parseInt(status);
        return !isNaN(statusNum) && [6, 7].includes(statusNum);
      });
      
      console.log('Before cleanup:', window._currentAlerts?.length || 0, 'alerts');
      window._currentAlerts = validAlerts;
      console.log('After cleanup:', window._currentAlerts.length, 'alerts');
      
      // Stop timer if no valid alerts remain
      if (window._currentAlerts.length === 0 && window._alertPingTimer) {
        clearInterval(window._alertPingTimer);
        window._alertPingTimer = null;
        console.log('Timer stopped - no valid alerts');
      }
    })
    .catch(err => console.error('Cleanup failed', err));
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
        
        // Update status van gebruiker
        if (data.status !== undefined) {
          u.status = data.status;
          saveUser(u);
          highlightStatus(data.status);
        }
        
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
  console.log('🔄 STATUS CHANGE - User setting status to:', s);
  console.log('🔄 Before change - Current alerts:', window._currentAlerts?.length || 0);
  
  if (s === 10) {
    document.getElementById('uitdienst-modal').classList.remove('hidden');
    return;
  }
  const u = getUser();
  const previousStatus = u.status; // Store previous status
  u.status = s;
  saveUser(u);
  highlightStatus(s);
  ['status-error', 'ovd-status-error'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  
  // Only cleanup alerts if moving AWAY from status 6/7
  const isLeavingUrgentStatus = [6, 7].includes(previousStatus) && ![6, 7].includes(s);
  console.log('🔄 Is leaving urgent status (6/7):', isLeavingUrgentStatus, 'from:', previousStatus, 'to:', s);
  
  // Opslaan in DB
  if (u.id) fetch(`${API_URL}/api/status`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: u.id, status: s }),
  }).then(() => {
    if (!isLeavingUrgentStatus) {
      console.log('🔄 Not leaving urgent status - no cleanup needed');
      return;
    }
    
    console.log('🔄 Status saved to DB - Now cleaning up alerts...');
    // CRITICAL FIX: Remove any existing status alerts for this user when status changes
    return fetch(`${API_URL}/api/status-alerts`).then(r => r.json());
  }).then(alerts => {
    if (!alerts) return; // Skip if no cleanup needed
    
    console.log('🔄 Found alerts in DB:', alerts.length);
    console.log('🔄 Current user ID:', u.id);
    console.log('🔄 All alerts with user IDs:', alerts.map(a => ({id: a.id, userId: a.userId, status: a.status})));
    
    // Remove alerts for this user that are no longer valid
    const userAlerts = alerts.filter(alert => {
      const alertUserId = alert.userId || alert.user_id; // Check both properties
      return alertUserId === u.id;
    });
    console.log('🔄 User alerts to remove:', userAlerts.length);
    
    userAlerts.forEach(alert => {
      console.log('🔄 Removing alert:', alert.id, 'status:', alert.status, 'userId:', alert.userId, 'user_id:', alert.user_id);
      fetch(`${API_URL}/api/status-alerts/${alert.id}`, { method: 'DELETE' })
        .catch(err => console.error('Failed to remove alert', alert.id, err));
    });
    
    // Update local _currentAlerts to remove deleted ones
    const beforeCount = window._currentAlerts?.length || 0;
    window._currentAlerts = window._currentAlerts?.filter(alert => {
      const alertUserId = alert.userId || alert.user_id;
      return alertUserId !== u.id;
    }) || [];
    const afterCount = window._currentAlerts?.length || 0;
    
    console.log('🔄 LOCAL CLEANUP - Before:', beforeCount, 'After:', afterCount);
    console.log('🔄 Timer should stop if no alerts remain:', afterCount === 0);
    
    // Wait a moment for database to update, then refresh meldingen
    setTimeout(() => {
      renderMeldingen();
    }, 500);
  }).catch(err => console.error('Status update failed', err));
  
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

  // Eerst rol resetten in database
  console.log('🔄 UITDIENST - Rol resetten van', u.role, 'naar user');
  fetch(`${API_URL}/api/rol-laten-vallen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: u.id }),
  }).then(() => {
    // Reset in database
    fetch(`${API_URL}/api/reset/${u.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ indienstStart: null, dcnaam: u.dcnaam || '', roepnummer: '' }),
    })
      .then(() => {
        // Reset lokale state
        console.log('🔄 UITDIENST - Lokale state resetten');
        u.indienstStart = null;
        u.ingedeeld = false;
        u.status = null;
        u.voertuig = null;
        u.dienstnummer = '';
        u.role = 'user'; // Forceer rol naar user
        saveUser(u);

        // Cleanup: Remove user from wachtrij when going uitdienst
        console.log('🧹 UITDIENST - User verwijderen uit wachtrij:', u.naam);
        fetch(`${API_URL}/api/wachtrij`)
          .then(r => r.json())
          .then(wachtrij => {
            const userInWachtrij = wachtrij.find(w => w.userId === u.id || w.naam === u.naam);
            if (userInWachtrij) {
              console.log('🧹 USER GEVONDEN IN WACHTRIJ - Verwijderen:', userInWachtrij.naam, 'ID:', userInWachtrij.id);
              fetch(`${API_URL}/api/wachtrij/${userInWachtrij.id}`, { method: 'DELETE' })
                .then(() => {
                  console.log('🧹 SUCCES - User verwijderd uit wachtrij bij uitdienst');
                })
                .catch(err => console.error('Failed to remove user from wachtrij', err));
            }
          })
          .catch(err => console.error('Failed to check wachtrij', err));

        showToast('Je bent uit dienst gegaan');

        // Directe refresh na uitdienst melden
        window.location.reload();
      });
  }).catch(err => console.error('Failed to reset role before uitdienst', err));
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
  }).then(() => {
    // Toon specialisaties voor geselecteerde voertuig
    fetch(`${API_URL}/api/specialisaties`).then(r => r.json()).then(specialisaties => {
      const specs = specialisaties.filter(s => s.voertuig === v);
      const uniekSpecs = [...new Set(specs.map(s => s.specialisatie))];
      
      // Update specialisaties display
      const specDisplay = document.getElementById('oc-voertuig-specs');
      const ovdSpecDisplay = document.getElementById('ovd-oc-voertuig-specs');
      
      if (specDisplay) {
        specDisplay.textContent = uniekSpecs.length ? 'Specialisaties: ' + uniekSpecs.join(', ') : '';
        specDisplay.style.display = uniekSpecs.length ? 'block' : 'none';
      }
      if (ovdSpecDisplay) {
        ovdSpecDisplay.textContent = uniekSpecs.length ? 'Specialisaties: ' + uniekSpecs.join(', ') : '';
        ovdSpecDisplay.style.display = uniekSpecs.length ? 'block' : 'none';
      }
    });
    
    showToast('Voertuig: ' + v);
  });
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
  
  // Toon duidelijke keuze interface
  const modal = document.getElementById('koppel-modal');
  const keuzeSectie = modal.querySelector('.modal-body') || modal.querySelector('div');
  
  keuzeSectie.innerHTML = `
    <h3 style="margin-bottom:16px">Kies een persoon om te koppelen</h3>
    <div style="display:flex;flex-direction:column;gap:12px">
      <button class="btn-purple" style="padding:12px;font-size:1rem" onclick="bevestigKoppel(0)">
        <div style="font-weight:bold">${roep1 || 'Persoon 1'}</div>
        <div style="font-size:0.8rem;opacity:0.8">Roepnummer: ${roep1 || 'Geen'}</div>
      </button>
      <button class="btn-purple" style="padding:12px;font-size:1rem" onclick="bevestigKoppel(1)">
        <div style="font-weight:bold">${roep2 || 'Persoon 2'}</div>
        <div style="font-size:0.8rem;opacity:0.8">Roepnummer: ${roep2 || 'Geen'}</div>
      </button>
    </div>
  `;
  
  document.getElementById('koppel-modal').classList.remove('hidden');
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

function kiesKandidaat(userId, rol) {
  const u = getUser();
  
  // Bepaal de roepnummers
  const nieuwOvdRoepnummer = rol === 'ovd' ? '17-00' : 
                            rol === 'opco' ? '17-01' : '';
  const mijnHuidigeRoepnummer = u.dienstnummer || '';
  
  console.log('🔍 KIES KANDIDAAT - Rol:', rol);
  console.log('🔍 KIES KANDIDAAT - Gekozen userId:', userId);
  console.log('🔍 KIES KANDIDAAT - Nieuw OVD roepnummer:', nieuwOvdRoepnummer);
  console.log('🔍 KIES KANDIDAAT - Mijn huidige roepnummer:', mijnHuidigeRoepnummer);
  
  // Update de backend: gekozen persoon krijgt OVD nummer, ik behoud mijn roepnummer
  fetch(`${API_URL}/api/rol-toewijzen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      userId, 
      nieuweRol: rol, 
      oudeRol: rol, 
      roepnummer: nieuwOvdRoepnummer,  // Gekozen persoon krijgt OVD nummer
      vorigeRoepnummer: mijnHuidigeRoepnummer  // Ik behoud mijn roepnummer
    }),
  }).then(() => {
    // Update mijn eigen rol naar normale gebruiker
    u.role = 'user';  // of null, afhankelijk van wat je wilt
    saveUser(u);
    
    document.getElementById('kandidaten-modal').classList.add('hidden');
    showToast('Nieuwe ' + rol.toUpperCase() + ' ingesteld met roepnummer ' + nieuwOvdRoepnummer);
    
    // Refresh pagina om changes te zien
    setTimeout(() => window.location.reload(), 1000);
  }).catch(error => {
    console.error('🔍 KIES KANDIDAAT ERROR:', error);
    showToast('Fout bij toewijzen nieuwe ' + rol.toUpperCase());
  });
}

function overnemen(type) {
  const u = getUser();
  u.role = type;
  saveUser(u);

  // Stuur het juiste roepnummer mee naar de backend
  const roepnummer = type === 'ovd' ? '17-00' : 
                   type === 'opco' ? '17-01' : u.dienstnummer;

  // Sync naar DB
  fetch(`${API_URL}/api/rol`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: u.id, role: type, indienstStart: u.indienstStart || Date.now(), roepnummer, rangicoon: u.rangicoon || '' }),
  });

  showToast(type.toUpperCase() + ' overgenomen');
  setTimeout(() => window.location.reload(), 800);
}

let wachtrijInterval = null;

async function aanmeldenDirect() {
  const dienstRollen = await fetch(`${API_URL}/api/dienst-rollen`)
    .then(r => r.json())
    .catch(() => ({ ovd:'-', opco:'-' }));
  
  if (dienstRollen.ovd === '-' && dienstRollen.opco === '-') {
    if (window.UIComponents && window.UIComponents.NotificationManager) {
      window.UIComponents.NotificationManager.error('Aanmelden niet mogelijk: geen OVD/OPCO actief');
    } else {
      showToast('Aanmelden niet mogelijk: geen OVD/OPCO actief');
    }
    return;
  }

  const u = getUser();
  u.indienstStart = Date.now();
  saveUser(u);

  // Aanmelden - dit zou ook het roepnummer uit wachtrij moeten verwijderen
  const aanmeldResponse = await fetch(`${API_URL}/api/aanmelden`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: u.id,
      naam: u.displayName || u.username,
      bijzonderheden: document.getElementById('aanmeld-bijzonderheden').value.trim(),
      rangicoon: u.rangicoon || '',
    }),
  });

  if (!aanmeldResponse.ok) {
    console.error('Aanmelden mislukt:', aanmeldResponse.status);
    if (window.UIComponents && window.UIComponents.NotificationManager) {
      window.UIComponents.NotificationManager.error('Aanmelden mislukt - probeer opnieuw');
    } else {
      showToast('Aanmelden mislukt - probeer opnieuw');
    }
    return;
  }

  // Dubbelcheck: probeer nogmaals roepnummer uit wachtrij te verwijderen
  // Probeer verschillende endpoints om roepnummer te verwijderen
  try {
    // Eerst proberen via DELETE op wachtrij met userId
    let deleteResponse = await fetch(`${API_URL}/api/wachtrij/${u.id}`, { method: 'DELETE' });
    if (deleteResponse.status === 404) {
      console.log('📝 DELETE wachtrij/${userId} endpoint bestaat niet');
      
      // Probeer via POST naar wachtrij met delete actie
      deleteResponse = await fetch(`${API_URL}/api/wachtrij`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', userId: u.id })
      });
      
      if (!deleteResponse.ok) {
        console.log('📝 POST wachtrij remove endpoint ook niet beschikbaar');
        
        // Laatste optie: check of de aanmelden endpoint het roepnummer al verwijderd heeft
        console.log('📝 Vertrouwen op aanmelden endpoint voor wachtrij cleanup');
      } else {
        console.log('✅ Roepnummer succesvol verwijderd via POST wachtrij');
      }
    } else if (!deleteResponse.ok) {
      console.warn('Kon roepnummer niet verwijderen uit wachtrij - status:', deleteResponse.status);
    } else {
      console.log('✅ Roepnummer succesvol verwijderd via DELETE wachtrij');
    }
  } catch (err) {
    console.error('Fout bij verwijderen roepnummer uit wachtrij:', err);
  }

  // UI aanpassen
  document.querySelector('.porto-aanmeld-section').classList.add('hidden');
  document.getElementById('porto-wacht').classList.remove('hidden');
  startIndienstTimer('oc-tijd');
  
  // Gebruik fallback notificatie systeem
  if (window.UIComponents && window.UIComponents.NotificationManager) {
    window.UIComponents.NotificationManager.success('Aangemeld - wacht op indeling door OVD/OPCO');
  } else {
    showToast('Aangemeld - wacht op indeling door OVD/OPCO');
  }

  // ✅ Start automatische check elke 10 seconden
  startWachtrijPolling(u.id);
}

// Polling functie
function startWachtrijPolling(userId) {
  if (wachtrijInterval) clearInterval(wachtrijInterval); // oude interval stoppen als die bestaat

  wachtrijInterval = setInterval(async () => {
    try {
      const resp = await fetch(`${API_URL}/api/indeling/${userId}`);
      const data = await resp.json();

      if (data.ingedeeld) {
        clearInterval(wachtrijInterval);
        wachtrijInterval = null;
        
        // Update user data
        const u = getUser();
        u.ingedeeld = true;
        u.voertuig = data.voertuig;
        u.dienstnummer = data.roepnummer;
        u.indienstStart = data.indienstStart || u.indienstStart;
        saveUser(u);
        
        // UI bijwerken naar ingedeeld scherm
        document.getElementById('porto-wacht').classList.add('hidden');
        document.getElementById('porto-main').classList.remove('hidden');
        document.getElementById('porto-main').style.display = '';
        
        // Update UI elementen
        updateOCInfo();
        highlightVoertuig(data.voertuig || '');
        ['voertuig-error'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
        
        // Start timer
        startIndienstTimer('oc-tijd');
        
        window.UIComponents.NotificationManager.success('Je bent ingedeeld door OVD/OPCO!');
        if (window.UIComponents && window.UIComponents.NotificationManager) {
          window.UIComponents.NotificationManager.success('Je bent ingedeeld door OVD/OPCO!');
        } else {
          showToast('Je bent ingedeeld door OVD/OPCO!');
        }
      }
    } catch (err) {
      console.error('Fout bij ophalen indeling', err);
    }
  }, 10000); // 10 seconden
}

function inloggenDirect(type) {
  const u = getUser();
  
  // Gebruik de 'role' property ipv 'rollen' array voor OVD/OPCO check
  const userRole = u.role || '';
  const userRollen = (u.rollen || []).map(r => r.naam || r);

  console.log('🔍 INLOGGEN DIRECT - User state:', {
    type: type,
    userRole: userRole,
    userRollen: userRollen,
    hasOVD: userRollen.some(r => r.includes('OVD') || r.includes('OvD')),
    hasOPCO: userRollen.some(r => r.includes('OPCO')),
    hasOPS: userRollen.some(r => r.includes('OPS'))
  });

  if (type === 'OVD' && !userRollen.some(r => r.includes('OVD') || r.includes('OvD'))) {
    showToast('Je hebt de OVD rol niet'); return;
  }
  if (type === 'OPCO' && !userRollen.some(r => r.includes('OPCO'))) {
    showToast('Je hebt de OPCO rol niet'); return;
  }
  if (type === 'OPS' && !userRollen.some(r => r.includes('OPS'))) {
    showToast('Je hebt de OPS rol niet'); return;
  }

  // Voor OPS is roepnummer verplicht
  if (type === 'OPS') {
    const roepnummerInput = document.getElementById('inloggen-roepnummer').value.trim();
    if (!roepnummerInput) {
      showToast('Roepnummer is verplicht voor OPS');
      document.getElementById('inloggen-roepnummer').focus();
      return;
    }
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

  // Check of huidige roepnummer correct is voor OVD/OPCO
  if (type === 'OVD' && u.dienstnummer !== '17-00') {
    console.log('🔍 OVD ROEPNUMMER CORRECTIE - Oud:', u.dienstnummer, '→ Nieuw: 17-00');
    u.dienstnummer = '17-00';
  }
  if (type === 'OPCO' && u.dienstnummer !== '17-01') {
    console.log('🔍 OPCO ROEPNUMMER CORRECTIE - Oud:', u.dienstnummer, '→ Nieuw: 17-01');
    u.dienstnummer = '17-01';
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
  closeVoertuigModal();
  document.getElementById('voertuig-modal').classList.remove('hidden');

  // Vul voertuig dropdown met beschikbare types
  const voertuigSelect = document.getElementById('edit-voertuig');
  voertuigSelect.innerHTML = '<option value="">Kies voertuig...</option>'; // Reset en voeg placeholder toe

  // Haal specialisaties op om voertuig types te vullen
  Promise.all([
    fetch(`${API_URL}/api/specialisaties`).then(r => r.json()).catch(() => []),
    fetch(`${API_URL}/api/eenheden`).then(r => r.json()).catch(() => []), // Haal eenheden op
  ]).then(([specialisaties, eenheden]) => {
    const voertuigTypes = [...new Set(specialisaties.map(s => s.voertuig))];
    const uniekeTypes = [...new Set(voertuigTypes.map(type => type.replace(/ \d+$/, '')))]; // Verwijder nummers
    
    // Check min eenheden voor elke specialisatie
    const totaalIndienst = eenheden ? eenheden.length : 0;
    const typesMetWaarschuwing = uniekeTypes.map(type => {
      const spec = specialisaties.find(s => s.voertuig === type || s.voertuig.replace(/ \d+$/, '') === type);
      const minOk = spec && spec.min_eenheden > 0 ? totaalIndienst >= spec.min_eenheden : true;
      const warning = !minOk ? ` (⚠ ${totaalIndienst}/${spec.min_eenheden})` : '';
      return { waarde: type, label: type + warning, minOk };
    });
    
    typesMetWaarschuwing.forEach(type => {
      const option = document.createElement('option');
      option.value = type.waarde;
      option.textContent = type.label;
      if (unit.type && unit.type.replace(/ \d+$/, '') === type.waarde) {
        option.selected = true;
      }
      voertuigSelect.appendChild(option);
    });
  })
  .catch(error => console.error('Fout bij het ophalen van voertuig types:', error));

  document.getElementById('edit-unit-id').value = id;
  document.getElementById('edit-unit-naam').textContent = unit.medewerkers;
  document.getElementById('edit-roepnummer').value = unit.id !== unit.medewerkers ? unit.id : '';

  // IBT check
  let rollen = [];
  try { rollen = JSON.parse(unit.rollen || '[]'); } catch {}
  const rolNamen = rollen.map(r => typeof r === 'string' ? r : (r.naam || ''));
  const heeftIbt = rolNamen.some(r => r.includes('IBT') || r.includes('ibt'));
  document.getElementById('edit-ibt-warn').style.display = heeftIbt ? 'none' : 'block';

  // Load specialisaties
  const specEl = document.getElementById('edit-specs');
  if (specEl) specEl.textContent = '';

  // Haal rollen + specialisaties tegelijk op
  Promise.all([
    fetch(`${API_URL}/api/rollen/${unit.userId}`).then(r => r.json()).catch(() => {
      let rollen = [];
      try { rollen = JSON.parse(unit.rollen || '[]'); } catch {}
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

    const specs = opties.filter(o => o !== 'Noodhulp');
    const uniekSpecs = [...new Set(specs.map(s => s.replace(/ \d+$/, '')))];

    document.getElementById('edit-ibt-warn').style.display = heeftIbt ? 'none' : 'block';
    if (specEl) {
      setTimeout(() => {
        specEl.textContent = uniekSpecs.length ? 'Specialisaties: ' + uniekSpecs.join(', ') : '';
        specEl.style.display = uniekSpecs.length ? 'block' : 'none';
      }, 100);
    }
  });

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
    
    // CRITICAL FIX: Remove any existing status alerts for this user when status changes
    return fetch(`${API_URL}/api/status-alerts`).then(r => r.json());
  }).then(alerts => {
    // Remove alerts for this user that are no longer valid
    const userAlerts = alerts.filter(alert => alert.userId === unit.userId);
    userAlerts.forEach(alert => {
      fetch(`${API_URL}/api/status-alerts/${alert.id}`, { method: 'DELETE' })
        .catch(err => console.error('Failed to remove alert', alert.id, err));
    });
    // Refresh meldingen to update the UI
    renderMeldingen();
    showToast(`${unit.medewerkers} → Status ${status}`);
  }).catch(err => console.error('Status update failed', err));
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
      clearPingTimers();
      
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
    fetch(`${API_URL}/api/eenheden`).then(r => r.json()).catch(() => []), // Haal eenheden op
  ]).then(([rollen, specialisaties, eenheden]) => {
    const rolNamen = rollen.map(r => typeof r === 'string' ? r : (r.naam || ''));
    const heeftIbt = rolNamen.some(r => r.includes('IBT') || r.includes('ibt'));

    // Bouw opties op basis van vereiste_rol in specialisaties
    const opties = specialisaties
      .filter(s => {
        if (!s.vereiste_rol) return true; // geen vereiste = altijd beschikbaar (Noodhulp)
        return rolNamen.some(r => r.toLowerCase().includes(s.vereiste_rol.toLowerCase()));
      })
      .map(s => s.voertuig);

    const uniekeOpties = [...new Set(opties.map(o => o.replace(/ \d+$/, '')))]; // Verwijder nummers

    // Check min eenheden voor elke specialisatie
    const totaalIndienst = eenheden ? eenheden.length : 0;
    const optiesMetWaarschuwing = uniekeOpties.map(optie => {
      const spec = specialisaties.find(s => s.voertuig === optie || s.voertuig.replace(/ \d+$/, '') === optie);
      const minOk = spec && spec.min_eenheden > 0 ? totaalIndienst >= spec.min_eenheden : true;
      const warning = !minOk ? ` (⚠ ${totaalIndienst}/${spec.min_eenheden})` : '';
      return { waarde: optie, label: optie + warning, minOk };
    });

    const select = document.getElementById('indelen-voertuig');
    select.innerHTML = optiesMetWaarschuwing.map(o => `<option value="${o.waarde}">${o.label}</option>`).join('');

    const specs = uniekeOpties.filter(o => o !== 'Noodhulp');
    const uniekSpecs = [...new Set(specs.map(s => s.replace(/ \d+$/, '')))];

    document.getElementById('indelen-ibt-warn').style.display = heeftIbt ? 'none' : 'block';
    if (specEl) {
      setTimeout(() => {
        specEl.textContent = uniekSpecs.length ? 'Specialisaties: ' + uniekSpecs.join(', ') : '';
        specEl.style.display = uniekSpecs.length ? 'block' : 'none';
      }, 100);
    }
  });
}

function saveIndeling() {
  const userId = document.getElementById('indelen-user-id').value;
  const roepnummer = document.getElementById('indelen-roepnummer').value.trim();
  const voertuig = document.getElementById('indelen-voertuig').value;
  if (!roepnummer) { showToast('Vul een roepnummer in'); return; }

  // Sluit de modal direct
  document.getElementById('indelen-modal').classList.add('hidden');

  const u = getUser();

  fetch(`${API_URL}/api/indelen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, roepnummer, voertuig, ingedeeldDoor: u.displayName || u.username }),
  }).then(r => r.json()).then(data => {
    clearTimeout(timeoutId); // Stop timeout als API wel werkt
    if (data.error) { 
      showToast('⚠ ' + data.error); 
      // Open modal weer bij error
      document.getElementById('indelen-modal').classList.remove('hidden');
      return; 
    }
    showToast(roepnummer + ' ingedeeld met ' + voertuig);
    renderMeldingen();
    
    // Directe refresh na succesvolle indeling
    setTimeout(() => window.location.reload(), 500);
  }).catch(error => {
    clearTimeout(timeoutId); // Stop timeout
    console.error('Fout bij indelen:', error);
    showToast('Indeling verwerkt (server offline)');
    // Refresh na error zodat gebruiker door kan gaan
    setTimeout(() => window.location.reload(), 1000);
  });
}

// Controleer of gebruiker is ingedeeld (voor normale gebruiker)
function checkIndeling() {
  const u = getUser();
  if (!u.id) return;

  console.log('🔍 CHECK INDELING - User state:', {
    role: u.role,
    ingedeeld: u.ingedeeld,
    indienstStart: u.indienstStart,
    status: u.status
  });

  // Reset status 10 bij re-login (voorkom vastzitten in uitdienst modal)
  if (u.status === 10) {
    console.log('🔄 RE-LOGIN - Reset status 10 naar null');
    u.status = null;
    saveUser(u);
  }

  // Check of rol veranderd is (werd je OVD/OPCO gekozen?)
  // Alleen checken als user nog niet OVD/OPCO/OC/OPS is
  const currentUserRole = u.role || '';
  if (!['ovd','opco','oc','ops'].includes(currentUserRole)) {
    console.log('🔍 CHECKING ROLE CHANGE - Current role:', currentUserRole);
    fetch(`${API_URL}/api/rol-check/${u.id}`)
      .then(r => r.json())
      .then(data => {
        console.log('🔍 ROLE CHECK RESPONSE:', data);
        // Alleen rol toewijzen als gebruiker NIET uitdienst is
        const isUitdienst = !u.indienstStart || u.status === 10;
        console.log('🔍 Is uitdienst?', isUitdienst, 'New role:', data.role);
        if (!isUitdienst && ['ovd','opco','oc','ops'].includes(data.role)) {
          u.role = data.role;
          if (data.dienstnummer) u.dienstnummer = data.dienstnummer;
          if (data.voertuig) u.voertuig = data.voertuig;
          if (data.indienstStart) u.indienstStart = data.indienstStart;
          saveUser(u);
          showToast('Je bent aangesteld als ' + data.role.toUpperCase() + '!');
          setTimeout(() => window.location.reload(), 1000);
          return;
        }
      }).catch(err => {
        console.error('🔍 ROLE CHECK ERROR:', err);
      });
  }

  if (u.ingedeeld) {
    console.log('🔍 USER INGEDEELD - Checking indeling API');
    // Check of voertuig type veranderd is door OVD
    fetch(`${API_URL}/api/indeling/${u.id}`)
      .then(r => r.json())
      .then(data => {
        console.log('🔍 INDELING API RESPONSE:', data);
        if (data.voertuig && data.voertuig !== u.voertuig) {
          u.voertuig = data.voertuig;
          saveUser(u);
          speelVoertuigGeluid();
          showToast('Voertuig type gewijzigd: ' + data.voertuig);
          const isOvdOpco = ['ovd','opco','oc','ops'].includes(u.role);
          if (isOvdOpco) ovdUpdateInfo(); else updateOCInfo();
        }
      }).catch(err => {
        console.error('🔍 INDELING API ERROR:', err);
      });
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

        // Cleanup: Remove user from wachtrij when they get a roepnummer
        console.log('🧹 INGEDEELD - User met roepnummer verwijderen uit wachtrij:', u.naam, 'roepnummer:', data.roepnummer);
        fetch(`${API_URL}/api/wachtrij`)
          .then(r => r.json())
          .then(wachtrij => {
            const userInWachtrij = wachtrij.find(w => w.userId === u.id || w.naam === u.naam);
            if (userInWachtrij) {
              console.log('🧹 USER GEVONDEN IN WACHTRIJ - Verwijderen:', userInWachtrij.naam, 'ID:', userInWachtrij.id);
              fetch(`${API_URL}/api/wachtrij/${userInWachtrij.id}`, { method: 'DELETE' })
                .then(() => {
                  console.log('🧹 SUCCES - User verwijderd uit wachtrij bij indeling');
                  renderMeldingen();
                })
                .catch(err => console.error('Failed to remove user from wachtrij', err));
            }
          })
          .catch(err => console.error('Failed to check wachtrij', err));

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
function openKandidatenModal(rol) {
  _kandidatenRol = rol;
  document.getElementById('kandidaten-titel').textContent = 'Nieuwe ' + rol.toUpperCase() + ' kiezen';
  document.getElementById('kandidaten-modal').classList.remove('hidden');

  console.log('🔍 OPEN KANDIDATEN MODAL - Rol:', rol);
  console.log('🔍 OPEN KANDIDATEN MODAL - API_URL:', API_URL);
  console.log('🔍 OPEN KANDIDATEN MODAL - Full URL:', `${API_URL}/api/kandidaten/${rol}`);

  fetch(`${API_URL}/api/kandidaten/${rol}`)
    .then(r => {
      console.log('🔍 API RESPONSE STATUS:', r.status, r.ok);
      if (!r.ok) {
        console.log('🔍 API RESPONSE NOT OK - Status:', r.status);
        throw new Error(`HTTP ${r.status}`);
      }
      return r.json();
    })
    .then(kandidaten => {
      console.log('🔍 API RAW RESPONSE:', kandidaten);
      console.log('🔍 API RESPONSE TYPE:', typeof kandidaten);
      console.log('🔍 API RESPONSE LENGTH:', kandidaten.length);
      
      // TEMP FIX: Als API leeg is, voeg huidige user toe als kandidaat
      if (kandidaten.length === 0) {
        const currentUser = getUser();
        if (currentUser.role === rol || (currentUser.rollen && currentUser.rollen.some(r => r.naam === rol.toUpperCase()))) {
          console.log('🔍 TEMP FIX - Adding current user as candidate:', currentUser);
          kandidaten = [{
            id: currentUser.id,
            shortname: currentUser.shortname || currentUser.displayName,
            display_name: currentUser.displayName,
            role: currentUser.role,
            rollen: currentUser.rollen
          }];
        }
      }
      _kandidatenLijst = kandidaten;
      const lijst = document.getElementById('kandidaten-lijst');
      
      // Filter kandidaten op basis van rol - check zowel rollen array als rol property
      const gefilterdeKandidaten = kandidaten.filter(k => {
        console.log('🔍 FILTERING KANDIDAAT:', k);
        console.log('🔍 KANDIDAAT.rollen:', k.rollen);
        console.log('🔍 KANDIDAAT.role:', k.role);
        console.log('🔍 KANDIDAAT.status:', k.status);
        console.log('🔍 KANDIDAAT.indienstStart:', k.indienstStart);
        
        // Check of kandidaat de juiste rol heeft (case-insensitive)
        const rolString = typeof r === 'string' ? r : (r.naam || '');
        const match = rolString.toLowerCase().includes(rol.toLowerCase());
        console.log('🔍 ROL STRING MATCH:', rolString, 'vs', rol, '=>', match);
        
        // Fallback: check ook role property als rollen leeg is
        const heeftRolProperty = k.role && k.role.toLowerCase() === rol.toLowerCase();
        console.log('🔍 ROLE PROPERTY MATCH:', k.role, 'vs', rol, '=>', heeftRolProperty);
        
        // Sluit kandidaten uit die:
        // 1. Al in dienst zijn
        // 2. Al de rol hebben die we zoeken
        // 3. Al OVD/OPCO zijn (die kunnen niet gekozen worden)
        const isAlInDienst = k.indienstStart && k.ingedeeld;
        const heeftAlRol = rolString.toLowerCase().includes(rol.toLowerCase());
        const isHuidigeOvdOpco = ['ovd', 'opco'].includes(rol.toLowerCase());
        
        console.log('🔍 KANDIDAAT FILTER CHECKS:', {
          isAlInDienst: isAlInDienst,
          heeftAlRol: heeftAlRol,
          isHuidigeOvdOpco: isHuidigeOvdOpco
        });
        
        // Toon kandidaat NIET als:
        // - Al in dienst is
        // - Al de gezochte rol heeft (maar niet als we OVD/OPCO zoeken)
        // - Al OVD/OPCO en we zoeken naar OVD/OPCO
        const shouldExclude = isAlInDienst || (heeftAlRol && !isHuidigeOvdOpco);
        
        if (shouldExclude) {
          console.log('🔍 KANDIDAAT EXCLUDED - Already in service or has conflicting role');
          return false;
        }
        
        const result = match || heeftRolProperty;
        console.log('🔍 FINAL FILTER RESULT:', result);
        return result;
      });
      
      console.log('🔍 KANDIDATEN FILTER - Rol:', rol, 'Totaal:', kandidaten.length, 'Gefilterd:', gefilterdeKandidaten.length);
      
      if (gefilterdeKandidaten.length === 0) {
        console.log('🔍 NO CANDIDATES FOUND - Showing empty message');
        lijst.innerHTML = '<div style="color:#888;text-align:center;padding:12px">Geen actieve kandidaten met rol: ' + rol + '</div>';
      } else {
        console.log('🔍 FOUND CANDIDATES - Rendering:', gefilterdeKandidaten);
        lijst.innerHTML = gefilterdeKandidaten.map(k => `
          <div style="display:flex;justify-content:space-between;align-items:center;background:#1e2130;padding:10px 14px;border-radius:6px">
            <span>${k.shortname || k.display_name}</span>
            <button class="btn-purple small" onclick="kiesKandidaat('${k.id}','${rol}')">Kiezen</button>
          </div>
        `).join('');
      }
    })
    .catch(error => {
      console.error('🔍 API ERROR:', error);
      const lijst = document.getElementById('kandidaten-lijst');
      if (lijst) {
        lijst.innerHTML = '<div style="color:#f87171;text-align:center;padding:12px">Kan kandidaten niet laden: ' + error.message + '</div>';
      }
    });
}

function radVanFortuin() {
  const kandidaten = _kandidatenLijst || [];
  
  if (kandidaten.length === 0) {
    showToast('Geen kandidaten beschikbaar');
    return;
  }
  
  // Kies willekeurige kandidaat
  const willekeurigeIndex = Math.floor(Math.random() * kandidaten.length);
  const gekozenKandidaat = kandidaten[willekeurigeIndex];
  
  console.log('🎰 RAD VAN FORTUIN - Gekozen kandidaat:', gekozenKandidaat);
  
  // Roep kiesKandidaat aan met de willekeurige kandidaat
  kiesKandidaat(gekozenKandidaat.id, _kandidatenRol);
}