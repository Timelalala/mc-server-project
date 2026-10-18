// Adds the columns the slot system needs to the bookings table.
// Safe to run more than once: existing columns are skipped.
// Run from mc-server-backend:  node models/migrate-mc-slot.js
const mysql = require('mysql2/promise');
require('dotenv').config();

const COLUMNS = [
  ['slot_status', "VARCHAR(20) NOT NULL DEFAULT 'waiting'"], // waiting | started | ended
  ['online_players', 'TEXT NULL'],                           // JSON array, who is online now
  ['seen_players', 'TEXT NULL'],                             // JSON array, everyone who joined this slot
  ['slot_updated_at', 'DATETIME NULL'],                      // last update from MC1
];

(async () => {
  const dbName = process.env.DB_NAME || 'mc_server_db';
  let conn;
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      database: dbName,
    });
  } catch (err) {
    console.error('❌ Failed to connect to MySQL:', err.message);
    process.exit(1);
  }

  try {
    for (const [name, def] of COLUMNS) {
      const [rows] = await conn.query(
        `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'bookings' AND COLUMN_NAME = ?`,
        [dbName, name]
      );
      if (rows[0].n === 0) {
        await conn.query(`ALTER TABLE bookings ADD COLUMN ${name} ${def}`);
        console.log(`✅ Added bookings.${name}`);
      } else {
        console.log(`• bookings.${name} already exists`);
      }
    }
    console.log('--- migrate-mc-slot done ---');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
})();
