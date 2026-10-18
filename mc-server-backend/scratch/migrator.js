const db = require('../models/db');

(async () => {
  try {
    const [cols] = await db.query("SHOW COLUMNS FROM users LIKE 'status'");
    if (cols.length === 0) {
      await db.query("ALTER TABLE users ADD COLUMN status ENUM('active', 'suspended') DEFAULT 'active'");
      console.log('Successfully added status column to users table');
    } else {
      console.log('Status column already exists in users table');
    }
  } catch (err) {
    console.error('DB Migration check failed:', err.message);
  } finally {
    process.exit(0);
  }
})();
