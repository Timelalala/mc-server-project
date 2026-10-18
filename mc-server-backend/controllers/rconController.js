const { Rcon } = require('rcon-client');

// Config Pi ทั้ง 4 ตัว
const PI_SERVERS = {
  1: { host: process.env.PI_1_HOST || '10.166.57.15', port: parseInt(process.env.PI_1_RCON_PORT) || 25575, password: process.env.PI_1_RCON_PASS || 'mcserver2024' },
  2: { host: process.env.PI_2_HOST, port: parseInt(process.env.PI_2_RCON_PORT), password: process.env.PI_2_RCON_PASS },
  3: { host: process.env.PI_3_HOST, port: parseInt(process.env.PI_3_RCON_PORT), password: process.env.PI_3_RCON_PASS },
  4: { host: process.env.PI_4_HOST, port: parseInt(process.env.PI_4_RCON_PORT), password: process.env.PI_4_RCON_PASS },
};

/**
 * ฟังก์ชัน sendRcon (ฟังก์ชันกลาง)
 * ส่งคำสั่งไป Pi ตัวที่ระบุ
 * ต้อง connect -> send -> end เสมอ
 * ถ้า connect ไม่ได้ = server offline -> throw error
 */
async function sendRcon(serverId, command) {
  const config = PI_SERVERS[serverId];
  if (!config || !config.host) throw new Error('ไม่พบ Server');
  const rcon = new Rcon({
    host: config.host,
    port: config.port || 25575,
    password: config.password,
    timeout: 5000
  });

  try {
    await rcon.connect();
    const result = await rcon.send(command);
    await rcon.end();
    return result;
  } catch (err) {
    console.error(`RCON Error Pi#${serverId}:`, err.message);
    try {
      await rcon.end();
    } catch (_) {}
    throw err;
  }
}

/**
 * Parse output from 'list' command
 * Example formats:
 * "There are 3/20 players online: player1, player2"
 * "There are 0 of a max 20 players online:"
 */
function parseListResponse(raw) {
  if (!raw || typeof raw !== 'string') {
    return { current: 0, max: 20, isFull: false, raw: raw || '' };
  }

  const match = raw.match(/There are (\d+)(?:\/| of a max (?:of )?)(\d+)/i)
             || raw.match(/(\d+)\s*\/\s*(\d+)/)
             || raw.match(/(\d+)\s*of\s*(\d+)/i);

  let current = 0;
  let max = 20;

  if (match) {
    current = parseInt(match[1], 10) || 0;
    max = parseInt(match[2], 10) || 20;
  }

  const isFull = current >= max && max > 0;
  return { current, max, isFull, raw };
}

/**
 * Clean/parse TPS output
 */
function parseTpsResponse(raw) {
  if (!raw || typeof raw !== 'string') return '20.0';
  const match = raw.match(/TPS[^\d]*(\d+\.\d+|\d+)/i) || raw.match(/(\d+\.\d+)/);
  if (match) {
    return match[1];
  }
  return raw.trim() || '20.0';
}

// 1. getPlayers — GET /api/servers/:id/players
async function getPlayers(req, res) {
  try {
    const serverId = req.params.id;
    const raw = await sendRcon(serverId, 'list');
    const parsed = parseListResponse(raw);
    return res.json({
      current: parsed.current,
      max: parsed.max,
      isFull: parsed.isFull,
      raw: parsed.raw
    });
  } catch (err) {
    return res.json({
      current: 0,
      max: 20,
      isFull: false,
      status: 'offline'
    });
  }
}

// 2. getServerStatus — GET /api/admin/servers/:id/status
async function getServerStatus(req, res) {
  try {
    const serverId = req.params.id;
    const [listRes, tpsRes] = await Promise.all([
      sendRcon(serverId, 'list'),
      sendRcon(serverId, 'tps').catch(() => '20.0')
    ]);
    const parsed = parseListResponse(listRes);
    const tps = parseTpsResponse(tpsRes);
    return res.json({
      status: 'online',
      current: parsed.current,
      max: parsed.max,
      tps: tps
    });
  } catch (err) {
    return res.json({
      status: 'offline',
      current: 0,
      max: 20
    });
  }
}

