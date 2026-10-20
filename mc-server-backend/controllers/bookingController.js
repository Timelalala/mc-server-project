const db = require('../models/db');
const crypto = require('crypto');
const { calculateBookingPrice } = require('../services/pricingService');
const { BLOCK_SCOPE, MIN_MINUTES_LEFT } = require('../config/bookingConstants');

// Helper to generate a random Minecraft password
const generateMcPassword = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let randStr = '';
  for (let i = 0; i < 6; i++) {
    randStr += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `mc_${randStr}!`;
};

// Helper to format date object to YYYY-MM-DD in local time
const formatLocalDate = (d) => {
  if (!d) return null;
  if (typeof d === 'string') return d.slice(0, 10);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// POST /api/bookings
exports.createBooking = async (req, res) => {
  const {
    serverId: reqServerId,
    server_id: reqServerIdAlt,
    bookingType = 'timeslot',
    slotIds: reqSlotIds,
    slot_ids: reqSlotIdsAlt,
    startDate,
    endDate,
    startTime: reqStartTime,
    endTime: reqEndTime,
    amount: reqAmount
  } = req.body;

  const server_id = reqServerId || reqServerIdAlt;
  let slot_ids = reqSlotIds || reqSlotIdsAlt;
  if (!slot_ids && (req.body.slotId || req.body.slot_id)) {
    slot_ids = [req.body.slotId || req.body.slot_id];
  }
  const user_id = req.user?.id || req.body.userId || 1;

  if (!server_id) {
    return res.status(400).json({ message: 'กรุณาระบุ Server ID' });
  }

  const slip_file = req.file ? req.file.filename : null;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 1. ตรวจสอบว่า Server มีอยู่จริงและ Active หรือไม่
    const [servers] = await connection.query(
      'SELECT * FROM servers WHERE id = ? FOR SHARE',
      [server_id]
    );
    if (servers.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'ไม่พบเซิร์ฟเวอร์' });
    }
    const server = servers[0];
    if (server.status === 'maintenance' || server.status === 'retired') {
      await connection.rollback();
      return res.status(400).json({ message: 'เซิร์ฟเวอร์กำลังปิดปรับปรุง ไม่สามารถจองได้' });
    }

    const ip = server.ip || server.ip_address || '192.168.1.11';
    const port = server.port || 25565;
    const mc_password = generateMcPassword();
    const sessionId = crypto.randomUUID();

    // 2. คำนวณช่วงเวลา start_time และ end_time ให้เป็น DATETIME ต่อเนื่อง
    let computedStartTime = null;
    let computedEndTime = null;
    let computedStartDate = startDate || null;
    let computedEndDate = endDate || null;
    let calculatedAmount = 50.00;

    if (bookingType === 'timeslot') {
      if (!slot_ids || !Array.isArray(slot_ids) || slot_ids.length === 0) {
        await connection.rollback();
        return res.status(400).json({ message: 'กรุณาเลือกช่วงเวลาอย่างน้อย 1 ช่วง' });
      }

      // ดึงรายละเอียด slot
      const [slots] = await connection.query(
        'SELECT * FROM time_slots WHERE id IN (?) AND server_id = ? ORDER BY date ASC, time_start ASC',
        [slot_ids, server_id]
      );

      if (slots.length !== slot_ids.length) {
        await connection.rollback();
        return res.status(400).json({ message: 'พบช่วงเวลาที่ไม่ถูกต้องหรือไม่ได้อยู่ในเซิร์ฟเวอร์นี้' });
      }

      const earliest = slots[0];
      const latest = slots[slots.length - 1];
      computedStartDate = earliest.date;
      computedEndDate = latest.date;

      const startDateStr = formatLocalDate(earliest.date);
      const endDateStr = formatLocalDate(latest.date);

      computedStartTime = `${startDateStr} ${earliest.time_start}`;
      computedEndTime = `${endDateStr} ${latest.time_end}`;

      calculatedAmount = await calculateBookingPrice('timeslot', {
        slotCount: slot_ids.length,
        serverId: server_id
      });
    } else if (bookingType === 'fullday') {
      const fullDayDate = startDate || endDate || formatLocalDate(new Date());
      computedStartDate = fullDayDate;
      computedEndDate = fullDayDate;
      computedStartTime = `${fullDayDate} 00:00:00`;
      computedEndTime = `${fullDayDate} 23:59:59`;

      calculatedAmount = await calculateBookingPrice('fullday', { serverId: server_id });
    } else if (bookingType === 'multiday') {
      if (!startDate || !endDate) {
        await connection.rollback();
        return res.status(400).json({ message: 'กรุณาระบุวันเริ่มต้นและวันสิ้นสุด' });
      }
      computedStartDate = startDate;
      computedEndDate = endDate;
      computedStartTime = `${startDate} 00:00:00`;
      computedEndTime = `${endDate} 23:59:59`;

      const days = Math.max(1, Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1);
      calculatedAmount = await calculateBookingPrice('multiday', { days, serverId: server_id });
    } else if (bookingType === 'daily' || bookingType === 'slot') {
      // Direct timestamp booking
      if (!reqStartTime || !reqEndTime) {
        await connection.rollback();
        return res.status(400).json({ message: 'กรุณาระบุ startTime และ endTime' });
      }
      computedStartTime = reqStartTime;
      computedEndTime = reqEndTime;
      computedStartDate = reqStartTime.split(' ')[0];
      computedEndDate = reqEndTime.split(' ')[0];

      const durationHours = Math.max(1, (new Date(reqEndTime) - new Date(reqStartTime)) / (1000 * 60 * 60));
      calculatedAmount = await calculateBookingPrice(bookingType, { durationHours, serverId: server_id });
    } else {
      await connection.rollback();
      return res.status(400).json({ message: 'bookingType ไม่ถูกต้อง' });
    }

    // Final amount resolution
    const finalAmount = reqAmount
      ? (reqAmount > 500 && Number.isInteger(reqAmount) ? reqAmount / 100 : reqAmount)
      : calculatedAmount;

    // 3. Time Validation: ช่วงที่จบแล้วจองไม่ได้ และการจองกลางช่วงที่เหลือ < 15 นาที ห้ามจอง (ยกเว้น Admin ทดสอบ)
    const isAdmin = req.user?.role === 'admin';
    const now = new Date();
    const startDt = new Date(computedStartTime.replace(' ', 'T') + '+07:00');
    const endDt = new Date(computedEndTime.replace(' ', 'T') + '+07:00');

    if (!isAdmin && endDt <= now) {
      await connection.rollback();
      return res.status(400).json({ message: 'ช่วงเวลานี้หมดเวลาแล้ว ไม่สามารถจองได้' });
    }

    if (!isAdmin && startDt <= now && endDt > now) {
      const minsLeft = Math.floor((endDt - now) / 60000);
      if (minsLeft < MIN_MINUTES_LEFT) {
        await connection.rollback();
        return res.status(400).json({
          message: `ช่วงเวลานี้เหลือเวลาใช้งานเพียง ${minsLeft} นาที (น้อยกว่า ${MIN_MINUTES_LEFT} นาที) ไม่สามารถจองได้`
        });
      }
    }

    // 4. Time Overlap & Conflict Check (Server-side validation)
    // กติกา: การจองที่ยังไม่ชำระไม่ทำให้ช่องเต็ม การจองที่ชำระแล้วทำให้เต็ม (BLOCK_SCOPE = 'server')
    // ตรวจเฉพาะช่วงเวลาที่ยังเหลืออยู่ (ตั้งแต่ตอนนี้เป็นต้นไป) และไม่นับการจองที่จบไปแล้วในอดีต
    const conflictStart = startDt > now ? startDt : now;

    let conflictQuery = `
      SELECT b.id, b.server_id, b.booking_type, b.start_time, b.end_time, b.payment_status 
      FROM bookings b
      WHERE b.id != 0
        AND (b.payment_status = 'paid' OR b.status = 'confirmed')
        AND b.status NOT IN ('cancelled', 'completed')
        AND b.end_time > NOW()
        AND b.start_time < ? 
        AND b.end_time > ? 
      FOR UPDATE`;
    const conflictParams = [endDt, conflictStart];

    if (BLOCK_SCOPE !== 'all') {
      conflictQuery = `
        SELECT b.id, b.server_id, b.booking_type, b.start_time, b.end_time, b.payment_status 
        FROM bookings b
        WHERE b.server_id = ?
          AND b.id != 0
          AND (b.payment_status = 'paid' OR b.status = 'confirmed')
          AND b.status NOT IN ('cancelled', 'completed')
          AND b.end_time > NOW()
          AND b.start_time < ? 
          AND b.end_time > ? 
        FOR UPDATE`;
      conflictParams.unshift(server_id);
    }

    const [conflicts] = await connection.query(conflictQuery, conflictParams);

    if (!isAdmin && conflicts.length > 0) {
      await connection.rollback();
      const isDayBooking = bookingType === 'fullday' || bookingType === 'multiday';
      return res.status(409).json({
        message: isDayBooking
          ? 'วันที่เลือกมีผู้ใช้อื่นจองและชำระเงินในบางช่วงเวลาแล้ว กรุณาเลือกจองวันอื่น'
          : 'ช่วงเวลานี้ถูกจองและชำระเงินสำเร็จไปแล้ว กรุณาเลือกช่วงเวลาอื่น',
        conflictType: 'confirmed_overlap'
      });
    }

    // 5. ตั้งเวลา Lock สิทธิ์ชั่วคราว 15 นาที สำหรับการชำระเงิน (First-Paid-First-Served)
    const lockExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // 6. บันทึก Booking ลงฐานข้อมูล (สถานะ pending, ยังไม่ล็อก time_slots จนกว่าจะชำระเงิน)
    const [result] = await connection.query(
      `INSERT INTO bookings (
         user_id, server_id, slot_id, booking_type, 
         start_date, end_date, start_time, end_time, lock_expires_at,
         session_id, status, ip, port, mc_password, amount, slip_file, payment_status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, 'pending')`,
      [
        user_id, server_id, slot_ids ? slot_ids[0] : null, bookingType,
        computedStartDate, computedEndDate, computedStartTime, computedEndTime, lockExpiresAt,
        sessionId, ip, port, mc_password, finalAmount, slip_file
      ]
    );
    const bookingId = result.insertId;

    await connection.commit();

    return res.status(201).json({
      bookingId,
      sessionId,
      totalAmount: finalAmount,
      lockExpiresAt,
      startTime: computedStartTime,
      endTime: computedEndTime,
      message: 'สร้างการจองสำเร็จ กรุณาชำระเงินภายใน 15 นาที'
    });

  } catch (err) {
    await connection.rollback();
    console.error('Create booking error:', err);
    res.status(500).json({ message: 'Server error during booking creation: ' + err.message });
  } finally {
    connection.release();
  }
};

