const mysql = require('mysql2/promise');
require('dotenv').config();

const servers = [
  {
    id: 1,
    name: 'Java Survival',
    icon: '⛏️',
    description: 'Vanilla Survival โลกธรรมดา เหมาะสำหรับผู้เล่นทุกระดับ'
  },
  {
    id: 2,
    name: 'RLCraft',
    icon: '💀',
    description: 'Survival สุดโหด มีระบบ Thirst, Hunger, Temperature และ Monster เยอะมาก'
  },
  {
    id: 3,
    name: 'RL Dregora',
    icon: '🐉',
    description: 'RLCraft รุ่น Dregora มี Biome และ Structure เพิ่มเติม กราฟิกสวยกว่าปกติ'
  },
  {
    id: 4,
    name: 'Pixelmon',
    icon: '⚡',
    description: 'เล่น Minecraft แบบ Pokemon จับ เทรน และต่อสู้กับ Pokemon ในโลก Minecraft'
  }
];

(async () => {
  const dbName = process.env.DB_NAME || 'mc_server_db';
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: dbName,
    charset: 'utf8mb4'
  });

  console.log('Connected! Fixing table charset and updating servers...');
  await conn.query(`ALTER DATABASE ${dbName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.query('ALTER TABLE servers CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');

  for (const s of servers) {
    await conn.query(
      'UPDATE servers SET icon = ?, description = ? WHERE id = ?',
      [s.icon, s.description, s.id]
    );
    console.log(`Updated server ${s.id}: ${s.name} ${s.icon}`);
  }

  const [rows] = await conn.query('SELECT id, name, icon, description FROM servers');
  console.log('Verification:');
  for (const r of rows) {
    console.log(`${r.id}. ${r.name} [${r.icon}] - ${r.description}`);
  }

  await conn.end();
  console.log('Done!');
})();
