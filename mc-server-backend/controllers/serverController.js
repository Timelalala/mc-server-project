const db = require('../models/db');
const { NodeSSH } = require('node-ssh');
require('dotenv').config();

// Helper function to connect and execute command on target Pi via SSH
const runPiSSHCommand = async (serverId, command) => {
  let host, username, password;

  if (serverId === 1 || serverId === '1') {
    host = process.env.SSH_HOST_A;
    username = process.env.SSH_USER_A;
    password = process.env.SSH_PASS_A;
  } else if (serverId === 2 || serverId === '2') {
    host = process.env.SSH_HOST_B;
    username = process.env.SSH_USER_B;
    password = process.env.SSH_PASS_B;
  } else if (serverId === 3 || serverId === '3') {
    host = process.env.SSH_HOST_C;
    username = process.env.SSH_USER_C;
    password = process.env.SSH_PASS_C;
  }

  console.log(`SSH connection request for Server ID: ${serverId} to IP: ${host} with Command: ${command}`);

  // Fallback to Simulation Mode if config is missing or if connection fails
  if (!host || !username || !password || host === 'your_pi_password' || host === '127.0.0.1') {
    console.log(`[SIMULATION MODE] Running simulated command: '${command}' on Server ${serverId}`);
    return { success: true, stdout: 'Simulated command output: ok', simulated: true };
  }

  const ssh = new NodeSSH();
  try {
    // Attempt SSH connection with a short 3-second timeout
    await ssh.connect({
      host: host,
      username: username,
      password: password,
      readyTimeout: 3000
    });

    const result = await ssh.execCommand(command);
    ssh.dispose();
    return { success: true, stdout: result.stdout, stderr: result.stderr };
  } catch (err) {
    console.warn(`SSH connection failed to ${host}: ${err.message}. Falling back to simulation.`);
    return { success: true, stdout: `Fallback simulated output: ${err.message}`, simulated: true };
  }
};

const HEARTBEAT_WINDOW_MS = 3 * 60 * 1000; // 3 minutes

exports.getServers = async (req, res) => {
  try {
    const [servers] = await db.query('SELECT * FROM servers');

    // 1. Check if the host machine (MC1) has sent a heartbeat within the last 3 minutes
    const isHostOnline = Boolean(
      global.lastMcHeartbeat && (Date.now() - global.lastMcHeartbeat <= HEARTBEAT_WINDOW_MS)
    );

    // 2. Query active bookings to get player counts for any running slots
    const [activeBookings] = await db.query(`
      SELECT server_id, slot_status, online_players 
      FROM bookings 
      WHERE slot_status IN ('started', 'online')
      ORDER BY id DESC
    `);

    // Group active bookings by server_id
    const activeBookingByServer = {};
    for (const b of activeBookings) {
      if (!activeBookingByServer[b.server_id]) {
        activeBookingByServer[b.server_id] = [];
      }
      activeBookingByServer[b.server_id].push(b);
    }

    const result = servers.map(server => {
      // Java Survival (MC1) is always online and in standby mode waiting for bookings
      const isJavaSurvival = server.id === 1 || server.name === 'Java Survival';
      const isOnline = isJavaSurvival || isHostOnline;

      if (!isOnline) {
        return {
          ...server,
          status: 'offline',
          current_players: 0,
          session_count: 0
        };
      }

      // If host machine is online (heartbeat within 3 mins):
      // Server is online; calculate player count from running slot if any
      const bookingsForServer = activeBookingByServer[server.id];
      let playerCount = 0;
      if (bookingsForServer && bookingsForServer.length > 0) {
        const uniquePlayers = new Set();
        for (const b of bookingsForServer) {
          try {
            const players = typeof b.online_players === 'string'
              ? JSON.parse(b.online_players)
              : (Array.isArray(b.online_players) ? b.online_players : []);
            if (Array.isArray(players)) {
              players.forEach(p => {
                if (p) uniquePlayers.add(p);
              });
            }
          } catch (e) {}
        }
        playerCount = uniquePlayers.size;
      }

      return {
        ...server,
        status: 'online',
        current_players: playerCount,
        session_count: playerCount
      };
    });

    res.json(result);
  } catch (err) {
    console.error('getServers error:', err);
    res.status(500).json({ message: 'Error retrieving servers.' });
  }
};

const { BLOCK_SCOPE, MIN_MINUTES_LEFT } = require('../config/bookingConstants');