// POST /api/bookings/:id/cancel
exports.cancelBooking = async (req, res) => {
  const { id } = req.params;
  const user_id = req.user?.id || req.body.userId;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      'SELECT * FROM bookings WHERE id = ? AND status = "pending" FOR UPDATE',
      [id]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'ไม่พบการจองหรือไม่สามารถยกเลิกได้ (อาจได้รับการยืนยันแล้วหรือถูกยกเลิกแล้ว)' });
    }

    const booking = rows[0];
    if (user_id && booking.user_id !== user_id && req.user?.role !== 'admin') {
      await connection.rollback();
      return res.status(403).json({ message: 'ไม่มีสิทธิ์ยกเลิกการจองนี้' });
    }

    // Return slots back to 'available'
    await connection.query(
      'UPDATE time_slots SET status = "available", booking_id = NULL WHERE booking_id = ?',
      [id]
    );

    // Update booking status to 'cancelled'
    await connection.query(
      'UPDATE bookings SET status = "cancelled", payment_status = "cancelled", lock_expires_at = NULL WHERE id = ?',
      [id]
    );

    await connection.commit();
    res.json({ message: 'ยกเลิกการจองสำเร็จและคืนสิทธิ์ช่วงเวลาเรียบร้อยแล้ว' });
  } catch (err) {
    await connection.rollback();
    console.error('Cancel booking error:', err);
    res.status(500).json({ message: 'Server error during cancellation.' });
  } finally {
    connection.release();
  }
};

