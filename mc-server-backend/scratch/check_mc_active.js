const db = require('../models/db');

(async () => {
  const [rows] = await db.query(`
    SELECT id, server_id, booking_type, start_time, end_time, status, payment_status 
    FROM bookings 
    WHERE status = 'confirmed' 
      AND start_time < NOW() + INTERVAL 1 DAY 
      AND end_time > NOW()
  `);
  console.log('Active MC Bookings count:', rows.length);
  console.log(rows);
  process.exit(0);
})();
