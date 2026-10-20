const db = require('../models/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

exports.register = async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Please provide username, email, and password.' });
  }

  try {
    // Check if user already exists
    const [existing] = await db.query(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: 'Username or email already exists.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Determine role (make 'admin' if username is 'admin' or if it is the very first user)
    const [countResult] = await db.query('SELECT COUNT(*) as count FROM users');
    const role = (countResult[0].count === 0 || username.toLowerCase() === 'admin') ? 'admin' : 'user';

    // Insert user
    await db.query(
      'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      [username, email, hashedPassword, role]
    );

    res.status(201).json({ message: 'Registration successful!', role });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error during registration.' });
  }
};

exports.login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Please provide username and password.' });
  }

  try {
    const [users] = await db.query(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, username]
    );
    if (users.length === 0) {
      return res.status(400).json({ message: 'Invalid username or password.' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid username or password.' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'mc_server_secret_session_key_123!',
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login.' });
  }
};

exports.me = async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT id, username, email, role, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.json({ user: users[0] });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ message: 'Server error retrieving profile.' });
  }
};

// POST /api/auth/verify-reset-email
exports.verifyResetEmail = async (req, res) => {
  const { email, identifier, username } = req.body;
  const input = (identifier || email || username || '').trim();

  if (!input) {
    return res.status(400).json({ message: 'กรุณากรอกอีเมลหรือชื่อผู้ใช้' });
  }

  try {
    const [users] = await db.query(
      'SELECT id, username, email FROM users WHERE email = ? OR username = ?',
      [input, input]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: `ไม่พบบัญชีผู้ใช้งาน "${input}" ในระบบ` });
    }

    const user = users[0];
    res.json({
      success: true,
      message: `พบบัญชีผู้ใช้: ${user.username}`,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (err) {
    console.error('verifyResetEmail error:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการตรวจสอบอีเมล/ชื่อผู้ใช้' });
  }
};

// POST /api/auth/reset-password
exports.resetPassword = async (req, res) => {
  const { email, username, identifier, newPassword, confirmPassword } = req.body;
  const input = (identifier || email || username || '').trim();

  if (!input || !newPassword) {
    return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
  }

  if (confirmPassword && newPassword !== confirmPassword) {
    return res.status(400).json({ message: 'รหัสผ่านใหม่และการยืนยันไม่ตรงกัน' });
  }

  if (newPassword.length < 3) {
    return res.status(400).json({ message: 'รหัสผ่านต้องมีความยาวอย่างน้อย 3 ตัวอักษร' });
  }

  try {
    const [users] = await db.query(
      'SELECT id, username, email FROM users WHERE email = ? OR username = ?',
      [input, input]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: `ไม่พบบัญชีผู้ใช้งาน "${input}" ในระบบ` });
    }

    const user = users[0];

    // เข้ารหัสผ่านใหม่ด้วย bcrypt
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // อัปเดตรหัสผ่านใหม่ลงฐานข้อมูลตาม id ที่พบ
    const [updateResult] = await db.query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, user.id]
    );

    console.log(`[ResetPassword] Updated password for user id ${user.id} (${user.username}). Affected rows: ${updateResult.affectedRows}`);

    res.json({
      success: true,
      message: 'เปลี่ยนรหัสผ่านสำเร็จแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่',
      username: user.username
    });
  } catch (err) {
    console.error('resetPassword error:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน' });
  }
};

