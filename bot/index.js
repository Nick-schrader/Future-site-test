require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const cors = require('cors');
const path = require('path');
const {
  upsertGebruiker, getGebruiker, updateGebruikerInstellingen,
  addAanmelding, getWachtrij, removeAanmelding,
  addIndeling, getIndeling,
} = require('./database');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
  ],
});

client.once('clientReady', () => {
  console.log(`Bot online als ${client.user.tag}`);
});

// ---- HELPER: haal member info op ----
async function getMemberData(discordUser, member) {
  const rollen = member.roles.cache
    .filter(r => r.name !== '@everyone')
    .sort((a, b) => b.position - a.position)
    .map(r => ({
      id: r.id,
      naam: r.name,
      kleur: r.hexColor === '#000000' ? '#99aab5' : r.hexColor,
    }));

  const rolNamen = rollen.map(r => r.naam);
  let role = 'user';
  if (rolNamen.includes('OC')) role = 'oc';
  else if (rolNamen.some(r => r.includes('OVD-K') || r.includes('OvD-K'))) role = 'ovd';
  else if (rolNamen.some(r => r.includes('OPCO-K'))) role = 'opco';
  else if (rolNamen.some(r => r.includes('OPS'))) role = 'ops';

  const dienst = member.roles.cache.has('1487030383337017405') ? 'KMAR'
    : rolNamen.includes('POLITIE') ? 'Politie' : 'Onbekend';

  const avatar = discordUser.avatar
    ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=64`
    : `https://ui-avatars.com/api/?name=${discordUser.username}&background=4ade80&color=000&size=64`;

  return { rollen, rolNamen, role, dienst, avatar };
}

// ---- OAuth2 login ----
app.get('/auth/login', (_req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.CLIENT_ID,
    redirect_uri: process.env.REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds.members.read',
  });
  res.redirect(`https://discord.com/oauth2/authorize?${params}`);
});

app.get('/auth/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.redirect('/?error=no_code');

  try {
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.REDIRECT_URI,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return res.redirect('/?error=token_failed');

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const discordUser = await userRes.json();

    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const member = await guild.members.fetch(discordUser.id);
    const { rollen, role, dienst, avatar } = await getMemberData(discordUser, member);

    // Sla op in database - altijd als user starten bij nieuwe login
    upsertGebruiker.run({
      id: discordUser.id,
      username: discordUser.username,
      display_name: member.displayName,
      avatar,
      dienst,
      role: 'user',
      fullname: member.displayName,
      rollen: JSON.stringify(rollen),
    });

    // Haal opgeslagen instellingen op
    const opgeslagen = getGebruiker.get(discordUser.id);

    const user = {
      id: discordUser.id,
      username: discordUser.username,
      displayName: member.displayName,
      avatar,
      rollen,
      role: 'user',
      dienst,
      fullname: opgeslagen?.fullname || member.displayName,
      shortname: opgeslagen?.shortname || '',
      dcnaam: opgeslagen?.dcnaam || '',
      rangicoon: opgeslagen?.rangicoon || '',
      dienstnummer: opgeslagen?.dienstnummer || '',
    };

    const encoded = encodeURIComponent(JSON.stringify(user));
    res.redirect(`${process.env.PUBLIC_URL || 'http://localhost:3001'}/auth/done?user=${encoded}`);

  } catch (err) {
    console.error(err);
    res.redirect('/?error=server_error');
  }
});

app.get('/auth/done', (req, res) => {
  const user = req.query.user || '{}';
  res.send(`<!DOCTYPE html><html><body><script>
    sessionStorage.setItem('loggedIn', '1');
    sessionStorage.setItem('user', decodeURIComponent(${JSON.stringify(encodeURIComponent(user))}));
    window.location.href = '/pages/porto.html';
  </script></body></html>`);
});

// ---- API: Instellingen opslaan ----
app.post('/api/instellingen', (req, res) => {
  const { id, fullname, shortname, dcnaam, rangicoon } = req.body;
  if (!id) return res.status(400).json({ error: 'Geen ID' });
  console.log(`[INSTELLINGEN] id=${id} fullname="${fullname}" shortname="${shortname}" dcnaam="${dcnaam}" rangicoon="${rangicoon}"`);
  updateGebruikerInstellingen.run({ id, fullname, shortname, dcnaam, rangicoon });
  res.json({ success: true });
});

