const db = require('./db');

async function resetAll() {
  try {
    console.log('Resetting all slots in database to available...');
    const [resSlots] = await db.query(
      `UPDATE time_slots SET status = 'available', booking_id = NULL`
    );
    console.log(`✅ Reset ${resSlots.affectedRows} slots in time_slots table.`);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

resetAll();
