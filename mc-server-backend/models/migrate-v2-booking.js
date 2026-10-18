const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrateV2() {
  console.log('--- Starting Migration for Server Booking V2 ---');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'mc_server_db'
    });
  } catch (err) {
    console.error('❌ Failed to connect to MySQL:', err.message);
    return;
  }

  try {
    // 1. Create pricing_rules table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS pricing_rules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        server_id INT NULL,
        booking_type VARCHAR(20) NOT NULL,
        duration_hours INT NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_pricing_rules_active (is_active, booking_type)
      ) ENGINE=InnoDB;
    `);
    console.log('✅ Checked/created pricing_rules table');

    // Seed default pricing rules if empty
    const [existingRules] = await connection.query('SELECT COUNT(*) as count FROM pricing_rules');
    if (existingRules[0].count === 0) {
      await connection.query(`
        INSERT INTO pricing_rules (id, server_id, booking_type, duration_hours, price, is_active) VALUES
        (1, NULL, 'timeslot', 2, 50.00, TRUE),
        (2, NULL, 'fullday', 24, 200.00, TRUE),
        (3, NULL, 'multiday', 24, 180.00, TRUE),
        (4, NULL, 'daily', 8, 90.00, TRUE)
      `);
      console.log('✅ Seeded default pricing rules');
    }

    // 2. Check and add columns to bookings table
    await connection.query(`
      ALTER TABLE bookings 
      MODIFY COLUMN payment_status ENUM('unpaid','pending','paid','failed','expired','cancelled') DEFAULT 'unpaid'
    `);
    console.log('✅ Updated payment_status ENUM to include cancelled');

    const [bookingCols] = await connection.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'bookings'
    `, [process.env.DB_NAME || 'mc_server_db']);

    const colNames = bookingCols.map(c => c.COLUMN_NAME.toLowerCase());

    if (!colNames.includes('start_time')) {
      await connection.query(`ALTER TABLE bookings ADD COLUMN start_time DATETIME NULL AFTER end_date`);
      console.log('✅ Added start_time column to bookings');
    }
    if (!colNames.includes('end_time')) {
      await connection.query(`ALTER TABLE bookings ADD COLUMN end_time DATETIME NULL AFTER start_time`);
      console.log('✅ Added end_time column to bookings');
    }
    if (!colNames.includes('lock_expires_at')) {
      await connection.query(`ALTER TABLE bookings ADD COLUMN lock_expires_at DATETIME NULL AFTER end_time`);
      console.log('✅ Added lock_expires_at column to bookings');
    }
    if (!colNames.includes('updated_at')) {
      await connection.query(`ALTER TABLE bookings ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at`);
      console.log('✅ Added updated_at column to bookings');
    }

    // Populate start_time and end_time for existing bookings where possible
    await connection.query(`
      UPDATE bookings b
      LEFT JOIN time_slots t ON b.slot_id = t.id
      SET 
        b.start_time = CASE 
          WHEN b.booking_type = 'timeslot' AND t.date IS NOT NULL THEN CONCAT(t.date, ' ', t.time_start)
          WHEN b.booking_type = 'fullday' AND b.start_date IS NOT NULL THEN CONCAT(b.start_date, ' 00:00:00')
          WHEN b.booking_type = 'multiday' AND b.start_date IS NOT NULL THEN CONCAT(b.start_date, ' 00:00:00')
          ELSE b.start_time
        END,
        b.end_time = CASE 
          WHEN b.booking_type = 'timeslot' AND t.date IS NOT NULL THEN CONCAT(t.date, ' ', t.time_end)
          WHEN b.booking_type = 'fullday' AND b.end_date IS NOT NULL THEN CONCAT(b.end_date, ' 23:59:59')
          WHEN b.booking_type = 'multiday' AND b.end_date IS NOT NULL THEN CONCAT(b.end_date, ' 23:59:59')
          ELSE b.end_time
        END
      WHERE b.start_time IS NULL
    `);
    console.log('✅ Backfilled start_time and end_time for existing bookings');

    // Add composite index if not exists
    try {
      await connection.query(`
        ALTER TABLE bookings 
        ADD INDEX idx_server_availability (server_id, payment_status, start_time, end_time)
      `);
      console.log('✅ Created index idx_server_availability');
    } catch (e) {
      // Index might already exist
      if (!e.message.includes('Duplicate key name')) {
        console.warn('Index note:', e.message);
      }
    }

    console.log('🎉 Migration V2 Completed Successfully!');
  } catch (err) {
    console.error('❌ Migration error:', err.message);
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  migrateV2();
}

module.exports = migrateV2;
