const db = require('../models/db');

exports.getStats = async (req, res) => {
  try {
    const [userCount] = await db.query('SELECT COUNT(*) as count FROM users WHERE role = "user"');
    const [serverCount] = await db.query('SELECT COUNT(*) as count FROM servers');
    const [pendingCount] = await db.query('SELECT COUNT(*) as count FROM bookings WHERE status = "pending"');
    const [confirmedCount] = await db.query('SELECT COUNT(*) as count FROM bookings WHERE status = "confirmed"');
    const [revenueCount] = await db.query('SELECT SUM(amount) as total FROM bookings WHERE status = "confirmed"');
    const [playersSum] = await db.query('SELECT COALESCE(SUM(current_players), 0) as total FROM servers WHERE status = "online"');

    const totalOnline = Number(playersSum[0]?.total || 0);

    res.json({
      totalUsers: userCount[0].count,
      totalServers: serverCount[0].count,
      pendingBookings: pendingCount[0].count,
      activeBookings: confirmedCount[0].count,
      totalRevenue: revenueCount[0].total || 0,
      onlineUsers: totalOnline,
      total_players: totalOnline
    });
  } catch (err) {
    console.error('getStats error:', err);
    res.status(500).json({ message: 'Error fetching admin statistics.' });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const [users] = await db.query(`
      SELECT 
        u.id, u.username, u.email, u.role, 
        COALESCE(u.status, 'active') AS status, 
        u.created_at,
        (SELECT COUNT(*) FROM bookings b WHERE b.user_id = u.id) AS booking_count
      FROM users u
      ORDER BY u.id ASC
    `);
    res.json(users);
  } catch (err) {
    console.error('getUsers error:', err);
    res.status(500).json({ message: 'Error retrieving user list.' });
  }
};

exports.suspendUser = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query('SELECT status, role FROM users WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'ไม่พบผู้ใช้งาน' });
    }
    if (rows[0].role === 'admin') {
      return res.status(400).json({ message: 'ไม่สามารถระงับบัญชี Admin ได้' });
    }

    const currentStatus = rows[0].status || 'active';
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';

    await db.query('UPDATE users SET status = ? WHERE id = ?', [newStatus, id]);
    res.json({ message: `เปลี่ยนสถานะเป็น ${newStatus}`, status: newStatus });
  } catch (err) {
    console.error('suspendUser error:', err);
    res.status(500).json({ message: 'Server error during account suspension.' });
  }
};

exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    const [user] = await db.query('SELECT role FROM users WHERE id = ?', [id]);
    if (user.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    if (user[0].role === 'admin') {
      return res.status(400).json({ message: 'Cannot delete admin users.' });
    }

    await db.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'User deleted successfully.' });
  } catch (err) {
    console.error('deleteUser error:', err);
    res.status(500).json({ message: 'Error deleting user.' });
  }
};

exports.getAllBookings = async (req, res) => {
  try {
    const query = `
      SELECT 
        b.id, b.status, b.ip, b.port, b.mc_password, b.amount, b.slip_file, b.created_at,
        u.username, u.email,
        s.name AS server_name,
        t.date, t.time_start, t.time_end
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      JOIN servers s ON b.server_id = s.id
      JOIN time_slots t ON b.slot_id = t.id
      ORDER BY b.created_at DESC
    `;
    const [bookings] = await db.query(query);
    res.json(bookings);
  } catch (err) {
    console.error('getAllBookings error:', err);
    res.status(500).json({ message: 'Error fetching bookings list.' });
  }
};

exports.getPayments = async (req, res) => {
  const { status } = req.query; // pending, confirmed, cancelled
  try {
    let query = `
      SELECT 
        b.id, b.status, b.amount, b.slip_file, b.created_at,
        u.username, u.email,
        s.name AS server_name,
        t.date, t.time_start, t.time_end
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      JOIN servers s ON b.server_id = s.id
      JOIN time_slots t ON b.slot_id = t.id
    `;
    const params = [];
    if (status) {
      query += ' WHERE b.status = ?';
      params.push(status);
    }
    query += ' ORDER BY b.created_at DESC';

    const [payments] = await db.query(query, params);
    res.json(payments);
  } catch (err) {
    console.error('getPayments error:', err);
    res.status(500).json({ message: 'Error fetching payments list.' });
  }
};

exports.verifyPayment = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // confirmed or cancelled

  if (!status || !['confirmed', 'cancelled'].includes(status)) {
    return res.status(400).json({ message: 'Valid status ("confirmed" or "cancelled") is required.' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Fetch booking details
    const [bookings] = await connection.query(
      'SELECT slot_id, status FROM bookings WHERE id = ? FOR UPDATE',
      [id]
    );

    if (bookings.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Booking not found.' });
    }

    const booking = bookings[0];

    // Update booking status
    await connection.query(
      'UPDATE bookings SET status = ? WHERE id = ?',
      [status, id]
    );

    // If payment rejected/cancelled, make the slot available again
    if (status === 'cancelled') {
      await connection.query(
        'UPDATE time_slots SET status = "available" WHERE id = ?',
        [booking.slot_id]
      );
    }

    await connection.commit();
    res.json({ message: `Payment successfully verified and set to ${status}.` });
  } catch (err) {
    await connection.rollback();
    console.error('verifyPayment error:', err);
    res.status(500).json({ message: 'Error verifying payment.' });
  } finally {
    connection.release();
  }
};

// Time Slots API Endpoints
exports.getAllTimeSlots = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT ts.*, s.name AS server_name
      FROM time_slots ts
      JOIN servers s ON ts.server_id = s.id
      ORDER BY ts.date DESC, ts.time_start ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error('getAllTimeSlots error:', err);
    res.status(500).json({ message: 'Error fetching time slots list.' });
  }
};

