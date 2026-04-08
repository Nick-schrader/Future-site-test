const Database = require('better-sqlite3');
const path = require('path');

// Gebruik persistent volume pad als beschikbaar (Railway/Render), anders lokaal
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'porto.db');
const db = new Database(DB_PATH);
console.log('[DB] Database pad:', DB_PATH);

// Tabellen aanmaken
db.exec(`
  CREATE TABLE IF NOT EXISTS gebruikers (
    id TEXT PRIMARY KEY,
    username TEXT,
    display_name TEXT,
    avatar TEXT,
    dienst TEXT,
    role TEXT DEFAULT 'user',
    fullname TEXT,
    shortname TEXT,
    dsi TEXT,
    dienstnummer TEXT,
    phone TEXT,
    refresh INTEGER DEFAULT 200,
    streamer INTEGER DEFAULT 0,
    naam_lock INTEGER DEFAULT 0,
    indienst_start INTEGER,
    ingedeeld INTEGER DEFAULT 0,
    voertuig TEXT,
    status INTEGER,
    rollen TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS aanmeld_wachtrij (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    naam TEXT,
    bijzonderheden TEXT,
    tijd INTEGER,
    UNIQUE(user_id)
  );

  CREATE TABLE IF NOT EXISTS indelingen (
  
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    roepnummer TEXT,
    voertuig TEXT,
    ingedeeld_door TEXT,
    tijd INTEGER,
    UNIQUE(user_id)
  );

  CREATE TABLE IF NOT EXISTS dienst_tijden (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    categorie TEXT,
    week INTEGER,
    start_tijd INTEGER,
    eind_tijd INTEGER
  );

  CREATE TABLE IF NOT EXISTS berichten (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('promotie', 'demotie', 'roepnummer', 'ontslag')),
    bericht TEXT NOT NULL,
    tijd TEXT NOT NULL,
    gelezen INTEGER DEFAULT 0
  );
`);

// Migraties: kolommen toevoegen als ze nog niet bestaan
const bestaandeKolommen = db.prepare("PRAGMA table_info(gebruikers)").all().map(k => k.name);
if (!bestaandeKolommen.includes('rollen')) {
  db.exec("ALTER TABLE gebruikers ADD COLUMN rollen TEXT DEFAULT '[]'");
}
if (!bestaandeKolommen.includes('koppel_id')) {
  db.exec("ALTER TABLE gebruikers ADD COLUMN koppel_id TEXT");
}
if (!bestaandeKolommen.includes('dcnaam')) {
  db.exec("ALTER TABLE gebruikers ADD COLUMN dcnaam TEXT");
}
if (!bestaandeKolommen.includes('rangicoon')) {
  db.exec("ALTER TABLE gebruikers ADD COLUMN rangicoon TEXT");
}
if (!bestaandeKolommen.includes('voertuig_naam')) {
  db.exec("ALTER TABLE gebruikers ADD COLUMN voertuig_naam TEXT");
}

// Status alerts tabel
db.exec(`
  CREATE TABLE IF NOT EXISTS status_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    naam TEXT,
    status INTEGER,
    tijd INTEGER
  );
`);

// Logs tabel
db.exec(`
  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actie TEXT,
    door TEXT,
    details TEXT,
    tijd INTEGER
  );
`);

// ---- Gebruikers ----
const upsertGebruiker = db.prepare(`
  INSERT INTO gebruikers (id, username, display_name, avatar, dienst, role, fullname, rollen)
  VALUES (@id, @username, @display_name, @avatar, @dienst, @role, @fullname, @rollen)
  ON CONFLICT(id) DO UPDATE SET
    username = excluded.username,
    display_name = excluded.display_name,
    avatar = excluded.avatar,
    dienst = excluded.dienst,
    role = excluded.role,
    rollen = excluded.rollen
`);

const getGebruiker = db.prepare('SELECT * FROM gebruikers WHERE id = ?');

const updateGebruikerInstellingen = db.prepare(`
  UPDATE gebruikers SET
    fullname = @fullname, shortname = @shortname, dcnaam = @dcnaam, rangicoon = @rangicoon
  WHERE id = @id
`);

// ---- Aanmeld wachtrij ----
const addAanmelding = db.prepare(`
  INSERT INTO aanmeld_wachtrij (user_id, naam, bijzonderheden, tijd)
  VALUES (@user_id, @naam, @bijzonderheden, @tijd)
  ON CONFLICT(user_id) DO UPDATE SET
    bijzonderheden = excluded.bijzonderheden,
    tijd = excluded.tijd
`);

const getWachtrij = db.prepare('SELECT * FROM aanmeld_wachtrij ORDER BY tijd ASC');
const removeAanmelding = db.prepare('DELETE FROM aanmeld_wachtrij WHERE user_id = ?');