// ---- API: Aanmelden (STATUS 0) ----
app.post('/api/aanmelden', async (req, res) => {
  const { userId, naam, bijzonderheden, rangicoon } = req.body;
  if (!userId) return res.status(400).json({ error: 'Geen userId' });
  addAanmelding.run({ user_id: userId, naam, bijzonderheden: bijzonderheden || '', tijd: Date.now() });
  db.prepare('UPDATE gebruikers SET indienst_start = ? WHERE id = ?').run(Date.now(), userId);
  if (rangicoon !== undefined) db.prepare('UPDATE gebruikers SET rangicoon = ? WHERE id = ?').run(rangicoon, userId);

  // Rollen live updaten vanuit Discord zodat IBT check altijd klopt
  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const member = await guild.members.fetch(userId);
    const rollen = member.roles.cache
      .filter(r => r.name !== '@everyone')
      .sort((a, b) => b.position - a.position)
      .map(r => ({ id: r.id, naam: r.name, kleur: r.hexColor === '#000000' ? '#99aab5' : r.hexColor }));
    db.prepare('UPDATE gebruikers SET rollen = ? WHERE id = ?').run(JSON.stringify(rollen), userId);
  } catch (e) {
    console.warn('[AANMELDEN] Rollen sync mislukt:', e.message);
  }

  res.json({ success: true });
});

