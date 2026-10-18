const db = require('./db');

async function migrate() {
  try {
    console.log('Running Omise & TimeSlots database migration...');

    // 1. Check bookings table
    const [cols] = await db.query(`SHOW COLUMNS FROM bookings LIKE 'omise_charge_id'`);
    if (cols.length === 0) {
      await db.query(`
        ALTER TABLE bookings
          ADD COLUMN omise_charge_id VARCHAR(100),
          ADD COLUMN payment_status ENUM('unpaid','pending','paid','failed','expired') DEFAULT 'unpaid'
      `);
      console.log('✅ Successfully added omise_charge_id and payment_status columns to bookings table.');
    } else {
      console.log('ℹ️ omise_charge_id column already exists in bookings table.');
    }

    // 2. Check time_slots table
    const [slotCols] = await db.query(`SHOW COLUMNS FROM time_slots LIKE 'booking_id'`);
    if (slotCols.length === 0) {
      await db.query(`
        ALTER TABLE time_slots
          ADD COLUMN booking_id INT NULL,
          MODIFY COLUMN status ENUM('available','reserved','booked') DEFAULT 'available'
      `);
      console.log('✅ Successfully added booking_id and updated status ENUM in time_slots table.');
    } else {
      console.log('ℹ️ booking_id column already exists in time_slots table.');
    }
  } catch (err) {
    console.error('Migration Note:', err.message);
  } finally {
    process.exit(0);
  }
}

migrate();
