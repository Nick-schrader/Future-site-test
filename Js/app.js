// ---- API URL ----
const API_URL = window.CONFIG?.API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3001'
  : window.location.origin);

// ---- GEDEELDE STATE (via sessionStorage) ----
const defaultUser = {
  username: 'gwnboxerjur.',
  id: '1196035736823156790',
  dienst: 'KMAR',
  fullname: 'GwnBoxerJur',
  shortname: 'Jur B.',
  dsi: '',
  dienstnummer: '',
  phone: '',
  refresh: 200,
  streamer: false,
  naamLock: false,
  role: 'user',
  status: null,
  voertuig: null,
};

function getUser() {
  const saved = sessionStorage.getItem('user');
  if (!saved || saved === 'null' || saved === 'undefined') {
    return { ...defaultUser };
  }
  try {
    const parsed = JSON.parse(saved);
    const user = parsed && parsed.id ? parsed : { ...defaultUser };
    
    // Admin override - Discord ID 1196035736823156790 gets admin privileges
   // if (user.id === '1196035736823156790') {
   //   user.isAdmin = true;
    //  user.role = 'admin'; // Override role for admin
   //   console.log('[ADMIN] Admin user detected:', user.id);
   // }
    
    return user;
  } catch (e) {
    return { ...defaultUser };
  }
}

function saveUser(u) {
  sessionStorage.setItem('user', JSON.stringify(u));
}

// Haal verse gebruikersdata op uit DB en merge met sessionStorage
async function syncUserFromDB() {
  const u = getUser();
  if (!u.id) return;
  try {
    const res = await fetch(`${API_URL}/api/me/${u.id}`);
    if (!res.ok) return;
    const data = await res.json();
    
    // Als gebruiker uitdienst is, herstel geen rol/dienstnummer
    const isUitdienst = !u.indienstStart || u.status === 10;
    
    // Check of gebruiker net heeft ingelogd (fresh login)
    const isFreshLogin = !u.indienstStart && !u.status && !u.voertuig;
    
    // DB is altijd leidend voor deze velden, behalve bij uitdienst of fresh login
    const merged = {
      ...u,
      ...data,
      role: (isUitdienst || isFreshLogin) ? 'user' : (data.role || u.role || 'user'),
      status: (isUitdienst || isFreshLogin) ? null : (data.status ?? null),
      voertuig: (isUitdienst || isFreshLogin) ? null : (data.voertuig ?? null),
      indienstStart: (isUitdienst || isFreshLogin) ? null : (data.indienstStart ?? null),
      dienstnummer: '', // BELANGRIJK: Altijd leeg bij inloggen/sync
      rollen: (data.rollen && data.rollen.length > 0) ? data.rollen : (u.rollen || []),
    };
    
    if (isUitdienst) {
      console.log('🔄 SYNC - Geen rol herstel, gebruiker is uitdienst');
    } else if (isFreshLogin) {
      console.log('🔄 SYNC - Fresh login, forcing user role');
    }
    
    saveUser(merged);
    return merged;
  } catch {}
}

// ---- AUTH CHECK ----
// Vereist login voor alle pagina's behalve account.html (voor registratie)
(function() {
  const inPages = window.location.pathname.includes('/pages/');
  const isAccount = window.location.pathname.includes('account.html');
  if (inPages && !isAccount && !sessionStorage.getItem('loggedIn')) {
    window.location.href = '../index.html';
  }
})();

// ---- GEDEELDE DATA ----
const appData = {
  eenheden: [],
  meldingen: [],
  trainingen: [
    { naam: 'Basistraining', actief: true }, { naam: 'IBT Training', actief: true },
    { naam: 'Surveillantentraining', actief: true }, { naam: 'Sleepwagen Training', actief: true },
    { naam: 'Wetskennistoets', actief: true }, { naam: 'OVD Training', actief: true },
    { naam: 'Offroad Training', actief: true }, { naam: 'SIV Training', actief: true },
    { naam: 'Motor Training', actief: true }, { naam: 'Unmarked Training', actief: true },
    { naam: 'Zulu Training', actief: false },
  ],
  discordRollen: [
    { naam: 'POLITIE', actief: true, kleur: 'blue' }, { naam: 'Invite permissies', actief: false, kleur: 'white' },
    { naam: 'DJI', actief: true, kleur: 'green' }, { naam: 'POLITIE in opleiding', actief: true, kleur: 'blue' },
    { naam: 'POLITIE TRAINER', actief: true, kleur: 'purple' }, { naam: 'Inspecteur+', actief: true, kleur: 'blue' },
    { naam: 'OPCO', actief: true, kleur: 'blue' }, { naam: 'POLITIE OC', actief: true, kleur: 'blue' },
    { naam: 'ACCESSROLE DELTA', actief: false, kleur: 'gray' }, { naam: 'IBT-training', actief: false, kleur: 'gray' },
    { naam: 'OvD-P', actief: true, kleur: 'blue' },
  ],
  tijden: {
    porto: [],
    opco:  [],
    ovd:   [],
    oc:    [],
  },
  opco: 'Mark J.',
  ovd: 'Alex S.',
};

