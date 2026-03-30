-- Clear all data from Porto Systeem database
-- Run with: sqlite3 porto.db < clear_data.sql

-- Clear all user data
DELETE FROM gebruikers;

-- Clear all queue data
DELETE FROM aanmeld_wachtrij;

-- Clear all indelingen
DELETE FROM indelingen;

-- Clear all status alerts
DELETE FROM status_alerts;

-- Clear all specialisatie instellingen
DELETE FROM specialisatie_instellingen;

-- Reset autoincrement
DELETE FROM sqlite_sequence WHERE name IN ('gebruikers', 'aanmeld_wachtrij', 'indelingen', 'status_alerts', 'specialisatie_instellingen');

-- Show remaining tables
.tables