// GET /api/bookings/my
exports.getMyBookings = async (req, res) => {
  const user_id = req.user.id;

  try {
    const query = `
      SELECT 
        b.id, b.server_id, b.status, b.payment_status, b.ip, b.port, b.mc_password, b.amount, b.slip_file, 
        b.created_at, b.booking_type, b.start_date, b.end_date, b.start_time, b.end_time, b.lock_expires_at,
        b.slot_status, b.online_players, b.seen_players,
        s.name AS server_name, s.mc_version, s.mod_name, s.mod_version,
        t.date, t.time_start, t.time_end
      FROM bookings b
      JOIN servers s ON b.server_id = s.id
      LEFT JOIN time_slots t ON b.slot_id = t.id
      WHERE b.user_id = ?
        AND b.status NOT IN ('cancelled', 'expired')
        AND (b.payment_status IS NULL OR b.payment_status NOT IN ('cancelled', 'expired'))
      ORDER BY b.created_at DESC
    `;
    const [bookings] = await db.query(query, [user_id]);
    const now = Date.now();

    const formattedBookings = bookings.map(b => {
      const isExpired = b.end_time ? new Date(b.end_time).getTime() <= now : false;

      // หากหมดเวลาแล้ว (end_time <= now) ให้ปรับสถานะเป็น completed / stopped และซ่อนค่า IP ทันที
      const finalStatus = isExpired && (b.status === 'confirmed' || b.status === 'completed')
        ? 'completed'
        : b.status;
      const finalSlotStatus = isExpired ? 'stopped' : b.slot_status;
      const finalIp = (!isExpired && b.slot_status === 'started') ? b.ip : null;

      // ซิงค์ปรับปรุงฐานข้อมูลหากพบว่าหมดเวลาแต่สถานะยังเป็น confirmed หรือ started
      if (isExpired && (b.status === 'confirmed' || b.slot_status === 'started')) {
        db.query(
          `UPDATE bookings SET status = 'completed', slot_status = 'stopped' WHERE id = ?`,
          [b.id]
        ).catch(e => console.error(`Error updating expired booking ${b.id}:`, e));
      }

      return {
        ...b,
        status: finalStatus,
        slot_status: finalSlotStatus,
        ip: finalIp,
        online_players: JSON.parse(b.online_players || '[]'),
        seen_players: JSON.parse(b.seen_players || '[]'),
      };
    });

    res.json(formattedBookings);
  } catch (err) {
    console.error('getMyBookings error:', err);
    res.status(500).json({ message: 'Error retrieving your bookings.' });
  }
};

