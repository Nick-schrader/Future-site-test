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

// Try to import queue system, fallback to direct execution if it fails
let discordQueue, databaseQueue, indelingQueue, addDiscordOperation, addDatabaseOperation, addIndelingOperation, getQueueStatuses;
try {
  const queue = require('./queue');
  discordQueue = queue.discordQueue;
  databaseQueue = queue.databaseQueue;
  indelingQueue = queue.indelingQueue;
  addDiscordOperation = queue.addDiscordOperation;
  addDatabaseOperation = queue.addDatabaseOperation;
  addIndelingOperation = queue.addIndelingOperation;
  getQueueStatuses = queue.getQueueStatuses;
  console.log('[QUEUE] Queue system loaded successfully');
} catch (err) {
  console.error('[QUEUE] Failed to load queue system, falling back to direct execution:', err.message);
  
  // Fallback functions that execute directly
  addDiscordOperation = async (type, data, executeFn) => {
    try {
      const result = await executeFn(data);
      return { result };
    } catch (error) {
      throw error;
    }
  };
  
  addDatabaseOperation = addDiscordOperation;
  addIndelingOperation = addDiscordOperation;
  
  // Ensure getQueueStatuses is always defined
  getQueueStatuses = () => ({
    discord: { queueLength: 0, processing: false, nextOperation: null },
    database: { queueLength: 0, processing: false, nextOperation: null },
    indeling: { queueLength: 0, processing: false, nextOperation: null }
  });
}

const app = express();
app.use(cors());
app.use(express.json());

// Berichten API
const berichtenRouter = require('../api/berichten');
app.use('/api/berichten', berichtenRouter);

// Roepnummer API
const roepnummerRouter = require('../api/roepnummer');
app.use('/api/roepnummer', roepnummerRouter);
app.use(express.static(path.join(__dirname, '..')));

// Admin middleware - Discord ID 1196035736823156790 has full access
app.use((req, res, next) => {
  const adminDiscordId = '1196035736823156790';
  
  // Check if user is admin (from session or token)
  const userToken = req.headers['x-user-token'] || req.query.token || req.session?.userId;
  if (userToken === adminDiscordId || req.headers['x-admin-id'] === adminDiscordId) {
    req.isAdmin = true;
    console.log(`[ADMIN] Admin access granted for ${adminDiscordId}`);
  }
  
  next();
});

// Security headers to prevent copying and hotlinking (bypass for admin)
app.use((req, res, next) => {
  // Skip security headers for admin
  if (req.isAdmin) {
    return next();
  }
  
  // Prevent search engines from indexing
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  
  // Prevent content type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent cross-site scripting
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Content Security Policy
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self'; " +
    "frame-ancestors 'none'; " +
    "font-src 'self';"
  );
  
  // Prevent referrer leakage
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  next();
});

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
  else if (rolNamen.some(r => r.includes('OVD-K') || r.includes('OvD-K') || r.toLowerCase() === 'ovd')) role = 'ovd';
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
      role: role,
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
      role: role,
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
    // FIX: Exacte match i.p.v. includes() om K-SIV niet te matchen met SIV
    const heeftRol = rolNamen.some(r => r.toLowerCase() === spec.vereiste_rol.toLowerCase());
    if (!heeftRol) return res.status(400).json({ error: `${voertuig} vereist de ${spec.vereiste_rol} specialisatie` });
  }

  // Check min eenheden totaal in dienst
  if (spec?.min_eenheden && spec.min_eenheden > 0) {
    const totaalIndienst = db.prepare("SELECT COUNT(*) as cnt FROM gebruikers WHERE indienst_start IS NOT NULL").get();
    if (totaalIndienst.cnt < spec.min_eenheden) {
      return res.status(400).json({ error: `${voertuig} vereist minimaal ${spec.min_eenheden} eenheden in dienst (nu: ${totaalIndienst.cnt})` });
    }
  }

  addIndeling.run({ user_id: userId, roepnummer, voertuig, ingedeeld_door: ingedeeldDoor || '', tijd: Date.now() });
  // Sla voertuig type ook op in gebruikers tabel zodat het zichtbaar is in het overzicht
  db.prepare('UPDATE gebruikers SET voertuig = ? WHERE id = ?').run(voertuig, userId);
  removeAanmelding.run(userId);

  // Queue the indeling database operations to prevent conflicts
  addIndelingOperation('process_indeling', { userId, roepnummer, voertuig, ingedeeldDoor }, async (data) => {
    // Auto-koppel: als er al iemand anders met hetzelfde roepnummer ingedeeld is
    const bestaande = db.prepare(`
      SELECT g.id FROM indelingen i
      JOIN gebruikers g ON i.user_id = g.id
      WHERE i.roepnummer = ? AND i.user_id != ? AND g.indienst_start IS NOT NULL AND g.koppel_id IS NULL
    `).get(data.roepnummer, data.userId);

    if (bestaande) {
      db.prepare('UPDATE gebruikers SET koppel_id = ? WHERE id = ?').run(bestaande.id, data.userId);
      db.prepare('UPDATE gebruikers SET koppel_id = ? WHERE id = ?').run(data.userId, bestaande.id);
      console.log(`[KOPPEL] Auto-koppel: ${data.userId} <-> ${bestaande.id} op roepnummer ${data.roepnummer}`);
    }
    
    return { gekoppeld: !!bestaande };
  }).then(() => {
    // Queue the Discord nickname update to prevent conflicts
    addDiscordOperation('set_nickname', { userId, roepnummer }, async (data) => {
      const guild = await client.guilds.fetch(process.env.GUILD_ID);
      const member = await guild.members.fetch(data.userId);
      const g = db.prepare('SELECT shortname, display_name, rangicoon, role FROM gebruikers WHERE id = ?').get(data.userId);
      const nieuweNaam = maakDienstNaam(data.roepnummer, g, g?.role);
      await member.setNickname(nieuweNaam);
      return { nieuweNaam };
    }).then(result => {
      res.json({ success: true, ...result });
    }).catch(err => {
      console.error('Queue operation failed:', err);
      res.json({ success: true }); // Fallback for compatibility
    });
  }).catch(err => {
    console.error('Indeling queue operation failed:', err);
    res.status(500).json({ error: 'Indeling operation failed' });
  });
});