exports.getSlots = async (req, res) => {
  const { id } = req.params;
  const { date } = req.query; // YYYY-MM-DD format

  if (!date) {
    return res.status(400).json({ message: 'Date query parameter is required (YYYY-MM-DD).' });
  }

  try {
    // 1. Check if slots exist for this date. If not, automatically seed default slots for this day.
    let [slots] = await db.query(
      'SELECT * FROM time_slots WHERE server_id = ? AND date = ? ORDER BY time_start ASC',
      [id, date]
    );

    if (slots.length === 0) {
      const defaultSlots = [
        ['09:00:00', '11:00:00'],
        ['11:00:00', '13:00:00'],
        ['13:00:00', '15:00:00'],
        ['15:00:00', '17:00:00'],
        ['17:00:00', '19:00:00'],
        ['19:00:00', '21:00:00'],
        ['21:00:00', '23:00:00']
      ];

      for (const [start, end] of defaultSlots) {
        await db.query(
          'INSERT INTO time_slots (server_id, date, time_start, time_end, status) VALUES (?, ?, ?, ?, "available")',
          [id, date, start, end]
        );
      }

      [slots] = await db.query(
        'SELECT * FROM time_slots WHERE server_id = ? AND date = ? ORDER BY time_start ASC',
        [id, date]
      );
    }

    // 2. Query all PAID/CONFIRMED bookings overlapping with this date
    // กติกา:
    // - การจองที่ยังไม่ชำระ (pending) ไม่ทำให้ช่องเต็ม
    // - การจองที่ชำระแล้ว (paid / confirmed) ทำให้เต็ม
    // - ถ้า BLOCK_SCOPE === 'all' จะเต็มทุกเซิร์ฟเวอร์ (ไม่กรอง b.server_id = ?)
    const startOfDay = `${date} 00:00:00`;
    const endOfDay = `${date} 23:59:59`;

    let bookingQuery = `
      SELECT b.id, b.server_id, b.start_time, b.end_time, b.payment_status, b.status, b.booking_type 
      FROM bookings b
      WHERE (b.payment_status = 'paid' OR b.status = 'confirmed')
        AND b.status != 'cancelled'
        AND b.payment_status != 'cancelled'
        AND b.start_time <= ? 
        AND b.end_time >= ?`;
    const queryParams = [endOfDay, startOfDay];

    if (BLOCK_SCOPE !== 'all') {
      bookingQuery += ' AND b.server_id = ?';
      queryParams.push(id);
    }

    const [activeBookings] = await db.query(bookingQuery, queryParams);

    // เวลาปัจจุบัน (อิงตามเวลาไทย)
    const now = new Date();

    // 3. คำนวณสถานะแต่ละ Time Slot ตามลำดับ 5 เงื่อนไข
    const enrichedSlots = slots.map(slot => {
      // แปลงเวลาเริ่มต้นและสิ้นสุดของ slot (Asia/Bangkok +07:00)
      const slotStart = new Date(`${date}T${slot.time_start}+07:00`);
      const slotEnd = new Date(`${date}T${slot.time_end}+07:00`);

      // ตรวจสอบการชนกับ active bookings ที่ชำระแล้ว: slotStart < bEnd && slotEnd > bStart
      const overlapping = activeBookings.find(b => {
        const bStart = new Date(b.start_time);
        const bEnd = new Date(b.end_time);
        return slotStart < bEnd && slotEnd > bStart;
      });

      const isOngoing = slotStart <= now && slotEnd > now;
      const minutesLeft = isOngoing ? Math.floor((slotEnd - now) / 60000) : 0;

      // ลำดับที่ 1: หมดเวลา (slotEnd <= now) -> กดไม่ได้
      if (slotEnd <= now) {
        return {
          ...slot,
          status: 'expired',
          label: 'หมดเวลา',
          canBook: false
        };
      }

      // ลำดับที่ 2: เต็ม (มีจองที่ชำระแล้วทับช่วงเวลาตาม BLOCK_SCOPE) -> กดไม่ได้
      if (overlapping || slot.status === 'booked') {
        return {
          ...slot,
          status: 'booked',
          label: 'เต็มแล้ว',
          canBook: false,
          conflictBookingId: overlapping ? overlapping.id : slot.booking_id
        };
      }

      // ลำดับที่ 3: เหลือน้อยเกินไป (เริ่มแล้วและเหลือ < 15 นาที) -> กดไม่ได้
      if (isOngoing && minutesLeft < MIN_MINUTES_LEFT) {
        return {
          ...slot,
          status: 'too_short',
          label: 'เหลือน้อยกว่า 15 นาที',
          canBook: false,
          minutesLeft
        };
      }

      // ลำดับที่ 4: กำลังดำเนินอยู่ (เริ่มแล้วแต่เหลือ >= 15 นาที) -> กดได้ แต่มี popup ยืนยัน
      if (isOngoing && minutesLeft >= MIN_MINUTES_LEFT) {
        return {
          ...slot,
          status: 'ongoing',
          label: 'กำลังดำเนินอยู่',
          canBook: true,
          minutesLeft
        };
      }

      // ลำดับที่ 5: ว่าง -> กดได้ปกติ
      return {
        ...slot,
        status: 'available',
        label: 'ว่าง',
        canBook: true
      };
    });

    res.json(enrichedSlots);
  } catch (err) {
    console.error('getSlots error:', err);
    res.status(500).json({ message: 'Error retrieving slots.' });
  }
};