// ===== Session Management =====

// GET /api/servers/:id/session-count
exports.getSessionCount = async (req, res) => {
  const serverId = req.params.id;
  try {
    const [servers] = await db.query('SELECT * FROM servers WHERE id = ?', [serverId]);
    if (servers.length === 0) {
      return res.status(404).json({ message: 'ไม่พบเซิร์ฟเวอร์' });
    }

    const server = servers[0];
    const max = server.max_players || 20;

    // Count active sessions from sessions table or fallback to server.session_count
    const [activeCount] = await db.query(
      'SELECT COUNT(*) as current FROM sessions WHERE server_id = ? AND is_active = TRUE',
      [serverId]
    );

    const current = (activeCount && activeCount[0] && activeCount[0].current > 0)
      ? activeCount[0].current
      : (server.session_count || 0);

    const available = Math.max(0, max - current);
    const isFull = current >= max;

    res.json({
      serverId: Number(serverId),
      current,
      max,
      available,
      isFull
    });
  } catch (err) {
    console.error('getSessionCount error:', err);
    res.status(500).json({ message: 'Error retrieving session count.' });
  }
};

// POST /api/servers/:id/join
exports.joinServer = async (req, res) => {
  const serverId = req.params.id;
  const userId = req.user?.id || req.body.userId;
  const { bookingId, playerName } = req.body;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [servers] = await connection.query('SELECT * FROM servers WHERE id = ? FOR UPDATE', [serverId]);
    if (servers.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'ไม่พบเซิร์ฟเวอร์' });
    }

    const server = servers[0];
    const maxPlayers = server.max_players || 20;

    // Count current active sessions
    const [activeCount] = await connection.query(
      'SELECT COUNT(*) as current FROM sessions WHERE server_id = ? AND is_active = TRUE',
      [serverId]
    );
    const current = (activeCount && activeCount[0]) ? activeCount[0].current : 0;

    if (current >= maxPlayers) {
      await connection.rollback();
      return res.status(409).json({ message: `Server เต็มแล้ว (${current}/${maxPlayers} คน)` });
    }

    // Insert new session
    const [result] = await connection.query(
      `INSERT INTO sessions (server_id, booking_id, user_id, player_name, is_active)
       VALUES (?, ?, ?, ?, TRUE)`,
      [serverId, bookingId || 0, userId, playerName || `Player_${userId}`]
    );

    // Update server session_count
    await connection.query(
      'UPDATE servers SET session_count = ? WHERE id = ?',
      [current + 1, serverId]
    );

    await connection.commit();
    res.status(201).json({
      message: 'เข้าร่วมเซิร์ฟเวอร์สำเร็จ',
      sessionId: result.insertId,
      current: current + 1,
      max: maxPlayers
    });
  } catch (err) {
    await connection.rollback();
    console.error('joinServer error:', err);
    res.status(500).json({ message: 'Server error while joining server.' });
  } finally {
    connection.release();
  }
};