// ---- API: Status alerts (6/7) ----
app.get('/api/status-alerts', (_req, res) => {
  res.json(db.prepare('SELECT * FROM status_alerts ORDER BY tijd ASC').all());
});
app.delete('/api/status-alerts/:id', (req, res) => {
  db.prepare('DELETE FROM status_alerts WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ---- API: Wachtrij ophalen (voor OVD/OPCO) ----
app.get('/api/wachtrij', (_req, res) => {
  const rijen = db.prepare(`
    SELECT w.*, g.rollen FROM aanmeld_wachtrij w
    LEFT JOIN gebruikers g ON w.user_id = g.id
    ORDER BY w.tijd ASC
  `).all();
  // Zorg dat rollen altijd een geldige JSON array is
  const result = rijen.map(r => ({
    ...r,
    rollen: r.rollen && r.rollen !== '[]' ? r.rollen : '[]',
  }));
  res.json(result);
});

// ---- API: Indelen + Discord naam updaten ----
app.post('/api/indelen', async (req, res) => {
  const { userId, roepnummer, voertuig, ingedeeldDoor } = req.body;
  if (!userId || !roepnummer || !voertuig) return res.status(400).json({ error: 'Ontbrekende velden' });

  // Check specialisatie tijdslot
  const spec = db.prepare('SELECT * FROM specialisatie_instellingen WHERE voertuig = ?').get(voertuig);
  if (spec?.tijdslot_start) {
    const nu = new Date();
    const nowMinutes = nu.getHours() * 60 + nu.getMinutes();
    const [sh, sm] = spec.tijdslot_start.split(':').map(Number);
    const startMin = sh * 60 + sm;

    let toegestaan;
    if (spec.tijdslot_eind) {
      const [eh, em] = spec.tijdslot_eind.split(':').map(Number);
      const eindMin = eh * 60 + em;
      if (startMin > eindMin) {
        // Over middernacht: bv. 20:00 - 06:00
        toegestaan = nowMinutes >= startMin || nowMinutes < eindMin;
      } else {
        toegestaan = nowMinutes >= startMin && nowMinutes < eindMin;
      }
    } else {
      toegestaan = nowMinutes >= startMin;
    }

    if (!toegestaan) {
      const tijdMsg = spec.tijdslot_eind
        ? `${spec.tijdslot_start} - ${spec.tijdslot_eind}`
        : `vanaf ${spec.tijdslot_start}`;
      return res.status(400).json({ error: `${voertuig} is alleen toegestaan ${tijdMsg}` });
    }
  }

  // Check vereiste Discord rol
  if (spec?.vereiste_rol) {
    const g = db.prepare('SELECT rollen FROM gebruikers WHERE id = ?').get(userId);
    let rollen = [];
    try { rollen = JSON.parse(g?.rollen || '[]'); } catch {}
    const rolNamen = rollen.map(r => typeof r === 'string' ? r : (r.naam || ''));
    const heeftRol = rolNamen.some(r => r.toLowerCase().includes(spec.vereiste_rol.toLowerCase()));
    if (!heeftRol) return res.status(400).json({ error: `${voertuig} vereist de ${spec.vereiste_rol} specialisatie` });
  }

  // Check min eenheden totaal in dienst
  if (spec?.min_eenheden && spec.min_eenheden > 0) {
    const totaalIndienst = db.prepare("SELECT COUNT(*) as cnt FROM gebruikers WHERE indienst_start IS NOT NULL").get();
    if (totaalIndienst.cnt < spec.min_eenheden) {
      return res.status(400).json({ error: `${voertuig} vereist minimaal ${spec.min_eenheden} eenheden in dienst (nu: ${totaalIndienst.cnt})` });
    }
  }

  // Check max eenheden
  if (spec?.max_eenheden && spec.max_eenheden < 99) {
    const huidigAantal = db.prepare("SELECT COUNT(*) as cnt FROM indelingen WHERE voertuig = ?").get(voertuig);
    if (huidigAantal.cnt >= spec.max_eenheden) {
      return res.status(400).json({ error: `Maximum aantal eenheden voor ${voertuig} bereikt (${spec.max_eenheden})` });
    }
  }

  addIndeling.run({ user_id: userId, roepnummer, voertuig, ingedeeld_door: ingedeeldDoor || '', tijd: Date.now() });
  // Sla voertuig type ook op in gebruikers tabel zodat het zichtbaar is in het overzicht
  db.prepare('UPDATE gebruikers SET voertuig = ? WHERE id = ?').run(voertuig, userId);
  removeAanmelding.run(userId);

  // Auto-koppel: als er al iemand anders met hetzelfde roepnummer ingedeeld is
  const bestaande = db.prepare(`
    SELECT g.id FROM indelingen i
    JOIN gebruikers g ON i.user_id = g.id
    WHERE i.roepnummer = ? AND i.user_id != ? AND g.indienst_start IS NOT NULL AND g.koppel_id IS NULL
  `).get(roepnummer, userId);

  if (bestaande) {
    db.prepare('UPDATE gebruikers SET koppel_id = ? WHERE id = ?').run(bestaande.id, userId);
    db.prepare('UPDATE gebruikers SET koppel_id = ? WHERE id = ?').run(userId, bestaande.id);
    console.log(`[KOPPEL] Auto-koppel: ${userId} <-> ${bestaande.id} op roepnummer ${roepnummer}`);
  }

  // Zet naam in Discord
  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const member = await guild.members.fetch(userId);
    const g = db.prepare('SELECT shortname, display_name, rangicoon, role FROM gebruikers WHERE id = ?').get(userId);
    const nieuweNaam = maakDienstNaam(roepnummer, g, g?.role);
    await member.setNickname(nieuweNaam);
    res.json({ success: true, nieuweNaam });
  } catch (err) {
    console.error('Naam update mislukt:', err.message);
    res.json({ success: true });
  }
});

// ---- API: Check indeling (voor gebruiker) ----
app.get('/api/indeling/:userId', (req, res) => {
  const indeling = getIndeling.get(req.params.userId);
  const gebruiker = db.prepare('SELECT indienst_start, status, voertuig, voertuig_naam FROM gebruikers WHERE id = ?').get(req.params.userId);
  if (!indeling) return res.json({ ingedeeld: false, indienstStart: gebruiker?.indienst_start || null, status: gebruiker?.status || null, voertuig: gebruiker?.voertuig || null, voertuigNaam: gebruiker?.voertuig_naam || null });
  res.json({ ingedeeld: true, roepnummer: indeling.roepnummer, voertuig: indeling.voertuig || gebruiker?.voertuig, voertuigNaam: gebruiker?.voertuig_naam || null, indienstStart: gebruiker?.indienst_start || null, status: gebruiker?.status || null });
});

// ---- API: Database viewer ----
const { db } = require('./database');

app.get('/api/db/gebruikers', (_req, res) => {
  const rows = db.prepare('SELECT id, username, display_name, dienst, role, dienstnummer, voertuig FROM gebruikers').all();
  res.json(rows);
});

app.get('/api/db/wachtrij', (_req, res) => {
  res.json(db.prepare('SELECT * FROM aanmeld_wachtrij').all());
});

app.get('/api/db/indelingen', (_req, res) => {
  res.json(db.prepare('SELECT * FROM indelingen').all());
});

// ---- API: Eenheid roepnummer/voertuig updaten door OVD ----
app.post('/api/eenheid-update', async (req, res) => {
  const { userId, roepnummer, voertuig } = req.body;
  if (!userId) return res.status(400).json({ error: 'Geen userId' });
  if (voertuig) db.prepare('UPDATE gebruikers SET voertuig = ? WHERE id = ?').run(voertuig, userId);
  if (roepnummer) {
    db.prepare('UPDATE indelingen SET roepnummer = ?, voertuig = ? WHERE user_id = ?').run(roepnummer, voertuig, userId);
    // Update Discord naam — gebruik rol uit request body als die meegegeven is
    try {
      const guild = await client.guilds.fetch(process.env.GUILD_ID);
      const member = await guild.members.fetch(userId);
      const gebruiker = db.prepare('SELECT shortname, display_name, rangicoon, role FROM gebruikers WHERE id = ?').get(userId);
      const rolVoorNaam = req.body.role || gebruiker?.role;
      await member.setNickname(maakDienstNaam(roepnummer, gebruiker, rolVoorNaam));
    } catch (err) { console.error('Naam update mislukt:', err.message); }
  }
  res.json({ success: true });
});

// ---- API: Eigen voertuignaam updaten (door gebruiker zelf) ----
app.post('/api/voertuig-naam', (req, res) => {
  const { userId, voertuigNaam } = req.body;
  if (!userId) return res.status(400).json({ error: 'Geen userId' });
  db.prepare('UPDATE gebruikers SET voertuig_naam = ? WHERE id = ?').run(voertuigNaam || null, userId);
  res.json({ success: true });
});

// ---- API: Status en voertuig updaten ----
app.post('/api/status', (req, res) => {
  const { userId, status, voertuig } = req.body;
  if (!userId) return res.status(400).json({ error: 'Geen userId' });
  if (status !== undefined) db.prepare('UPDATE gebruikers SET status = ? WHERE id = ?').run(status, userId);
  if (voertuig !== undefined) db.prepare('UPDATE gebruikers SET voertuig = ? WHERE id = ?').run(voertuig, userId);

  // Speel geluid bij status 6 of 7
  if (status === 6 || status === 7) {
    db.prepare('INSERT INTO status_alerts (user_id, naam, status, tijd) VALUES (?, ?, ?, ?)').run(
      userId, '', status, Date.now()
    );
  }

  res.json({ success: true });
});

// ---- API: Rol updaten ----
app.post('/api/rol', async (req, res) => {
  const { userId, role, indienstStart, roepnummer, rangicoon } = req.body;
  if (!userId || !role) return res.status(400).json({ error: 'Ontbrekende velden' });
  const nu = indienstStart || Date.now();
  // Zet altijd de nieuwe rol (overschrijft vorige)
  db.prepare('UPDATE gebruikers SET role = ?, indienst_start = COALESCE(indienst_start, ?) WHERE id = ?').run(role, nu, userId);
  if (rangicoon !== undefined) db.prepare('UPDATE gebruikers SET rangicoon = ? WHERE id = ?').run(rangicoon, userId);
  if (roepnummer) {
    db.prepare('UPDATE gebruikers SET dienstnummer = ? WHERE id = ?').run(roepnummer, userId);
    db.prepare(`
      INSERT INTO indelingen (user_id, roepnummer, voertuig, ingedeeld_door, tijd)
      VALUES (?, ?, '', 'systeem', ?)
      ON CONFLICT(user_id) DO UPDATE SET roepnummer = excluded.roepnummer
    `).run(userId, roepnummer, nu);
    // Zet DC naam
    try {
      const guild = await client.guilds.fetch(process.env.GUILD_ID);
      const member = await guild.members.fetch(userId);
      const g = db.prepare('SELECT shortname, display_name, rangicoon, role FROM gebruikers WHERE id = ?').get(userId);
      await member.setNickname(maakDienstNaam(roepnummer, g, g?.role));
    } catch (err) { console.error('Naam update mislukt:', err.message); }
  }
  const g = db.prepare('SELECT indienst_start FROM gebruikers WHERE id = ?').get(userId);
  res.json({ success: true, indienstStart: g?.indienst_start });
});

// ---- API: Actieve OVD/OPCO ophalen ----
app.get('/api/dienst-rollen', (_req, res) => {
  // Zoek op indienst_start OF aanwezig in indelingen tabel
  const ovd = db.prepare(`
    SELECT g.display_name, g.shortname FROM gebruikers g
    WHERE g.role = 'ovd' AND (g.indienst_start IS NOT NULL OR EXISTS (SELECT 1 FROM indelingen i WHERE i.user_id = g.id))
    LIMIT 1
  `).get();
  const opco = db.prepare(`
    SELECT g.display_name, g.shortname FROM gebruikers g
    WHERE g.role = 'opco' AND (g.indienst_start IS NOT NULL OR EXISTS (SELECT 1 FROM indelingen i WHERE i.user_id = g.id))
    LIMIT 1
  `).get();
  res.json({
    ovd: ovd ? (ovd.shortname || ovd.display_name) : '-',
    opco: opco ? (opco.shortname || opco.display_name) : '-',
  });
});

// ---- API: Rollen ophalen (live van Discord) ----
app.get('/api/rollen/:userId', async (req, res) => {
  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const member = await guild.members.fetch(req.params.userId);
    const rollen = member.roles.cache
      .filter(r => r.name !== '@everyone')
      .sort((a, b) => b.position - a.position)
      .map(r => ({
        id: r.id,
        naam: r.name,
        kleur: r.hexColor === '#000000' ? '#99aab5' : r.hexColor,
      }));

    // Update ook de DB
    const { db } = require('./database');
    db.prepare('UPDATE gebruikers SET rollen = ? WHERE id = ?').run(JSON.stringify(rollen), req.params.userId);

    res.json(rollen);
  } catch (err) {
    // Fallback naar DB
    const { db } = require('./database');
    const row = db.prepare('SELECT rollen FROM gebruikers WHERE id = ?').get(req.params.userId);
    if (!row) return res.json([]);
    try { res.json(JSON.parse(row.rollen || '[]')); } catch { res.json([]); }
  }
});

// ---- API: Rol laten vallen (blijft in dienst als user) ----
app.post('/api/rol-laten-vallen', (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'Geen userId' });
  db.prepare("UPDATE gebruikers SET role = 'user' WHERE id = ?").run(userId);
  res.json({ success: true });
});

