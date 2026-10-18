const db = require('./db');

async function resetSlots() {
  try {
    console.log('Resetting time slots to available...');
    const [result] = await db.query(
      `UPDATE time_slots SET status = 'available', booking_id = NULL`
    );
    console.log(`✅ Successfully reset ${result.affectedRows} time slots back to 'available'!`);
  } catch (err) {
    console.error('Error resetting slots:', err.message);
  } finally {
    process.exit(0);
  }
}

resetSlots();
