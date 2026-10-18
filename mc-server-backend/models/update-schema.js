const mysql = require('mysql2/promise');
require('dotenv').config();

async function updateSchema() {
  console.log('Running Schema Migration Script...');
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'mc_server_db'
    });

    const addCol = async (table, colDef) => {
      try {
        await connection.query(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
        console.log(`✅ Added column to ${table}: ${colDef.split(' ')[0]}`);
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
          // Column already exists
        } else {
          console.error(`Error adding column to ${table}:`, err.message);
        }
      }
    };

    // Update servers table
    await addCol('servers', "edition ENUM('java','bedrock') DEFAULT 'java'");
    await addCol('servers', "mc_version VARCHAR(20) DEFAULT '1.21'");
    await addCol('servers', "mod_name VARCHAR(100) DEFAULT NULL");
    await addCol('servers', "mod_version VARCHAR(20) DEFAULT NULL");
    await addCol('servers', "description TEXT DEFAULT NULL");
    await addCol('servers', "icon VARCHAR(50) DEFAULT NULL");
    await addCol('servers', "session_count INT DEFAULT 0");

    // Update bookings table
    await addCol('bookings', "booking_type ENUM('timeslot','fullday','multiday') DEFAULT 'timeslot'");
    await addCol('bookings', "start_date DATE NULL");
    await addCol('bookings', "end_date DATE NULL");
    await addCol('bookings', "session_id VARCHAR(100) NULL");

    try {
      await connection.query("ALTER TABLE bookings MODIFY COLUMN slot_id INT NULL");
      console.log("✅ Modified bookings.slot_id to be NULLable");
    } catch (err) {
      console.log("Slot ID modify warning:", err.message);
    }

    // Sessions table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        server_id INT NOT NULL,
        booking_id INT NOT NULL,
        user_id INT NOT NULL,
        player_name VARCHAR(50),
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        left_at TIMESTAMP NULL,
        is_active BOOLEAN DEFAULT TRUE,
        FOREIGN KEY (server_id) REFERENCES servers(id),
        FOREIGN KEY (booking_id) REFERENCES bookings(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    console.log("✅ Sessions table created/verified.");

    // Insert or update 4 servers
    const serversData = [
      [1, 'Java Survival', '192.168.1.11', '192.168.1.11', 'online', 8, 20, 'java', '1.21', null, null, 'Vanilla Survival โลกธรรมดา เหมาะสำหรับผู้เล่นทุกระดับ', '⛏️', 8],
      [2, 'RLCraft', '192.168.1.12', '192.168.1.12', 'online', 4, 20, 'java', '1.12.2', 'RLCraft', '2.9.3', 'Survival สุดโหด มีระบบ Thirst, Hunger, Temperature และ Monster เยอะมาก', '💀', 4],
      [3, 'RL Dregora', '192.168.1.13', '192.168.1.13', 'online', 0, 20, 'java', '1.12.2', 'RLCraft + Dregora', '2.9.3', 'RLCraft รุ่น Dregora มี Biome และ Structure เพิ่มเติม กราฟิกสวยกว่าปกติ', '🐉', 0],
      [4, 'Pixelmon', '192.168.1.14', '192.168.1.14', 'online', 12, 20, 'java', '1.16.5', 'Pixelmon Mod', '9.1.11', 'เล่น Minecraft แบบ Pokemon จับ เทรน และต่อสู้กับ Pokemon ในโลก Minecraft', '⚡', 12]
    ];

    for (const s of serversData) {
      await connection.query(`
        INSERT INTO servers (id, name, ip, pi_host, status, current_players, max_players, edition, mc_version, mod_name, mod_version, description, icon, session_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name=VALUES(name), ip=VALUES(ip), pi_host=VALUES(pi_host), status=VALUES(status),
          current_players=VALUES(current_players), max_players=VALUES(max_players),
          edition=VALUES(edition), mc_version=VALUES(mc_version), mod_name=VALUES(mod_name),
          mod_version=VALUES(mod_version), description=VALUES(description), icon=VALUES(icon),
          session_count=VALUES(session_count)
      `, s);
    }
    console.log("✅ Updated all 4 servers in database.");

  } catch (err) {
    console.error('❌ Migration Error:', err.message);
  } finally {
    if (connection) await connection.end();
  }
}

updateSchema();