// 3. kickPlayer — POST /api/admin/servers/:id/kick
async function kickPlayer(req, res) {
  try {
    const serverId = req.params.id;
    const playerName = req.body.playerName || req.body.username;
    const reason = req.body.reason ? req.body.reason.trim() : '';

    if (!playerName) {
      return res.status(400).json({ message: 'กรุณาระบุชื่อผู้เล่น' });
    }

    const command = reason ? `kick ${playerName} ${reason}` : `kick ${playerName}`;
    await sendRcon(serverId, command);
    return res.json({ message: 'Kick สำเร็จ' });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'เกิดข้อผิดพลาดในการ Kick ผู้เล่น' });
  }
}

// 4. addWhitelist — POST /api/admin/servers/:id/whitelist
async function addWhitelist(req, res) {
  try {
    const serverId = req.params.id;
    const playerName = req.body.playerName || req.body.username;

    if (!playerName) {
      return res.status(400).json({ message: 'กรุณาระบุชื่อผู้เล่น' });
    }

    await sendRcon(serverId, `whitelist add ${playerName}`);
    return res.json({ message: 'เพิ่ม whitelist แล้ว' });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'เกิดข้อผิดพลาดในการเพิ่ม Whitelist' });
  }
}

// 5. removeWhitelist — DELETE /api/admin/servers/:id/whitelist
async function removeWhitelist(req, res) {
  try {
    const serverId = req.params.id;
    const playerName = req.body.playerName || req.body.username;

    if (!playerName) {
      return res.status(400).json({ message: 'กรุณาระบุชื่อผู้เล่น' });
    }

    await sendRcon(serverId, `whitelist remove ${playerName}`);
    return res.json({ message: 'ลบ whitelist แล้ว' });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'เกิดข้อผิดพลาดในการลบ Whitelist' });
  }
}

// 6. broadcastMessage — POST /api/admin/servers/:id/broadcast
async function broadcastMessage(req, res) {
  try {
    const serverId = req.params.id;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ message: 'กรุณาระบุข้อความ' });
    }

    await sendRcon(serverId, `say ${message}`);
    return res.json({ message: 'ส่งข้อความแล้ว' });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'เกิดข้อผิดพลาดในการส่งข้อความ' });
  }
}

// 7. getAllServersStatus — GET /api/servers/status-all
async function getAllServersStatus(req, res) {
  try {
    const serverIds = [1, 2, 3, 4];
    const results = await Promise.allSettled(
      serverIds.map(async (id) => {
        const raw = await sendRcon(id, 'list');
        const parsed = parseListResponse(raw);
        return {
          serverId: Number(id),
          status: 'online',
          current: parsed.current,
          max: parsed.max
        };
      })
    );

    const serversStatus = results.map((result, index) => {
      const serverId = serverIds[index];
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        serverId: Number(serverId),
        status: 'offline',
        current: 0,
        max: 20
      };
    });

    return res.json(serversStatus);
  } catch (err) {
    console.error('Error in getAllServersStatus:', err.message);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงสถานะเซิร์ฟเวอร์ทั้งหมด' });
  }
}

// Helper alias methods for legacy routes compatibility
async function executeCommand(req, res) {
  try {
    const serverId = req.params.id || req.params.serverId;
    const { command } = req.body;

    if (!command || typeof command !== 'string' || command.trim() === '') {
      return res.status(400).json({ message: 'กรุณาระบุคำสั่ง (command)' });
    }

    const result = await sendRcon(serverId, command.trim());
    return res.json({
      message: 'ส่งคำสั่ง RCON สำเร็จ',
      result
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'เกิดข้อผิดพลาดในการส่งคำสั่ง RCON' });
  }
}

async function manageWhitelist(req, res) {
  const action = (req.body.action || 'add').toLowerCase();
  if (action === 'remove') {
    return removeWhitelist(req, res);
  }
  return addWhitelist(req, res);
}

module.exports = {
  sendRcon,
  getPlayers,
  getServerStatus,
  kickPlayer,
  addWhitelist,
  removeWhitelist,
  broadcastMessage,
  broadcast: broadcastMessage,
  executeCommand,
  manageWhitelist,
  getAllServersStatus
};