// POST /api/servers/:id/leave
exports.leaveServer = async (req, res) => {
  const serverId = req.params.id;
  const userId = req.user?.id || req.body.userId;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query(
      'UPDATE sessions SET is_active = FALSE, left_at = NOW() WHERE server_id = ? AND user_id = ? AND is_active = TRUE',
      [serverId, userId]
    );

    // Recalculate session_count
    const [activeCount] = await connection.query(
      'SELECT COUNT(*) as current FROM sessions WHERE server_id = ? AND is_active = TRUE',
      [serverId]
    );
    const current = (activeCount && activeCount[0]) ? activeCount[0].current : 0;

    await connection.query(
      'UPDATE servers SET session_count = ? WHERE id = ?',
      [current, serverId]
    );

    await connection.commit();
    res.json({ message: 'ออกจากเซิร์ฟเวอร์เรียบร้อย', current });
  } catch (err) {
    await connection.rollback();
    console.error('leaveServer error:', err);
    res.status(500).json({ message: 'Server error while leaving server.' });
  } finally {
    connection.release();
  }
};

// GET /api/bookings/recent (Public endpoint for recent bookings)
exports.getRecentBookings = async (req, res) => {
  try {
    const query = `
      SELECT 
        b.id,
        u.username,
        s.name AS serverName,
        DATE_FORMAT(COALESCE(b.start_time, b.created_at), '%e %b') AS date,
        CASE 
          WHEN b.start_time IS NOT NULL AND b.end_time IS NOT NULL 
          THEN CONCAT(DATE_FORMAT(b.start_time, '%H:%i'), ' - ', DATE_FORMAT(b.end_time, '%H:%i'))
          ELSE '14:00 - 16:00'
        END AS time,
        b.status
      FROM bookings b
      JOIN servers s ON b.server_id = s.id
      JOIN users u ON b.user_id = u.id
      ORDER BY b.created_at DESC
      LIMIT 5
    `;
    const [rows] = await db.query(query);
    res.json(rows);
  } catch (err) {
    console.error('getRecentBookings error:', err);
    res.status(500).json({ message: 'Error retrieving recent bookings.' });
  }
};
