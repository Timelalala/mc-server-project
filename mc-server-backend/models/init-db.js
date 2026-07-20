const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function initDB() {
  console.log('Starting Database Initialization...');
  console.log(`Connecting to host: ${process.env.DB_HOST || '127.0.0.1'} as user: ${process.env.DB_USER || 'root'}...`);

  // Connect to MySQL server (without specifying DB name first, in case it doesn't exist yet)
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      multipleStatements: true // Allow running multiple statements if needed
    });
  } catch (err) {
    console.error('❌ Failed to connect to MySQL server. Please make sure MySQL is running and your .env credentials are correct.');
    console.error('Error Details:', err.message);
    process.exit(1);
  }

  try {
    const sqlPath = path.join(__dirname, 'schema.sql');
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`schema.sql not found at ${sqlPath}`);
    }

    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // Split SQL by semicolon, clean up lines, and execute
    const queries = sqlContent
      .split(';')
      .map(q => q.trim())
      .filter(q => q.length > 0 && !q.startsWith('--'));

    for (let query of queries) {
      // Get a short description for logs
      const firstLine = query.split('\n')[0].trim();
      console.log(`Running: ${firstLine.substring(0, 60)}...`);
      await connection.query(query);
    }

    console.log('✅ Database initialized and seed data inserted successfully!');
  } catch (err) {
    console.error('❌ Error initializing database:', err.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Disconnected from MySQL.');
    }
  }
}

initDB();
