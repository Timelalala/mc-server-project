const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../models/db');

(async () => {
  try {
    const [rows] = await db.query(`
      SELECT b.id, b.user_id, u.username, b.server_id, s.name as server_name, 
             b.booking_type, 
             DATE_FORMAT(b.start_date, '%Y-%m-%d') as start_date_formatted,
             DATE_FORMAT(b.end_date, '%Y-%m-%d') as end_date_formatted,
             DATE_FORMAT(b.start_time, '%Y-%m-%d %H:%i:%s') as start_time_formatted,
             DATE_FORMAT(b.end_time, '%Y-%m-%d %H:%i:%s') as end_time_formatted,
             b.status, b.payment_status, b.amount, 
             DATE_FORMAT(b.created_at, '%Y-%m-%d %H:%i:%s') as created_at_formatted
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN servers s ON b.server_id = s.id
      ORDER BY b.id DESC
      LIMIT 10
    `);
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error('Error querying bookings:', err);
  } finally {
    process.exit(0);
  }
})();