exports.createTimeSlot = async (req, res) => {
  const { serverId, server_id, date, timeStart, time_start, timeEnd, time_end } = req.body;
  const targetServerId = serverId || server_id;
  const targetTimeStart = timeStart || time_start;
  const targetTimeEnd = timeEnd || time_end;

  if (!targetServerId || !date || !targetTimeStart || !targetTimeEnd) {
    return res.status(400).json({ message: 'กรุณากรอกข้อมูลช่วงเวลาให้ครบถ้วน (serverId, date, timeStart, timeEnd)' });
  }

  if (targetTimeEnd <= targetTimeStart) {
    return res.status(400).json({ message: 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น' });
  }

  try {
    // Check overlap with existing slots on the same server & date
    const [overlapSlots] = await db.query(
      `SELECT id, time_start, time_end FROM time_slots 
       WHERE server_id = ? AND date = ? 
       AND time_start < ? AND time_end > ?`,
      [targetServerId, date, targetTimeEnd, targetTimeStart]
    );

    if (overlapSlots.length > 0) {
      const conflict = overlapSlots[0];
      return res.status(409).json({ 
        message: `ช่วงเวลานี้ชนกับ Slot ที่มีอยู่แล้ว (${conflict.time_start.slice(0, 5)} - ${conflict.time_end.slice(0, 5)})` 
      });
    }

    const [result] = await db.query(
      'INSERT INTO time_slots (server_id, date, time_start, time_end, status) VALUES (?, ?, ?, ?, "available")',
      [targetServerId, date, targetTimeStart, targetTimeEnd]
    );
    res.status(201).json({ id: result.insertId, message: 'เพิ่มช่วงเวลาสำเร็จ' });
  } catch (err) {
    console.error('createTimeSlot error:', err);
    res.status(500).json({ message: 'Error adding time slot.' });
  }
};

exports.addSlot = exports.createTimeSlot;

// Bulk generate time slots for a day
exports.createBulkTimeSlots = async (req, res) => {
  const { serverId, date, startHour = 8, endHour = 24, slotDurationHours = 2 } = req.body;

  if (!serverId || !date) {
    return res.status(400).json({ message: 'กรุณาระบุ Server ID และวันที่' });
  }

  const sHour = Number(startHour);
  const eHour = Number(endHour);
  const duration = Number(slotDurationHours);

  if (sHour >= eHour || duration <= 0) {
    return res.status(400).json({ message: 'ช่วงเวลาหรือระยะเวลาของแต่ละ Slot ไม่ถูกต้อง' });
  }

  try {
    // Fetch existing slots on this server & date
    const [existing] = await db.query(
      'SELECT time_start, time_end FROM time_slots WHERE server_id = ? AND date = ?',
      [serverId, date]
    );

    let createdCount = 0;
    let skippedCount = 0;

    for (let h = sHour; h + duration <= eHour; h += duration) {
      const tStart = `${String(h).padStart(2, '0')}:00:00`;
      const tEnd = `${String(h + duration).padStart(2, '0')}:00:00`;

      // Check overlap
      const hasOverlap = existing.some(slot => slot.time_start < tEnd && slot.time_end > tStart);
      if (hasOverlap) {
        skippedCount++;
        continue;
      }

      await db.query(
        'INSERT INTO time_slots (server_id, date, time_start, time_end, status) VALUES (?, ?, ?, ?, "available")',
        [serverId, date, tStart, tEnd]
      );
      createdCount++;
    }

    res.json({
      message: `สร้าง Time Slot สำเร็จ ${createdCount} รายการ (ข้ามรายการที่ชนกัน ${skippedCount} รายการ)`,
      createdCount,
      skippedCount
    });
  } catch (err) {
    console.error('createBulkTimeSlots error:', err);
    res.status(500).json({ message: 'Error bulk creating time slots.' });
  }
};

exports.deleteTimeSlot = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query('SELECT status FROM time_slots WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'ไม่พบช่วงเวลาดังกล่าว' });
    }
    if (rows[0].status !== 'available') {
      return res.status(400).json({ message: 'ลบไม่ได้ เพราะมีการจองแล้ว' });
    }

    await db.query('DELETE FROM time_slots WHERE id = ?', [id]);
    res.json({ message: 'ลบสำเร็จ' });
  } catch (err) {
    console.error('deleteTimeSlot error:', err);
    res.status(500).json({ message: 'Error deleting time slot.' });
  }
};

exports.deleteSlot = exports.deleteTimeSlot;

// Update Pricing Rule
exports.updatePricingRule = async (req, res) => {
  const { id } = req.params;
  const { price, duration_hours, is_active } = req.body;

  try {
    const fields = [];
    const values = [];

    if (price !== undefined) {
      fields.push('price = ?');
      values.push(Number(price));
    }
    if (duration_hours !== undefined) {
      fields.push('duration_hours = ?');
      values.push(Number(duration_hours));
    }
    if (is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(Boolean(is_active));
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: 'ไม่มีข้อมูลที่ต้องอัปเดต' });
    }

    values.push(id);
    await db.query(`UPDATE pricing_rules SET ${fields.join(', ')} WHERE id = ?`, values);
    res.json({ message: 'อัปเดตกฎราคาสำเร็จ' });
  } catch (err) {
    console.error('updatePricingRule error:', err);
    res.status(500).json({ message: 'Error updating pricing rule.' });
  }
};


