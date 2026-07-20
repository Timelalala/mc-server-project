const db = require('../models/db');

// Helper to generate a random Minecraft password
const generateMcPassword = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let randStr = '';
  for (let i = 0; i < 6; i++) {
    randStr += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `mc_${randStr}!`;
};

exports.createBooking = async (req, res) => {
  const { server_id, slot_id, amount } = req.body;
  const user_id = req.user.id;

  if (!server_id || !slot_id) {
    return res.status(400).json({ message: 'Server ID and Slot ID are required.' });
  }

  if (!req.file) {
    return res.status(400).json({ message: 'Payment slip upload is required.' });
  }

  const slip_file = req.file.filename;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Check if the slot is still available (lock row)
    const [slots] = await connection.query(
      'SELECT * FROM time_slots WHERE id = ? AND server_id = ? FOR UPDATE',
      [slot_id, server_id]
    );

    if (slots.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Time slot not found.' });
    }

    const slot = slots[0];
    if (slot.status !== 'available') {
      await connection.rollback();
      return res.status(400).json({ message: 'This time slot is no longer available.' });
    }

    // 2. Fetch server details to copy IP
    const [servers] = await connection.query('SELECT * FROM servers WHERE id = ?', [server_id]);
    if (servers.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Server not found.' });
    }
    const server = servers[0];

    // 3. Mark the slot as booked
    await connection.query(
      'UPDATE time_slots SET status = "booked" WHERE id = ?',
      [slot_id]
    );

    // 4. Generate IP, Port and Password
    const ip = server.ip;
    const port = 25565; // Default minecraft port
    const mc_password = generateMcPassword();

    // 5. Create booking record
    const [result] = await connection.query(
      'INSERT INTO bookings (user_id, server_id, slot_id, status, ip, port, mc_password, amount, slip_file) VALUES (?, ?, ?, "pending", ?, ?, ?, ?, ?)',
      [user_id, server_id, slot_id, ip, port, mc_password, amount || 150.00, slip_file]
    );

    await connection.commit();
    res.status(201).json({
      message: 'Booking created successfully. Waiting for admin verification.',
      bookingId: result.insertId
    });
  } catch (err) {
    await connection.rollback();
    console.error('Create booking transaction error:', err);
    res.status(500).json({ message: 'Server error during booking creation.' });
  } finally {
    connection.release();
  }
};

exports.getMyBookings = async (req, res) => {
  const user_id = req.user.id;

  try {
    const query = `
      SELECT 
        b.id, b.status, b.ip, b.port, b.mc_password, b.amount, b.slip_file, b.created_at,
        s.name AS server_name,
        t.date, t.time_start, t.time_end
      FROM bookings b
      JOIN servers s ON b.server_id = s.id
      JOIN time_slots t ON b.slot_id = t.id
      WHERE b.user_id = ?
      ORDER BY b.created_at DESC
    `;
    const [bookings] = await db.query(query, [user_id]);
    res.json(bookings);
  } catch (err) {
    console.error('getMyBookings error:', err);
    res.status(500).json({ message: 'Error retrieving your bookings.' });
  }
};