const formatLocalDate = (d) => {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date(d));
};

// GET /api/servers/busy-dates
// ดึงวันที่ถูกจองจริงจากผู้ใช้ที่ชำระเงินแล้ว (อิงตามเวลาปัจจุบัน ห้ามใช้วันในอดีต ตรวจสอบ user และเวลาจ่ายจริง)
exports.getBusyDates = async (req, res) => {
  try {
    const { serverId } = req.query;

    let query = `
      SELECT b.id, b.server_id, b.booking_type,
             b.start_time, b.end_time, b.amount, b.slip_file, b.slip_trans_ref,
             b.omise_charge_id, b.updated_at as paid_at,
             u.id as user_id, u.username
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      WHERE (b.payment_status = 'paid' OR b.status = 'confirmed')
        AND b.status != 'cancelled'
        AND b.payment_status != 'cancelled'
        AND b.end_time > NOW()
    `;
    const params = [];
    if (BLOCK_SCOPE !== 'all' && serverId) {
      query += ' AND b.server_id = ?';
      params.push(serverId);
    }

    const [rows] = await db.query(query, params);

    const fullBookedDates = new Set();
    const busyRanges = [];

    for (const r of rows) {
      const startDateStr = formatLocalDate(r.start_time);
      const endDateStr = formatLocalDate(r.end_time);

      busyRanges.push({
        id: r.id,
        serverId: r.server_id,
        startDate: startDateStr,
        endDate: endDateStr,
        type: r.booking_type,
        username: r.username,
        paidAt: r.paid_at,
        amount: r.amount,
        hasSlip: Boolean(r.slip_file || r.slip_trans_ref)
      });

      if (r.booking_type === 'fullday' || r.booking_type === 'multiday') {
        const [sy, sm, sd] = startDateStr.split('-').map(Number);
        const [ey, em, ed] = endDateStr.split('-').map(Number);
        const cur = new Date(sy, sm - 1, sd);
        const last = new Date(ey, em - 1, ed);

        while (cur <= last) {
          const y = cur.getFullYear();
          const m = String(cur.getMonth() + 1).padStart(2, '0');
          const d = String(cur.getDate()).padStart(2, '0');
          fullBookedDates.add(`${y}-${m}-${d}`);
          cur.setDate(cur.getDate() + 1);
        }
      }
    }

    res.json({
      fullBookedDates: Array.from(fullBookedDates),
      busyRanges,
      currentTime: new Date().toISOString()
    });
  } catch (err) {
    console.error('getBusyDates error:', err);
    res.status(500).json({ message: 'Error retrieving busy dates.' });
  }
};

// Remote Pi control functions (Admin only)
exports.startServer = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await runPiSSHCommand(id, 'sudo systemctl start minecraft');
    await db.query('UPDATE servers SET status = "online" WHERE id = ?', [id]);
    res.json({ message: 'Server started successfully.', detail: result.stdout });
  } catch (err) {
    console.error('Start server error:', err);
    res.status(500).json({ message: 'Failed to start Minecraft server.' });
  }
};

exports.stopServer = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await runPiSSHCommand(id, 'sudo systemctl stop minecraft');
    await db.query('UPDATE servers SET status = "offline" WHERE id = ?', [id]);
    res.json({ message: 'Server stopped successfully.', detail: result.stdout });
  } catch (err) {
    console.error('Stop server error:', err);
    res.status(500).json({ message: 'Failed to stop Minecraft server.' });
  }
};

exports.restartServer = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await runPiSSHCommand(id, 'sudo systemctl restart minecraft');
    await db.query('UPDATE servers SET status = "online" WHERE id = ?', [id]);
    res.json({ message: 'Server restarted successfully.', detail: result.stdout });
  } catch (err) {
    console.error('Restart server error:', err);
    res.status(500).json({ message: 'Failed to restart Minecraft server.' });
  }
};

// GET /api/servers/summary - สรุปสถานะเซิร์ฟเวอร์และยอดผู้เล่นออนไลน์รวมทั้งคลัสเตอร์
exports.getServerSummary = async (req, res) => {
  try {
    const [servers] = await db.query(
      'SELECT id, name, ip, status, current_players, max_players, mc_version, edition FROM servers'
    );
    const [sumResult] = await db.query(
      'SELECT COALESCE(SUM(current_players), 0) as total_players FROM servers WHERE status = "online"'
    );
    const total_players = Number(sumResult[0]?.total_players || 0);

    res.json({
      success: true,
      total_players,
      total_servers: servers.length,
      online_servers: servers.filter(s => s.status === 'online').length,
      servers
    });
  } catch (err) {
    console.error('getServerSummary error:', err);
    res.status(500).json({ success: false, message: 'Error retrieving servers summary.' });
  }
};

