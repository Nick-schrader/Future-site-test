const express = require('express');
const router = express.Router();
const Database = require('better-sqlite3');
const path = require('path');

// Database connectie
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../bot/porto.db');
const db = new Database(DB_PATH);

// Haal berichten voor een gebruiker
router.get('/:discordId', (req, res) => {
  try {
    const { discordId } = req.params;
    
    console.log('[API] Berichten opgehaald voor Discord ID:', discordId);
    
    const stmt = db.prepare("SELECT * FROM berichten WHERE discord_id = ? ORDER BY tijd DESC");
    const berichten = stmt.all(discordId);
    
    console.log('[API] Berichten gevonden:', berichten.length, 'items:', berichten);
    
    res.json(berichten);
  } catch (error) {
    console.error('[API] Fout bij ophalen berichten:', error);
    res.status(500).json({ error: 'Database fout: ' + error.message });
  }
});

// Sla nieuw bericht op
router.post('/', (req, res) => {
  try {
    const { discord_id, type, bericht } = req.body;
    
    console.log('[API] Nieuw bericht ontvangen:', { discord_id, type, bericht });
    
    if (!discord_id || !type || !bericht) {
      return res.status(400).json({ error: 'Ongeldige request data' });
    }
    
    const stmt = db.prepare("INSERT INTO berichten (discord_id, type, bericht, tijd, gelezen) VALUES (?, ?, ?, ?, ?)");
    const result = stmt.run(discord_id, type, bericht, new Date().toISOString(), 0);
    
    console.log('[API] Bericht opgeslagen:', { discord_id, type, id: result.lastInsertRowid });
    console.log('[API] Bericht details:', { discord_id, type, bericht, tijd: new Date().toISOString() });
    
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    console.error('[API] Fout bij opslaan bericht:', error);
    res.status(500).json({ error: 'Database fout: ' + error.message });
  }
});

// Markeer bericht als gelezen
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('[API] Bericht markeren als gelezen:', id);
    
    const stmt = db.prepare("UPDATE berichten SET gelezen = 1 WHERE id = ?");
    const result = stmt.run(id);
    
    console.log('[API] Bericht gemarkeerd:', result.changes, 'rows affected');
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Bericht niet gevonden' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('[API] Fout bij markeren bericht:', error);
    res.status(500).json({ error: 'Database fout: ' + error.message });
  }
});

module.exports = router;
