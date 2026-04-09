const express = require('express');
const router = express.Router();
const Database = require('better-sqlite3');
const path = require('path');

// Database connectie
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../bot/porto.db');
const db = new Database(DB_PATH);

// Haal personeelsdata op voor roepnummer systeem
router.get('/bestand', (req, res) => {
  try {
    console.log('[API] Roepnummer data opgehaald');
    
    // Haal personeel op uit database
    const stmt = db.prepare(`
      SELECT 
        id,
        naam,
        discord_id as discordId,
        rang,
        roepnummer
      FROM personeel 
      ORDER BY rang DESC, naam ASC
    `);
    
    const personeel = stmt.all();
    
    console.log('[API] Personeel gevonden:', personeel.length, 'items');
    
    res.json({
      personeel: personeel,
      laatstBijgewerkt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[API] Fout bij ophalen roepnummer data:', error);
    
    // Fallback: lege data als database niet beschikbaar is
    res.json({
      personeel: [],
      laatstBijgewerkt: new Date().toISOString(),
      error: 'Database niet beschikbaar'
    });
  }
});

// Update personeelsdata (voor promoties/demoties)
router.put('/personeel/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { rang, roepnummer, naam, discordId } = req.body;
    
    console.log('[API] Personeel update:', { id, rang, roepnummer, naam, discordId });
    
    // First try to update
    const updateStmt = db.prepare("UPDATE personeel SET rang = ?, roepnummer = ? WHERE id = ?");
    const result = updateStmt.run(rang, roepnummer, id);
    
    if (result.changes === 0) {
      // If not found, try to create if we have naam and discordId
      if (naam && discordId) {
        console.log('[API] Personeel niet gevonden, proberen aan te maken...');
        const insertStmt = db.prepare("INSERT INTO personeel (id, naam, discord_id, rang, roepnummer) VALUES (?, ?, ?, ?, ?)");
        const insertResult = insertStmt.run(parseInt(id), naam, discordId, rang, roepnummer);
        
        if (insertResult.lastInsertRowid) {
          console.log('[API] Personeel succesvol aangemaakt:', insertResult.lastInsertRowid);
          return res.json({ success: true, created: true });
        }
      }
      
      return res.status(404).json({ error: 'Personeel niet gevonden en kon niet worden aangemaakt' });
    }
    
    console.log('[API] Personeel succesvol bijgewerkt');
    res.json({ success: true });
    
  } catch (error) {
    console.error('[API] Fout bij bijwerken personeel:', error);
    res.status(500).json({ error: 'Database fout: ' + error.message });
  }
});

// Voeg nieuw personeel toe
router.post('/personeel', (req, res) => {
  try {
    const { naam, discordId, rang, roepnummer } = req.body;
    
    console.log('[API] Nieuw personeel toevoegen:', { naam, discordId, rang, roepnummer });
    
    if (!naam || !discordId || !rang) {
      return res.status(400).json({ error: 'Naam, Discord ID en rang zijn verplicht' });
    }
    
    const stmt = db.prepare("INSERT INTO personeel (naam, discord_id, rang, roepnummer) VALUES (?, ?, ?, ?)");
    const result = stmt.run(naam, discordId, rang, roepnummer || null);
    
    console.log('[API] Personeel succesvol toegevoegd:', result.lastInsertRowid);
    res.json({ success: true, id: result.lastInsertRowid });
    
  } catch (error) {
    console.error('[API] Fout bij toevoegen personeel:', error);
    res.status(500).json({ error: 'Database fout: ' + error.message });
  }
});

// Verwijder personeel
router.delete('/personeel/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('[API] Personeel verwijderen:', id);
    
    const stmt = db.prepare("DELETE FROM personeel WHERE id = ?");
    const result = stmt.run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Personeel niet gevonden' });
    }
    
    console.log('[API] Personeel succesvol verwijderd');
    res.json({ success: true });
    
  } catch (error) {
    console.error('[API] Fout bij verwijderen personeel:', error);
    res.status(500).json({ error: 'Database fout: ' + error.message });
  }
});

module.exports = router;