// ---- API: Alle tijden overzicht (voor OPS) ----
app.get('/api/tijden-overzicht', (req, res) => {
  const gebruikers = db.prepare('SELECT id, display_name, shortname FROM gebruikers').all();
  const rijen = db.prepare('SELECT user_id, categorie, week, start_tijd, eind_tijd FROM dienst_tijden ORDER BY week DESC').all();
  const totalen = {};
  rijen.forEach(r => {
    const ms = r.eind_tijd && r.start_tijd ? (r.eind_tijd - r.start_tijd) : 0;
    const key = `${r.user_id}_${r.categorie}_${r.week}`;
    if (!totalen[key]) totalen[key] = { user_id: r.user_id, categorie: r.categorie, week: r.week, ms: 0 };
    totalen[key].ms += ms;
  });
  const userMap = {};
  gebruikers.forEach(g => { userMap[g.id] = g.shortname || g.display_name; });
  const result = Object.values(totalen).map(t => ({
    user_id: t.user_id,
    naam: userMap[t.user_id] || t.user_id,
    categorie: t.categorie,
    week: t.week,
    uren: msNaarTijd(t.ms),
  })).sort((a, b) => b.week - a.week || a.naam.localeCompare(b.naam));
  res.json(result);
});

// ---- API: Dienst tijd verwijderen ----
app.delete('/api/tijden/:userId/:categorie/:week', (req, res) => {
  const { userId, categorie, week } = req.params;
  const door = req.query?.door || 'onbekend';
  // Als door een Discord ID is, naam opzoeken
  const doorNaam = /^\d{15,}$/.test(door)
    ? (() => { const d = db.prepare('SELECT shortname, display_name FROM gebruikers WHERE id = ?').get(door); return d?.shortname || d?.display_name || door; })()
    : door;
  const g = db.prepare('SELECT shortname, display_name FROM gebruikers WHERE id = ?').get(userId);
  const naam = g?.shortname || g?.display_name || userId;
  db.prepare('DELETE FROM dienst_tijden WHERE user_id = ? AND categorie = ? AND week = ?').run(userId, categorie, week);
  db.prepare('INSERT INTO logs (actie, door, details, tijd) VALUES (?, ?, ?, ?)').run(
    'uren_verwijderd', doorNaam, `${naam} | ${categorie} | Week ${week}`, Date.now()
  );
  res.json({ success: true });
});

