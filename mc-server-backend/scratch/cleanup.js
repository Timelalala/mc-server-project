const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'mc_server_db',
    });

    console.log('Connected to MySQL. Running cleanup...');

    // 1. UPDATE bookings
    const [bookingRes] = await conn.query(`
      UPDATE bookings 
      SET status = 'completed', slot_status = 'stopped' 
      WHERE end_time <= NOW() AND (status != 'completed' OR slot_status != 'stopped')
    `);
    console.log(`✅ Updated expired bookings: ${bookingRes.affectedRows} row(s)`);

    // 2. UPDATE servers
    const [serverRes] = await conn.query(`
      UPDATE servers 
      SET session_count = 0 
      WHERE id = 1
    `);
    console.log(`✅ Updated server 1 session_count: ${serverRes.affectedRows} row(s)`);

    // 3. Optional: update time_slots for completed bookings
    const [slotRes] = await conn.query(`
      UPDATE time_slots ts
      JOIN bookings b ON ts.booking_id = b.id
      SET ts.status = 'available', ts.booking_id = NULL
      WHERE b.end_time <= NOW()
    `);
    console.log(`✅ Released time_slots for expired bookings: ${slotRes.affectedRows} row(s)`);

    // Verify current state
    const [activeBookings] = await conn.query(`
      SELECT id, server_id, status, slot_status, start_time, end_time, ip 
      FROM bookings 
      ORDER BY id DESC LIMIT 5
    `);
    console.log('Latest 5 bookings in DB:', activeBookings);

    const [servers] = await conn.query(`SELECT id, name, session_count, status FROM servers`);
    console.log('Servers status in DB:', servers);

    await conn.end();
    console.log('Cleanup finished successfully.');
  } catch (err) {
    console.error('❌ Cleanup failed:', err);
    process.exit(1);
  }
})();