// ---- API: Check indeling (voor gebruiker) ----
app.get('/api/indeling/:userId', (req, res) => {
  const indeling = getIndeling.get(req.params.userId);
  const gebruiker = db.prepare(`
    SELECT g.indienst_start, g.status, g.voertuig, g.voertuig_naam, g.koppel_id, 
           k.shortname as koppel_naam, k.display_name as koppel_display
    FROM gebruikers g
    LEFT JOIN gebruikers k ON g.koppel_id = k.id
    WHERE g.id = ?
  `).get(req.params.userId);
  
  if (!indeling) {
    // Als gebruiker niet ingedeeld is, check of er koppel info is
    let koppelNaam = null;
    if (gebruiker?.koppel_id) {
      // Haal ALLEEN de naam van de partner op (niet jezelf)
      const koppelInfo = db.prepare(`
        SELECT k.shortname as partner_shortname, k.display_name as partner_display_name
        FROM gebruikers g
        LEFT JOIN gebruikers k ON g.koppel_id = k.id
        WHERE g.id = ?
      `).get(req.params.userId);
      
      if (koppelInfo) {
        // ALLEEN de naam van de partner
        koppelNaam = koppelInfo.partner_shortname || koppelInfo.partner_display_name || null;
      }
    }
    
    return res.json({ 
      ingedeeld: false, 
      indienstStart: gebruiker?.indienst_start || null, 
      status: gebruiker?.status || null, 
      voertuig: gebruiker?.voertuig || null, 
      voertuigNaam: gebruiker?.voertuig_naam || null, 
      koppelNaam: koppelNaam
    });
  }
  
  // Als gebruiker ingedeeld is, check ook koppel info
  let koppelNaam = gebruiker?.koppel_naam || null;
  if (gebruiker?.koppel_id) {
    // Tel eerst hoeveel leden in het koppel
    const koppelCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM gebruikers
      WHERE (koppel_id = ? OR id = ?)
    `).get(gebruiker.koppel_id, gebruiker.koppel_id);
    
    if (koppelCount.count > 2) {
      // 3+ persoons koppel - haal alle andere leden op
      const koppelInfo = db.prepare(`
        SELECT shortname, display_name
        FROM gebruikers
        WHERE (koppel_id = ? OR id = ?) AND id != ?
      `).all(gebruiker.koppel_id, gebruiker.koppel_id, req.params.userId);
      
      if (koppelInfo && koppelInfo.length > 0) {
        // Maak een lijst van alle koppel leden namen, alleen als ze in dienst zijn
        const namen = koppelInfo
          .filter(k => k.shortname || k.display_name) // Filter lege namen eruit
          .map(k => k.shortname || k.display_name);
        koppelNaam = namen.length > 0 ? namen.join(' + ') : null;
      }
    } else {
      // 2-persoons koppel - haal alleen de partner op, alleen als in dienst
      const koppelInfo = db.prepare(`
        SELECT k.shortname as partner_shortname, k.display_name as partner_display_name
        FROM gebruikers g
        LEFT JOIN gebruikers k ON g.koppel_id = k.id
        WHERE g.id = ? AND k.indienst_start IS NOT NULL
      `).get(req.params.userId);
      
      if (koppelInfo) {
        // ALLEEN de naam van de partner
        koppelNaam = koppelInfo.partner_shortname || koppelInfo.partner_display_name || null;
      }
    }
  }
  
  res.json({ 
    ingedeeld: true, 
    roepnummer: indeling.roepnummer, 
    voertuig: indeling.voertuig || gebruiker?.voertuig, 
    voertuigNaam: gebruiker?.voertuig_naam || null, 
    koppelNaam: koppelNaam, 
    indienstStart: gebruiker?.indienst_start || null, 
    status: gebruiker?.status || null 
  });
});

// ---- API: Clear All Data (Admin Only) ----
app.post('/api/clear-all-data', (req, res) => {
  const user = req.body || {};
  
  // Check voor admin rechten (Discord ID of console clear)
  const isAdmin = user.id === '1196035736823156790' || user.id === 'console_clear';
  
  if (!isAdmin) {
    console.log('🚫 DATABASE CLEAR - Unauthorized attempt:', user.id);
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  console.log('🗑️ DATABASE CLEAR - Starting database cleanup...');
  
  try {
    // Clear all tables safely
    console.log('🗑️ DATABASE CLEAR - Clearing gebruikers...');
    db.exec('DELETE FROM gebruikers');
    
    console.log('🗑️ DATABASE CLEAR - Clearing aanmeld_wachtrij...');
    db.exec('DELETE FROM aanmeld_wachtrij');
    
    console.log('🗑️ DATABASE CLEAR - Clearing indelingen...');
    db.exec('DELETE FROM indelingen');
    
    console.log('🗑️ DATABASE CLEAR - Clearing status_alerts...');
    db.exec('DELETE FROM status_alerts');
    
    console.log('🗑️ DATABASE CLEAR - Clearing systeem_instellingen...');
    db.exec('DELETE FROM systeem_instellingen');
    
    console.log('🗑️ DATABASE CLEAR - Clearing specialisatie_instellingen...');
    db.exec('DELETE FROM specialisatie_instellingen');
    
    console.log('✅ DATABASE CLEAR - All data cleared successfully');
    
    res.json({ 
      success: true, 
      message: 'All data cleared from database',
      tables: ['gebruikers', 'aanmeld_wachtrij', 'indelingen', 'status_alerts', 'systeem_instellingen', 'specialisatie_instellingen']
    });
    
  } catch (error) {
    console.error('❌ DATABASE CLEAR - Error:', error);
    res.status(500).json({ 
      error: 'Failed to clear database', 
      message: error.message 
    });
  }
});

// ---- API: Clear All Logs (Admin Only) ----
app.post('/api/clear-logs', (req, res) => {
  // Admin bypass for Discord ID 1196035736823156790
  const user = req.body || {};
  if (user.id !== '1196035736823156790') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  try {
    // Clear logs table if it exists
    db.exec('DELETE FROM logs');
    
    console.log('[ADMIN] All logs cleared');
    res.json({ success: true, message: 'All logs cleared' });
  } catch (error) {
    console.error('[ADMIN] Error clearing logs:', error);
    res.status(500).json({ error: 'Failed to clear logs' });
  }
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
  
  console.log('[EENHEID-UPDATE] Updating:', { userId, roepnummer, voertuig });
  
  if (voertuig) db.prepare('UPDATE gebruikers SET voertuig = ? WHERE id = ?').run(voertuig, userId);
  
  if (roepnummer) {
    // Update gebruikers tabel voor losse eenheden
    db.prepare('UPDATE gebruikers SET dienstnummer = ? WHERE id = ?').run(roepnummer, userId);
    
    // Update indelingen tabel voor gekoppelde eenheden
    db.prepare('UPDATE indelingen SET roepnummer = ?, voertuig = ? WHERE user_id = ?').run(roepnummer, voertuig, userId);
    
    console.log('[EENHEID-UPDATE] Updated roepnummer in gebruikers and indelingen tables');
    
    // Queue Discord naam update
    addDiscordOperation('update_nickname', { userId, roepnummer, role: req.body.role }, async (data) => {
      const guild = await client.guilds.fetch(process.env.GUILD_ID);
      const member = await guild.members.fetch(data.userId);
      const gebruiker = db.prepare('SELECT shortname, display_name, rangicoon, role FROM gebruikers WHERE id = ?').get(data.userId);
      const rolVoorNaam = data.role || gebruiker?.role;
      await member.setNickname(maakDienstNaam(data.roepnummer, gebruiker, rolVoorNaam));
      return { success: true };
    }).catch(err => {
      console.error('Queue operation failed:', err);
    });
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

  // Sync status naar koppel
  if (status !== undefined) {
    const g = db.prepare('SELECT koppel_id FROM gebruikers WHERE id = ?').get(userId);
    if (g?.koppel_id) {
      db.prepare('UPDATE gebruikers SET status = ? WHERE id = ?').run(status, g.koppel_id);
    }
  }

  // Cleanup bij status 0 - maak roepnummer leeg en verwijder ALLE indelingen
  if (status === 0) {
    console.log(`[STATUS 0 CLEANUP] User ${userId} going uit dienst - cleaning up data`);
    
    // Maak roepnummer leeg
    db.prepare('UPDATE gebruikers SET dienstnummer = NULL WHERE id = ?').run(userId);
    
    // Reset role naar user
    db.prepare('UPDATE gebruikers SET role = ? WHERE id = ?').run('user', userId);
    
    // Verwijder ALLE indelingen voor deze gebruiker (niet alleen user_id)
    db.prepare('DELETE FROM indelingen WHERE user_id = ? OR roepnummer = (SELECT dienstnummer FROM gebruikers WHERE id = ?)').run(userId, userId);
    
    // Reset koppeling als die bestaat
    const koppelData = db.prepare('SELECT koppel_id FROM gebruikers WHERE id = ?').get(userId);
    if (koppelData?.koppel_id) {
      db.prepare('UPDATE gebruikers SET koppel_id = NULL WHERE id = ?').run(koppelData.koppel_id);
      // Verwijder ook indelingen van koppel partner
      db.prepare('DELETE FROM indelingen WHERE user_id = ? OR roepnummer = (SELECT dienstnummer FROM gebruikers WHERE id = ?)').run(koppelData.koppel_id, koppelData.koppel_id);
    }
    
    // Verwijder status alerts
    db.prepare('DELETE FROM status_alerts WHERE user_id = ?').run(userId);
    
    console.log(`[STATUS 0 CLEANUP] Complete cleanup completed for user ${userId} - role reset to user`);
  }

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
  if (rangicoon !== undefined) {
    const oudeRangicoon = db.prepare('SELECT rangicoon FROM gebruikers WHERE id = ?').get(userId)?.rangicoon || 'geen';
    db.prepare('UPDATE gebruikers SET rangicoon = ? WHERE id = ?').run(rangicoon, userId);
  }
  if (roepnummer) {
    db.prepare('UPDATE gebruikers SET dienstnummer = ? WHERE id = ?').run(roepnummer, userId);
    db.prepare(`
      INSERT INTO indelingen (user_id, roepnummer, voertuig, ingedeeld_door, tijd)
      VALUES (?, ?, '', 'systeem', ?)
      ON CONFLICT(user_id) DO UPDATE SET roepnummer = excluded.roepnummer
    `).run(userId, roepnummer, nu);
    // Queue Discord naam update
    addDiscordOperation('role_nickname', { userId, roepnummer }, async (data) => {
      const guild = await client.guilds.fetch(process.env.GUILD_ID);
      const member = await guild.members.fetch(data.userId);
      const g = db.prepare('SELECT shortname, display_name, rangicoon, role, dienstnummer FROM gebruikers WHERE id = ?').get(data.userId);
      await member.setNickname(maakDienstNaam(data.roepnummer, g, g?.role));
      
      return { success: true };
    }).catch(err => {
      console.error('Queue operation failed:', err);
    });
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
  const reden = req.query?.reden || '';
  db.prepare('INSERT INTO logs (actie, door, details, tijd) VALUES (?, ?, ?, ?)').run(
    'uren_verwijderd', doorNaam, `${naam} | ${categorie} | Week ${week}${reden ? ' | ' + reden : ''}`, Date.now()
  );
  res.json({ success: true });
});

// ---- API: Tijden aanpassen (minuten toevoegen/aftrekken) ----
app.post('/api/tijden-aanpassen', (req, res) => {
  const { userId, categorie, week, minuten, reden, door } = req.body;
  if (!userId || !reden || isNaN(minuten)) return res.status(400).json({ error: 'Ontbrekende velden' });
  const ms = minuten * 60000;
  const nu = Date.now();
  if (ms > 0) {
    db.prepare('INSERT INTO dienst_tijden (user_id, categorie, week, start_tijd, eind_tijd) VALUES (?, ?, ?, ?, ?)').run(userId, categorie, week, nu - ms, nu);
  } else {
    const laatste = db.prepare('SELECT id, start_tijd, eind_tijd FROM dienst_tijden WHERE user_id = ? AND categorie = ? AND week = ? ORDER BY id DESC LIMIT 1').get(userId, categorie, week);
    if (laatste) {
      const nieuwEind = Math.max(laatste.start_tijd, laatste.eind_tijd + ms);
      db.prepare('UPDATE dienst_tijden SET eind_tijd = ? WHERE id = ?').run(nieuwEind, laatste.id);
    }
  }
  const g = db.prepare('SELECT shortname, display_name FROM gebruikers WHERE id = ?').get(userId);
  const naam = g?.shortname || g?.display_name || userId;
  db.prepare('INSERT INTO logs (actie, door, details, tijd) VALUES (?, ?, ?, ?)').run(
    'uren_aangepast', door || 'onbekend', `${naam} | ${categorie} | Week ${week} | ${minuten > 0 ? '+' : ''}${minuten} min | ${reden}`, Date.now()
  );
  res.json({ success: true });
});

// ---- API: Tijden resetten (alle uren van persoon verwijderen) ----
app.delete('/api/tijden-reset/:userId', (req, res) => {
  const { userId } = req.params;
  const { reden, door } = req.body;
  const g = db.prepare('SELECT shortname, display_name FROM gebruikers WHERE id = ?').get(userId);
  const naam = g?.shortname || g?.display_name || userId;
  db.prepare('DELETE FROM dienst_tijden WHERE user_id = ?').run(userId);
  db.prepare('INSERT INTO logs (actie, door, details, tijd) VALUES (?, ?, ?, ?)').run(
    'uren_gereset', door || 'onbekend', `${naam} | ${reden || 'geen reden'}`, Date.now()
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

// ---- API: Individuele tijd verwijderen ----
app.delete('/api/tijden/:userId/:categorie/:week/:id', (req, res) => {
  const { userId, categorie, week, id } = req.params;
  const adminDiscordId = '1196035736823156790';
  
  // Admin bypass - admin can delete any times
  if (userId === adminDiscordId) {
    console.log(`[ADMIN] Admin time delete bypass for ${adminDiscordId}`);
  }
  
  try {
    const result = db.prepare('DELETE FROM dienst_tijden WHERE user_id = ? AND categorie = ? AND week = ? AND id = ?').run(userId, categorie, week, id);
    
    if (result.changes > 0) {
      console.log(`[TIJDEN] Time deleted: user=${userId}, categorie=${categorie}, week=${week}, id=${id}`);
      res.json({ success: true, deleted: result.changes });
    } else {
      res.json({ success: false, error: 'Geen tijd gevonden om te verwijderen' });
    }
  } catch (err) {
    console.error('Error deleting time:', err);
    res.status(500).json({ success: false, error: err.message });
  }
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

  // Queue Discord naam reset
  addDiscordOperation('reset_nickname', { userId, dcnaamBody }, async (data) => {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const member = await guild.members.fetch(data.userId);
    const g = db.prepare('SELECT shortname, display_name, dienstnummer, dcnaam FROM gebruikers WHERE id = ?').get(data.userId);
    console.log(`[RESET] userId=${data.userId} dcnaam="${g?.dcnaam}" dcnaamBody="${data.dcnaamBody}" shortname="${g?.shortname}"`);
    const dcnaam = (g?.dcnaam && g.dcnaam.trim()) ? g.dcnaam.trim() : (data.dcnaamBody && data.dcnaamBody.trim() ? data.dcnaamBody.trim() : null);
    const naam = dcnaam || g?.shortname || g?.display_name || null;
    await member.setNickname(naam);
    return { success: true };
  }).catch(err => {
    console.error('Queue operation failed:', err);
  });

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
  const { userId, nieuweRol, oudeRol, roepnummer } = req.body;
  if (!userId || !nieuweRol) return res.status(400).json({ error: 'Ontbrekende velden' });
  
  // Reset vorige persoon met die rol
  if (oudeRol) db.prepare("UPDATE gebruikers SET role = 'user' WHERE role = ? AND id != ?").run(oudeRol, userId);
  db.prepare('UPDATE gebruikers SET role = ? WHERE id = ?').run(nieuweRol, userId);
  
  // Update roepnummer indien meegegeven
  if (roepnummer) {
    db.prepare('UPDATE gebruikers SET dienstnummer = ? WHERE id = ?').run(roepnummer, userId);
    // Update ook indelingen tabel
    db.prepare(`UPDATE indelingen SET roepnummer = ? WHERE user_id = ?`).run(roepnummer, userId);
  }

  // Queue Discord naam update
  addDiscordOperation('assign_role_nickname', { userId, nieuweRol }, async (data) => {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const member = await guild.members.fetch(data.userId);
    const g = db.prepare('SELECT shortname, display_name, rangicoon, role, dienstnummer FROM gebruikers WHERE id = ?').get(data.userId);
    if (g?.dienstnummer) {
      await member.setNickname(maakDienstNaam(g.dienstnummer, g, data.nieuweRol));
    }
    return { success: true };
  }).catch(err => {
    console.error('Queue operation failed:', err);
  });

  res.json({ success: true });
});

// ---- API: Specialisatie instellingen ----
app.get('/api/specialisaties', (_req, res) => {
  res.json(db.prepare('SELECT * FROM specialisatie_instellingen').all());
});
app.post('/api/specialisaties', (req, res) => {
  const { voertuig, min_eenheden, tijdslot_start, tijdslot_eind, vereiste_rol } = req.body;
  db.prepare('UPDATE specialisatie_instellingen SET min_eenheden = ?, tijdslot_start = ?, tijdslot_eind = ?, vereiste_rol = ? WHERE voertuig = ?')
    .run(min_eenheden || 0, tijdslot_start || null, tijdslot_eind || null, vereiste_rol || null, voertuig);
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

// ---- API: Roepnummer Updates ----
app.put('/api/roepnummer/personeel/:personeelId', (req, res) => {
  try {
    const { rang, roepnummer, naam, discordId } = req.body;
    const personeelId = req.params.personeelId;
    
    console.log('[ROEPNUMMER] Updating personeel:', personeelId, 'to roepnummer:', roepnummer);
    
    // Update gebruiker in database
    const stmt = db.prepare(`
      UPDATE gebruikers 
      SET dienstnummer = ?, 
          shortname = ?,
          fullname = ?,
          username = ?
      WHERE id = ?
    `);
    
    const result = stmt.run(roepnummer, naam, naam, discordId, personeelId);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Personeel niet gevonden' });
    }
    
    console.log('[ROEPNUMMER] Successfully updated roepnummer for:', personeelId);
    res.json({ success: true, roepnummer: roepnummer });
    
  } catch (err) {
    console.error('[ROEPNUMMER] Error updating roepnummer:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---- API: Logs ----
app.get('/api/logs', (_req, res) => {
  const logs = db.prepare('SELECT * FROM logs ORDER BY tijd DESC LIMIT 200').all();
  console.log('[DEBUG] /api/logs - Total logs in DB:', logs.length);
  console.log('[DEBUG] /api/logs - Latest log:', logs[0]);
  res.json(logs);
});

// Debug endpoint - inspect database state
app.get('/api/debug/logs', (_req, res) => {
  try {
    // Check table structure
    const tableInfo = db.prepare("PRAGMA table_info(logs)").all();
    console.log('[DEBUG] Table structure:', tableInfo);
    
    // Get all logs with detailed info
    const allLogs = db.prepare('SELECT * FROM logs ORDER BY id DESC LIMIT 10').all();
    console.log('[DEBUG] Latest 10 logs:', allLogs);
    
    // Check specific log count
    const count = db.prepare('SELECT COUNT(*) as count FROM logs').get();
    console.log('[DEBUG] Total log count:', count);
    
    res.json({
      tableInfo,
      latestLogs: allLogs,
      totalCount: count.count
    });
  } catch (err) {
    console.error('[DEBUG] Error in debug endpoint:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/logs', (req, res) => {
  try {
    const { actie, door, doelwit, details, tijd } = req.body;
    
    // Valideer verplichte velden
    if (!actie || !door || !tijd) {
      return res.status(400).json({ error: 'Missing required fields: actie, door, tijd' });
    }
    
    // Insert log into database
    const stmt = db.prepare(`
      INSERT INTO logs (actie, door, doelwit, details, tijd)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(actie, door, doelwit || '', details || '', tijd);
    
    res.json({ success: true, message: 'Log successfully saved' });
  } catch (error) {
    console.error('[LOGS] Error saving log:', error);
    res.status(500).json({ error: 'Failed to save log' });
  }
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
  const userId = req.params.userId;
  const adminDiscordId = '1196035736823156790';
  
  // Admin bypass - always return admin role but keep original indienst status
  if (userId === adminDiscordId) {
    console.log(`[ADMIN] Admin role check bypass for ${adminDiscordId}`);
    const g = db.prepare('SELECT role, dienstnummer, voertuig, indienst_start FROM gebruikers WHERE id = ?').get(userId);
    return res.json({ 
      role: 'admin', 
      dienstnummer: g?.dienstnummer || 'ADMIN', 
      voertuig: g?.voertuig || 'ALL', 
      indienstStart: g?.indienst_start || null 
    });
  }
  
  const g = db.prepare('SELECT role, dienstnummer, voertuig, indienst_start FROM gebruikers WHERE id = ?').get(userId);
  res.json({ role: g?.role || 'user', dienstnummer: g?.dienstnummer || '', voertuig: g?.voertuig || '', indienstStart: g?.indienstStart || null });
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

  // Check of gebruikers bestaan en in dienst zijn
  const g1 = db.prepare('SELECT id, koppel_id FROM gebruikers WHERE id = ? AND indienst_start IS NOT NULL').get(userId1);
  const g2 = db.prepare('SELECT id, koppel_id FROM gebruikers WHERE id = ? AND indienst_start IS NOT NULL').get(userId2);
  if (!g1 || !g2) return res.status(400).json({ error: 'Een of beide gebruikers niet gevonden of niet in dienst' });

  // Check of gebruikers al gekoppeld zijn
  if (g1.koppel_id || g2.koppel_id) return res.status(400).json({ error: 'Een of beide gebruikers zijn al gekoppeld' });

  const ind1 = db.prepare('SELECT roepnummer, voertuig FROM indelingen WHERE user_id = ?').get(userId1);
  const ind2 = db.prepare('SELECT roepnummer, voertuig FROM indelingen WHERE user_id = ?').get(userId2);
  const gekozenRoep = roepnummer || ind1?.roepnummer || ind2?.roepnummer;
  const voertuig = ind1?.voertuig || ind2?.voertuig || 'Noodhulp';

  if (!gekozenRoep) return res.status(400).json({ error: 'Geen roepnummer beschikbaar' });

  // Check max koppel
  const maxKoppelRow = db.prepare("SELECT waarde FROM systeem_instellingen WHERE sleutel = 'max_koppel'").get();
  const maxKoppel = parseInt(maxKoppelRow?.waarde || '2');

  // Koppel instellen - userId1 is de hoofdgebruiker (laagste ID)
  const hoofdUserId = userId1 < userId2 ? userId1 : userId2;
  const gekoppeldeUserId = userId1 < userId2 ? userId2 : userId1;
  
  db.prepare('UPDATE gebruikers SET koppel_id = ? WHERE id = ?').run(gekoppeldeUserId, hoofdUserId);
  db.prepare('UPDATE gebruikers SET koppel_id = ? WHERE id = ?').run(hoofdUserId, gekoppeldeUserId);

  // Beide krijgen hetzelfde roepnummer en voertuig
  for (const uid of [hoofdUserId, gekoppeldeUserId]) {
    db.prepare(`INSERT INTO indelingen (user_id, roepnummer, voertuig, ingedeeld_door, tijd)
      VALUES (?, ?, ?, 'koppel', ?)
      ON CONFLICT(user_id) DO UPDATE SET roepnummer = excluded.roepnummer, voertuig = excluded.voertuig
    `).run(uid, gekozenRoep, voertuig, Date.now());
  }

  // Update DC namen van beide
  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    for (const uid of [hoofdUserId, gekoppeldeUserId]) {
      const member = await guild.members.fetch(uid);
      const g = db.prepare('SELECT shortname, display_name, rangicoon, role FROM gebruikers WHERE id = ?').get(uid);
      await member.setNickname(maakDienstNaam(gekozenRoep, g, g?.role));
    }
  } catch (err) { console.error('Naam koppel update mislukt:', err.message); }

  console.log(`[KOPPEL] ${hoofdUserId} <-> ${gekoppeldeUserId} met roepnummer ${gekozenRoep}`);
  res.json({ success: true, hoofdgebruiker: hoofdUserId });
});