// ---- Indelingen ----
const addIndeling = db.prepare(`
  INSERT INTO indelingen (user_id, roepnummer, voertuig, ingedeeld_door, tijd)
  VALUES (@user_id, @roepnummer, @voertuig, @ingedeeld_door, @tijd)
  ON CONFLICT(user_id) DO UPDATE SET
    roepnummer = excluded.roepnummer,
    voertuig = excluded.voertuig,
    ingedeeld_door = excluded.ingedeeld_door,
    tijd = excluded.tijd
`);

const getIndeling = db.prepare('SELECT * FROM indelingen WHERE user_id = ?');

module.exports = {
  db,
  upsertGebruiker,
  getGebruiker,
  updateGebruikerInstellingen,
  addAanmelding,
  getWachtrij,
  removeAanmelding,
  addIndeling,
  getIndeling,
};

// Specialisatie instellingen
db.exec(`
  CREATE TABLE IF NOT EXISTS specialisatie_instellingen (
    voertuig TEXT PRIMARY KEY,
    max_eenheden INTEGER,
    min_eenheden INTEGER DEFAULT 0,
    tijdslot_start TEXT,
    tijdslot_eind TEXT,
    vereiste_rol TEXT
  );
`);

// Migratie: vereiste_rol kolom toevoegen
const specKolommen = db.prepare("PRAGMA table_info(specialisatie_instellingen)").all().map(k => k.name);
if (!specKolommen.includes('vereiste_rol')) {
  db.exec("ALTER TABLE specialisatie_instellingen ADD COLUMN vereiste_rol TEXT");
}
// Migratie: tijdslot_eind updaten voor Zulu
db.prepare("UPDATE specialisatie_instellingen SET tijdslot_eind = '06:00' WHERE voertuig = 'Zulu' AND (tijdslot_eind IS NULL OR tijdslot_eind = '')").run();
// Migratie: vereiste_rol instellen voor Offroad
db.prepare("UPDATE specialisatie_instellingen SET vereiste_rol = 'OFFROAD' WHERE voertuig = 'Offroad' AND (vereiste_rol IS NULL OR vereiste_rol = '')").run();
// Migratie: min_eenheden instellen op basis van max voor bestaande rijen
db.prepare("UPDATE specialisatie_instellingen SET min_eenheden = max_eenheden WHERE min_eenheden = 0 AND max_eenheden < 99 AND voertuig != 'Zulu'").run();

// Standaard waarden invoegen als ze nog niet bestaan
const defaults = [
  { voertuig: 'SIV 1',    max: 2,  min: 2,  start: null,    eind: null,    rol: 'SIV' },
  { voertuig: 'SIV 2',    max: 4,  min: 4,  start: null,    eind: null,    rol: 'SIV' },
  { voertuig: 'SIV 3',    max: 6,  min: 6,  start: null,    eind: null,    rol: 'SIV' },
  { voertuig: 'GPT 1',    max: 3,  min: 3,  start: null,    eind: null,    rol: 'Unmarked GPT' },
  { voertuig: 'GPT 2',    max: 6,  min: 6,  start: null,    eind: null,    rol: 'Unmarked GPT' },
  { voertuig: 'Motor 1',  max: 4,  min: 4,  start: null,    eind: null,    rol: 'Motor' },
  { voertuig: 'Motor 2',  max: 6,  min: 6,  start: null,    eind: null,    rol: 'Motor' },
  { voertuig: 'Motor 3',  max: 10, min: 10, start: null,    eind: null,    rol: 'Motor' },
  { voertuig: 'Boot 1',   max: 1,  min: 1,  start: null,    eind: null,    rol: 'Kustwacht' },
  { voertuig: 'Boot 2',   max: 2,  min: 2,  start: null,    eind: null,    rol: 'Kustwacht' },
  { voertuig: 'Zulu',     max: 99, min: 5,  start: null,    eind: null,    rol: 'Piloot cert.' },
  { voertuig: 'Noodhulp', max: 99, min: 0,  start: null,    eind: null,    rol: null },
  { voertuig: 'Offroad',  max: 99, min: 0,  start: null,    eind: null,    rol: 'Off-road' },
];
const insertSpec = db.prepare(`
  INSERT OR IGNORE INTO specialisatie_instellingen (voertuig, max_eenheden, min_eenheden, tijdslot_start, tijdslot_eind, vereiste_rol)
  VALUES (?, ?, ?, ?, ?, ?)
`);
defaults.forEach(d => insertSpec.run(d.voertuig, d.max, d.min || 0, d.start, d.eind || null, d.rol));

// Systeem instellingen
db.exec(`
  CREATE TABLE IF NOT EXISTS systeem_instellingen (
    sleutel TEXT PRIMARY KEY,
    waarde TEXT
  );
`);
db.prepare("INSERT OR IGNORE INTO systeem_instellingen (sleutel, waarde) VALUES ('max_koppel', '2')").run();