// ---- TOPBAR SHARED ----
function toggleProfileMenu(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('profile-menu');
  if (menu) menu.classList.toggle('hidden');
}

document.addEventListener('click', (e) => {
  const menu = document.getElementById('profile-menu');
  if (!menu) return;
  if (!e.target.closest('.topbar-right')) {
    menu.classList.add('hidden');
  }
});

function logout() {
  const u = getUser();
  if (u.id) {
    fetch(`${API_URL}/api/reset/${u.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ indienstStart: u.indienstStart }),
    }).finally(() => {
      sessionStorage.clear();
      window.location.href = '../index.html';
    });
  } else {
    sessionStorage.clear();
    window.location.href = '../index.html';
  }
}

function switchRole() {
  const u = getUser();
  const rollen = (u.rollen || []).map(r => r.naam || r);
  const beschikbaar = ['user'];
  if (rollen.some(r => r.includes('OPCO-K'))) beschikbaar.push('opco');
  if (rollen.some(r => r.includes('OVD-K') || r.includes('OvD-K'))) beschikbaar.push('ovd');
  if (rollen.includes('OC')) beschikbaar.push('oc');

  const huidig = beschikbaar.indexOf(u.role);
  u.role = beschikbaar[(huidig + 1) % beschikbaar.length];
  saveUser(u);

  if (u.id) {
    fetch(`${API_URL}/api/rol`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: u.id, role: u.role, indienstStart: u.indienstStart || Date.now() }),
    }).then(r => r.json()).then(data => {
      if (data.indienstStart) { u.indienstStart = data.indienstStart; saveUser(u); }
    });
  }

  showToast('Geswitcht naar: ' + u.role.toUpperCase());
  setTimeout(() => window.location.reload(), 800);
}

function toggleNotifications() {
  showToast('Notificaties: 3 nieuwe meldingen');
}

// ---- TOAST ----
function showToast(msg) {
  const toast = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3500);
}

function hideToast() {
  document.getElementById('toast').classList.add('hidden');
}

// ---- AVATAR & PROFIEL NAAM UPDATEN ----
(function() {
  const u = getUser();
  if (!u.id) return;

  // Avatar
  if (u.avatar) {
    document.querySelectorAll('.avatar img, summary.avatar img').forEach(img => {
      img.src = u.avatar;
    });
  }

  // Profielnaam in dropdown - make clickable
  document.querySelectorAll('.profile-menu-name').forEach(el => {
    const name = u.displayName || u.username || 'Gebruiker';
    el.innerHTML = '<a href="account.html" style="color:inherit;text-decoration:none;">' + name + '</a>';
  });

  // Toon navigation links op basis van Discord rollen en admin status
  const rollen = (u.rollen || []).map(r => r.naam || r);
  const isAdmin = u.isAdmin === 1 || u.id === '1196035736823156790';
  
  // Toon OPS link als de user 'Ops', 'Kader' rol heeft OF admin is
  if (rollen.some(r => ['OPS', 'Kader'].includes(r)) || isAdmin) {
    const opsLink = document.getElementById('nav-ops');
    if (opsLink) opsLink.style.display = '';
  }
  
  // Toon Logs & Settings links als de user 'Porto Perms', 'Kader' rol heeft OF admin is
  if (rollen.some(r => ['Porto Perms', 'Kader'].includes(r)) || isAdmin) {
    const logsLink = document.getElementById('nav-logs');
    if (logsLink) logsLink.style.display = '';
    const settingsLink = document.getElementById('nav-settings');
    if (settingsLink) settingsLink.style.display = '';
  }
})();

async function laadDiscordRollen() {
  const u = getUser();
  if (!u.id) return;
  try {
    const res = await fetch(`${API_URL}/api/rollen/${u.id}`);
    const rollen = await res.json();
    if (rollen.length > 0) {
      u.rollen = rollen;
      saveUser(u);
    }
  } catch {}
}