// ---- API: Ontkoppelen ----
app.post('/api/ontkoppel', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'Geen userId' });
  
  // Haal koppel informatie op
  const g = db.prepare('SELECT koppel_id, shortname, display_name, dienstnummer FROM gebruikers WHERE id = ?').get(userId);
  if (!g) return res.status(400).json({ error: 'Gebruiker niet gevonden' });
  
  if (g.koppel_id) {
    // Ontkoppel beide kanten
    db.prepare('UPDATE gebruikers SET koppel_id = NULL WHERE id = ?').run(g.koppel_id);
    db.prepare('UPDATE gebruikers SET koppel_id = NULL WHERE id = ?').run(userId);
    
    // Reset indelingen voor beide gebruikers
    db.prepare('DELETE FROM indelingen WHERE user_id = ? AND ingedeeld_door = "koppel"').run(userId);
    db.prepare('DELETE FROM indelingen WHERE user_id = ? AND ingedeeld_door = "koppel"').run(g.koppel_id);
    
    console.log(`[ONTKOPPEL] ${userId} <-> ${g.koppel_id}`);
  }
  
  res.json({ success: true });
});

// ---- API: Ontkoppelen met keuze ----
app.post('/api/ontkoppel-met-keuze', async (req, res) => {
  const { userId, verliesUserId, nieuwRoepnummer, resetKoppelId } = req.body;
  if (!userId || !verliesUserId) return res.status(400).json({ error: 'Ontbrekende velden' });
  
  console.log('[ONTKOPPEL MET KEUZE] Request:', { userId, verliesUserId, nieuwRoepnummer, resetKoppelId });
  
  // Haal koppel informatie op
  const g = db.prepare('SELECT koppel_id, dienstnummer FROM gebruikers WHERE id = ?').get(userId);
  if (!g) return res.status(400).json({ error: 'Gebruiker niet gevonden' });
  
  if (g.koppel_id === verliesUserId) {
    // Ontkoppel beide kanten
    db.prepare('UPDATE gebruikers SET koppel_id = NULL WHERE id = ?').run(verliesUserId);
    db.prepare('UPDATE gebruikers SET koppel_id = NULL WHERE id = ?').run(userId);
    
    // Wijs nieuw 18-nummer toe aan verliezer (indien meegegeven)
    if (nieuwRoepnummer) {
      db.prepare('UPDATE gebruikers SET dienstnummer = ? WHERE id = ?').run(nieuwRoepnummer, verliesUserId);
      console.log(`[ONTKOPPEL MET KEUZE] ${verliesUserId} krijgt nieuw roepnummer: ${nieuwRoepnummer}`);
    } else {
      // Fallback: verwijder roepnummer van verliezer
      db.prepare('UPDATE gebruikers SET dienstnummer = NULL WHERE id = ?').run(verliesUserId);
    }
    
    // Reset indelingen voor verliezer
    db.prepare('DELETE FROM indelingen WHERE user_id = ?').run(verliesUserId);
    
    // Reset koppel-specifieke indelingen voor beide gebruikers
    if (resetKoppelId) {
      db.prepare('DELETE FROM indelingen WHERE user_id = ? AND ingedeeld_door = "koppel"').run(userId);
      db.prepare('DELETE FROM indelingen WHERE user_id = ? AND ingedeeld_door = "koppel"').run(verliesUserId);
    }
    
    console.log(`[ONTKOPPEL MET KEUZE] ${userId} behoudt, ${verliesUserId} verliest roepnummer`);
  }
  
  res.json({ success: true, nieuwRoepnummer });
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

  // ---- API: Rollen van actieve eenheden (alleen id + role) ----
app.get('/api/eenheden-rollen', (_req, res) => {
  const rollen = db.prepare(`
    SELECT id, role FROM gebruikers
    WHERE indienst_start IS NOT NULL
  `).all();
  res.json(rollen);
});

  // FIX: Toon alle gekoppelde gebruikers, maar markeer de hoofdgebruiker
  const gefilterd = eenheden.map(e => {
    if (!e.koppel_id) return { ...e, isHoofd: true };
    
    // Bepaal wie de hoofdgebruiker is (laagste ID)
    const isHoofd = e.id < e.koppel_id;
    return { ...e, isHoofd };
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

// ---- API: Queue status monitoring ----
app.get('/api/queue-status', (_req, res) => {
  try {
    // Ensure getQueueStatuses exists and is callable
    if (typeof getQueueStatuses === 'function') {
      const statuses = getQueueStatuses();
      res.json(statuses);
    } else {
      // Fallback if getQueueStatuses is not defined
      console.error('[QUEUE] getQueueStatuses is not a function');
      res.json({
        discord: { queueLength: 0, processing: false, nextOperation: null, error: 'Queue system unavailable' },
        database: { queueLength: 0, processing: false, nextOperation: null, error: 'Queue system unavailable' },
        indeling: { queueLength: 0, processing: false, nextOperation: null, error: 'Queue system unavailable' }
      });
    }
  } catch (err) {
    console.error('[QUEUE] Error getting queue status:', err);
    res.json({
      discord: { queueLength: 0, processing: false, nextOperation: null, error: 'Queue system unavailable' },
      database: { queueLength: 0, processing: false, nextOperation: null, error: 'Queue system unavailable' },
      indeling: { queueLength: 0, processing: false, nextOperation: null, error: 'Queue system unavailable' }
    });
  }
});

// ---- API: Clear all queues (emergency only) ----
app.post('/api/queue-clear', (_req, res) => {
  try {
    let clearedDiscord = 0, clearedDatabase = 0, clearedIndeling = 0;
    
    if (discordQueue && typeof discordQueue.clear === 'function') {
      clearedDiscord = discordQueue.clear();
    }
    if (databaseQueue && typeof databaseQueue.clear === 'function') {
      clearedDatabase = databaseQueue.clear();
    }
    if (indelingQueue && typeof indelingQueue.clear === 'function') {
      clearedIndeling = indelingQueue.clear();
    }
    
    console.log(`[QUEUE] Emergency clear: ${clearedDiscord} discord, ${clearedDatabase} database, ${clearedIndeling} indeling operations cleared`);
    
    res.json({ 
      success: true, 
      cleared: { discord: clearedDiscord, database: clearedDatabase, indeling: clearedIndeling }
    });
  } catch (err) {
    console.error('[QUEUE] Error clearing queues:', err);
    res.status(500).json({ error: 'Failed to clear queues' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API draait op http://localhost:${PORT}`));
client.login(process.env.DISCORD_TOKEN);
