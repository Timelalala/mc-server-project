const db = require('./db');

(async () => {
  try {
    const [existing] = await db.query('SELECT COUNT(*) as c FROM bookings');
    if (existing[0].c === 0) {
      const now = new Date();
      const d1 = new Date(now.getTime() - 24 * 3600 * 1000); // Yesterday
      const d2 = new Date(now.getTime() - 2 * 3600 * 1000);  // Earlier today
      const d3 = new Date(now.getTime() + 4 * 3600 * 1000);  // Later today

      const fmt = (d) => d.toISOString().slice(0, 19).replace('T', ' ');

      await db.query(`
        INSERT INTO bookings (user_id, server_id, booking_type, start_time, end_time, status, payment_status, ip, port, amount, slot_status) VALUES
        (1, 1, 'timeslot', ?, ?, 'confirmed', 'paid', '192.168.137.1', 25565, 50.00, 'ended'),
        (1, 2, 'timeslot', ?, ?, 'confirmed', 'paid', '192.168.137.11', 25566, 60.00, 'started'),
        (1, 4, 'timeslot', ?, ?, 'pending', 'unpaid', '192.168.137.13', 25568, 70.00, 'waiting')
      `, [
        fmt(d1), fmt(new Date(d1.getTime() + 7200000)),
        fmt(d2), fmt(new Date(d2.getTime() + 7200000)),
        fmt(d3), fmt(new Date(d3.getTime() + 7200000))
      ]);
      console.log('✅ Seeded 3 real bookings successfully!');
    } else {
      console.log('Bookings already exist:', existing[0].c);
    }
  } catch (err) {
    console.error('Seed error:', err);
  } finally {
    process.exit();
  }
})();