// ---- API: Dienst tijden ophalen ----
app.get('/api/tijden/:userId', (req, res) => {
  const rijen = db.prepare('SELECT categorie, week, start_tijd, eind_tijd FROM dienst_tijden WHERE user_id = ? ORDER BY week DESC').all(req.params.userId);
  const result = { porto: [], opco: [], ovd: [], oc: [] };

  // Groepeer per categorie+week en tel op
  const totalen = {};
  rijen.forEach(r => {
    const ms = r.eind_tijd && r.start_tijd ? (r.eind_tijd - r.start_tijd) : 0;
    const key = `${r.categorie}_${r.week}`;
    if (!totalen[key]) totalen[key] = { categorie: r.categorie, week: r.week, ms: 0 };
    totalen[key].ms += ms;
  });

  Object.values(totalen).forEach(t => {
    if (result[t.categorie]) result[t.categorie].push({ week: t.week, uren: msNaarTijd(t.ms) });
  });

  // Sorteer per categorie op week DESC
  Object.keys(result).forEach(cat => result[cat].sort((a, b) => b.week - a.week));

  res.json(result);
});

function msNaarTijd(ms) {
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function getWeekNummer(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

function maakDienstNaam(roepnummer, g, rol) {
  const korteNaam = g?.shortname || g?.display_name || '';
  const icoon = g?.rangicoon ? g.rangicoon.trim() : '';
  const prefix = icoon ? `${roepnummer}-${icoon}` : roepnummer;
  const rolPrefix = rol === 'ovd' ? 'OVD-K ' : rol === 'opco' ? 'OpCo-K ' : rol === 'ops' ? 'OPS ' : '';
  return `${rolPrefix}[${prefix}] ${korteNaam}`.trim();
}

// ---- API: Reset gebruiker (uitdienst) ----
app.post('/api/reset/:userId', async (req, res) => {
  const userId = req.params.userId;
  const { indienstStart, dcnaam: dcnaamBody } = req.body;
  const gebruiker = db.prepare('SELECT indienst_start, role FROM gebruikers WHERE id = ?').get(userId);

  // Gebruik indienstStart uit body als fallback voor wat in DB staat
  const startTijd = gebruiker?.indienst_start || indienstStart || null;

  // Sla dienst tijd op
  if (startTijd) {
    const weekNr = getWeekNummer(new Date());
    const cat = ['ovd','opco','oc'].includes(gebruiker?.role) ? gebruiker.role : 'porto';
    db.prepare('INSERT INTO dienst_tijden (user_id, categorie, week, start_tijd, eind_tijd) VALUES (?, ?, ?, ?, ?)').run(userId, cat, weekNr, startTijd, Date.now());
  }

  db.prepare('DELETE FROM indelingen WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM aanmeld_wachtrij WHERE user_id = ?').run(userId);

  // Ontkoppel als gekoppeld
  const gKoppel = db.prepare('SELECT koppel_id FROM gebruikers WHERE id = ?').get(userId);
  if (gKoppel?.koppel_id) {
    db.prepare('UPDATE gebruikers SET koppel_id = NULL WHERE id = ?').run(gKoppel.koppel_id);
  }

  db.prepare('UPDATE gebruikers SET indienst_start = NULL, status = NULL, voertuig = NULL, voertuig_naam = NULL, role = \'user\', koppel_id = NULL WHERE id = ?').run(userId);

  // Herstel Discord naam naar [dienstnummer->] shortname
  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const member = await guild.members.fetch(userId);
    const g = db.prepare('SELECT shortname, display_name, dienstnummer, dcnaam FROM gebruikers WHERE id = ?').get(userId);
    console.log(`[RESET] userId=${userId} dcnaam="${g?.dcnaam}" dcnaamBody="${dcnaamBody}" shortname="${g?.shortname}"`);
    const dcnaam = (g?.dcnaam && g.dcnaam.trim()) ? g.dcnaam.trim() : (dcnaamBody && dcnaamBody.trim() ? dcnaamBody.trim() : null);
    const naam = dcnaam || g?.shortname || g?.display_name || null;
    await member.setNickname(naam);
  } catch (err) {
    console.error('Naam reset mislukt:', err.message);
  }

  res.json({ success: true });
});

// ---- API: Voice channel check ----
app.get('/api/voice/:userId', async (req, res) => {
  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const member = await guild.members.fetch(req.params.userId);
    const channel = member.voice.channel;
    res.json({
      inVoice: !!channel,
      channelName: channel ? channel.name : null,
      channelId: channel ? channel.id : null,
    });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// ---- Bekende call channels ----
const CALL_CHANNELS = {
  '1487069860004499477': 'Kmar1',
  '1487069880254464213': 'Kmar2',
  '1487069910487273522': 'Kmar3',
};

// ---- API: Actieve OVD/OPCO kandidaten ----
app.get('/api/kandidaten/:rol', (_req, res) => {
  const rol = _req.params.rol;
  const rolFilter = rol === 'ovd' ? '%OVD-K%' : rol === 'opco' ? '%OPCO-K%' : '%' + rol.toUpperCase() + '%';
  const kandidaten = db.prepare(`
    SELECT id, display_name, shortname FROM gebruikers
    WHERE indienst_start IS NOT NULL AND rollen LIKE ?
  `).all(rolFilter);
  res.json(kandidaten);
});

// ---- API: Rol toewijzen aan gebruiker ----
app.post('/api/rol-toewijzen', async (req, res) => {
  const { userId, nieuweRol, oudeRol } = req.body;
  if (!userId || !nieuweRol) return res.status(400).json({ error: 'Ontbrekende velden' });
  // Reset vorige persoon met die rol
  if (oudeRol) db.prepare("UPDATE gebruikers SET role = 'user' WHERE role = ? AND id != ?").run(oudeRol, userId);
  db.prepare('UPDATE gebruikers SET role = ? WHERE id = ?').run(nieuweRol, userId);

  // Update DC naam
  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const member = await guild.members.fetch(userId);
    const g = db.prepare('SELECT shortname, display_name, rangicoon, role, dienstnummer FROM gebruikers WHERE id = ?').get(userId);
    if (g?.dienstnummer) {
      await member.setNickname(maakDienstNaam(g.dienstnummer, g, nieuweRol));
    }
  } catch (err) { console.error('Naam rol-toewijzen mislukt:', err.message); }

  res.json({ success: true });
});

// ---- API: Specialisatie instellingen ----
app.get('/api/specialisaties', (_req, res) => {
  res.json(db.prepare('SELECT * FROM specialisatie_instellingen').all());
});
app.post('/api/specialisaties', (req, res) => {
  const { voertuig, max_eenheden, min_eenheden, tijdslot_start, tijdslot_eind, vereiste_rol } = req.body;
  db.prepare('UPDATE specialisatie_instellingen SET max_eenheden = ?, min_eenheden = ?, tijdslot_start = ?, tijdslot_eind = ?, vereiste_rol = ? WHERE voertuig = ?')
    .run(max_eenheden, min_eenheden || 0, tijdslot_start || null, tijdslot_eind || null, vereiste_rol || null, voertuig);
  res.json({ success: true });
});

// ---- API: Systeem instellingen ----
app.get('/api/instellingen-systeem', (_req, res) => {
  const rows = db.prepare('SELECT sleutel, waarde FROM systeem_instellingen').all();
  const obj = {};
  rows.forEach(r => obj[r.sleutel] = r.waarde);
  res.json(obj);
});
app.post('/api/instellingen-systeem', (req, res) => {
  Object.entries(req.body).forEach(([k, v]) => {
    db.prepare('INSERT OR REPLACE INTO systeem_instellingen (sleutel, waarde) VALUES (?, ?)').run(k, String(v));
  });
  res.json({ success: true });
});

// ---- API: Inactiviteit meldingen ----
app.get('/api/meldingen-inactiviteit', (req, res) => {
  const huidigeWeek = getWeekNummer(new Date());
  const vorigeWeek = huidigeWeek - 1;

  // Haal alle gebruikers op met Kmar rol
  const gebruikers = db.prepare("SELECT id, display_name, shortname, rollen FROM gebruikers WHERE rollen LIKE '%Kmar%'").all();

  const meldingen = gebruikers.filter(g => {
    // Check of ze de afgelopen week indienst zijn geweest
    const dienst = db.prepare('SELECT COUNT(*) as cnt FROM dienst_tijden WHERE user_id = ? AND week >= ?').get(g.id, vorigeWeek);
    return dienst.cnt === 0;
  }).map(g => ({
    naam: g.shortname || g.display_name,
    user_id: g.id,
  }));

  res.json(meldingen);
});

// ---- API: Logs ----
app.get('/api/logs', (_req, res) => {
  const logs = db.prepare('SELECT * FROM logs ORDER BY tijd DESC LIMIT 200').all();
  res.json(logs);
});

// ---- API: Gebruiker data ophalen ----
app.get('/api/me/:userId', (req, res) => {
  const g = db.prepare('SELECT * FROM gebruikers WHERE id = ?').get(req.params.userId);
  if (!g) return res.status(404).json({ error: 'Niet gevonden' });
  let rollen = [];
  try { rollen = JSON.parse(g.rollen || '[]'); } catch {}
  res.json({
    id: g.id,
    username: g.username,
    displayName: g.display_name,
    fullname: g.fullname,
    shortname: g.shortname,
    dcnaam: g.dcnaam,
    rangicoon: g.rangicoon,
    dienstnummer: g.dienstnummer,
    voertuig: g.voertuig,
    status: g.status,
    role: g.role,
    rollen,
    indienstStart: g.indienst_start,
    dienst: g.dienst,
  });
});

// ---- API: Rol check (voor polling) ----
app.get('/api/rol-check/:userId', (req, res) => {
  const g = db.prepare('SELECT role, dienstnummer, voertuig, indienst_start FROM gebruikers WHERE id = ?').get(req.params.userId);
  res.json({ role: g?.role || 'user', dienstnummer: g?.dienstnummer || '', voertuig: g?.voertuig || '', indienstStart: g?.indienst_start || null });
});

// ---- API: Verplaats gebruiker naar voice channel ----
app.post('/api/voice-move', async (req, res) => {
  const { userId, channelId } = req.body;
  if (!userId || !channelId) return res.status(400).json({ error: 'Ontbrekende velden' });
  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const member = await guild.members.fetch(userId);
    if (!member.voice.channelId) return res.status(400).json({ error: 'Gebruiker zit niet in een voice channel' });
    await member.voice.setChannel(channelId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- API: Koppelen ----
app.post('/api/koppel', async (req, res) => {
  const { userId1, userId2, roepnummer } = req.body;
  if (!userId1 || !userId2) return res.status(400).json({ error: 'Ontbrekende velden' });

  const ind1 = db.prepare('SELECT roepnummer, voertuig FROM indelingen WHERE user_id = ?').get(userId1);
  const ind2 = db.prepare('SELECT roepnummer, voertuig FROM indelingen WHERE user_id = ?').get(userId2);
  const gekozenRoep = roepnummer || ind1?.roepnummer;
  const voertuig = ind1?.voertuig || ind2?.voertuig || 'Noodhulp';

  if (!gekozenRoep) return res.status(400).json({ error: 'Geen roepnummer beschikbaar' });

  // Check max koppel
  const maxKoppelRow = db.prepare("SELECT waarde FROM systeem_instellingen WHERE sleutel = 'max_koppel'").get();
  const maxKoppel = parseInt(maxKoppelRow?.waarde || '2');
  const g1 = db.prepare('SELECT koppel_id FROM gebruikers WHERE id = ?').get(userId1);
  if (g1?.koppel_id) return res.status(400).json({ error: 'Eenheid is al gekoppeld' });

  // Koppel instellen
  db.prepare('UPDATE gebruikers SET koppel_id = ? WHERE id = ?').run(userId2, userId1);
  db.prepare('UPDATE gebruikers SET koppel_id = ? WHERE id = ?').run(userId1, userId2);

  // Beide krijgen hetzelfde roepnummer en voertuig
  for (const uid of [userId1, userId2]) {
    db.prepare(`INSERT INTO indelingen (user_id, roepnummer, voertuig, ingedeeld_door, tijd)
      VALUES (?, ?, ?, 'koppel', ?)
      ON CONFLICT(user_id) DO UPDATE SET roepnummer = excluded.roepnummer, voertuig = excluded.voertuig
    `).run(uid, gekozenRoep, voertuig, Date.now());
  }

  // Update DC namen van beide
  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    for (const uid of [userId1, userId2]) {
      const member = await guild.members.fetch(uid);
      const g = db.prepare('SELECT shortname, display_name, rangicoon, role FROM gebruikers WHERE id = ?').get(uid);
      await member.setNickname(maakDienstNaam(gekozenRoep, g, g?.role));
    }
  } catch (err) { console.error('Naam koppel update mislukt:', err.message); }

  res.json({ success: true });
});

// ---- API: Ontkoppelen ----
app.post('/api/ontkoppel', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'Geen userId' });
  const g = db.prepare('SELECT koppel_id, shortname, display_name, dienstnummer FROM gebruikers WHERE id = ?').get(userId);
  if (g?.koppel_id) {
    db.prepare('UPDATE gebruikers SET koppel_id = NULL WHERE id = ?').run(g.koppel_id);
  }
  db.prepare('UPDATE gebruikers SET koppel_id = NULL WHERE id = ?').run(userId);
  res.json({ success: true });
});

// ---- API: Actieve kandidaten voor koppelen ----
app.get('/api/koppel-kandidaten/:userId', (req, res) => {
  const kandidaten = db.prepare(`
    SELECT g.id, g.display_name, g.shortname, i.roepnummer
    FROM gebruikers g
    LEFT JOIN indelingen i ON g.id = i.user_id
    WHERE g.indienst_start IS NOT NULL AND g.id != ? AND g.koppel_id IS NULL
  `).all(req.params.userId);
  res.json(kandidaten);
});

// ---- API: Actieve eenheden ----
app.get('/api/eenheden', async (_req, res) => {
  const eenheden = db.prepare(`
    SELECT g.id, g.display_name, g.shortname, g.dienstnummer, g.voertuig, g.voertuig_naam, g.status, g.dienst,
           g.koppel_id, g.rollen, g.indienst_start, i.roepnummer, i.ingedeeld_door,
           k.shortname as koppel_naam, k.display_name as koppel_display, k.id as koppel_user_id
    FROM gebruikers g
    LEFT JOIN indelingen i ON g.id = i.user_id
    LEFT JOIN gebruikers k ON g.koppel_id = k.id
    WHERE g.indienst_start IS NOT NULL
  `).all();

  // Filter gekoppelde duplicaten
  const gefilterd = eenheden.filter(e => {
    if (!e.koppel_id) return true;
    return e.id < e.koppel_id;
  });

  res.json(gefilterd);
  console.log(`[EENHEDEN] ${gefilterd.length} eenheden:`, gefilterd.map(e => `${e.shortname||e.display_name} roep=${e.roepnummer} dienst=${e.dienstnummer}`));
});

// ---- API: Naam aanpassen in Discord ----
app.post('/api/setnaam', async (req, res) => {
  const { discordId, naam } = req.body;
  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const member = await guild.members.fetch(discordId);
    await member.setNickname(naam);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- API: Haal alle leden op ----
app.get('/api/leden', async (_req, res) => {
  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    await guild.members.fetch();
    const leden = guild.members.cache.map(m => ({
      id: m.id,
      username: m.user.username,
      displayName: m.displayName,
      avatar: m.user.displayAvatarURL({ size: 64 }),
      rollen: m.roles.cache.filter(r => r.name !== '@everyone').map(r => r.name),
    }));
    res.json(leden);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API draait op http://localhost:${PORT}`));
client.login(process.env.DISCORD_TOKEN);
