const db = require('../models/db');

exports.getStats = async (req, res) => {
  try {
    const [userCount] = await db.query('SELECT COUNT(*) as count FROM users WHERE role = "user"');
    const [serverCount] = await db.query('SELECT COUNT(*) as count FROM servers');
    const [pendingCount] = await db.query('SELECT COUNT(*) as count FROM bookings WHERE status = "pending"');
    const [confirmedCount] = await db.query('SELECT COUNT(*) as count FROM bookings WHERE status = "confirmed"');
    const [revenueCount] = await db.query('SELECT SUM(amount) as total FROM bookings WHERE status = "confirmed"');

    res.json({
      totalUsers: userCount[0].count,
      totalServers: serverCount[0].count,
      pendingBookings: pendingCount[0].count,
      activeBookings: confirmedCount[0].count,
      totalRevenue: revenueCount[0].total || 0
    });
  } catch (err) {
    console.error('getStats error:', err);
    res.status(500).json({ message: 'Error fetching admin statistics.' });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const [users] = await db.query('SELECT id, username, email, role, created_at FROM users');
    res.json(users);
  } catch (err) {
    console.error('getUsers error:', err);
    res.status(500).json({ message: 'Error retrieving user list.' });
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

exports.addSlot = async (req, res) => {
  const { server_id, date, time_start, time_end } = req.body;
  if (!server_id || !date || !time_start || !time_end) {
    return res.status(400).json({ message: 'All slot details (server_id, date, time_start, time_end) are required.' });
  }
  try {
    await db.query(
      'INSERT INTO time_slots (server_id, date, time_start, time_end, status) VALUES (?, ?, ?, ?, "available")',
      [server_id, date, time_start, time_end]
    );
    res.status(201).json({ message: 'Time slot added successfully.' });
  } catch (err) {
    console.error('addSlot error:', err);
    res.status(500).json({ message: 'Error adding time slot.' });
  }
};

exports.deleteSlot = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM time_slots WHERE id = ?', [id]);
    res.json({ message: 'Time slot deleted successfully.' });
  } catch (err) {
    console.error('deleteSlot error:', err);
    res.status(500).json({ message: 'Error deleting time slot.' });
  }
};

