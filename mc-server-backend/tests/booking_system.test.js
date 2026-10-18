const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../models/db');
const { validatePricingConsistency, calculateBookingPrice } = require('../services/pricingService');
const { processPaymentSuccess } = require('../controllers/paymentController');

test('=== 1. Pricing Consistency & Hourly Rate Tests ===', async (t) => {
  await t.test('ควรผ่าน: ราคาต่อชั่วโมงของ Daily (8 ชม.) ต่ำกว่า Slot (2 ชม.)', () => {
    const slotConfig = { durationHours: 2, price: 50 };   // 25.00 THB/hr
    const dailyConfig = { durationHours: 8, price: 160 }; // 20.00 THB/hr
    assert.equal(validatePricingConsistency(slotConfig, dailyConfig), true);
  });

  await t.test('ควรผ่าน: ราคาต่อชั่วโมงของ Daily เท่ากับ Slot พอดี', () => {
    const slotConfig = { durationHours: 4, price: 100 };  // 25.00 THB/hr
    const dailyConfig = { durationHours: 8, price: 200 };  // 25.00 THB/hr
    assert.equal(validatePricingConsistency(slotConfig, dailyConfig), true);
  });

  await t.test('ต้องปฏิเสธ: ราคาเฉลี่ยต่อชั่วโมงของ Daily แพงกว่า Slot', () => {
    const slotConfig = { durationHours: 4, price: 80 };   // 20.00 THB/hr
    const dailyConfig = { durationHours: 8, price: 240 }; // 30.00 THB/hr (แพงกว่า)
    assert.throws(() => {
      validatePricingConsistency(slotConfig, dailyConfig);
    }, /Pricing Inconsistency/);
  });

  await t.test('ต้องปฏิเสธ: แพ็กเกจ Daily มีระยะเวลาน้อยกว่า 8 ชั่วโมง', () => {
    const slotConfig = { durationHours: 2, price: 50 };
    const dailyConfig = { durationHours: 6, price: 100 }; // 6 ชั่วโมง < 8 ชั่วโมง
    assert.throws(() => {
      validatePricingConsistency(slotConfig, dailyConfig);
    }, /at least 8 hours/);
  });

  await t.test('คำนวณราคาประเภทต่างๆ จาก Pricing Rules ได้ถูกต้อง', async () => {
    const slotPrice = await calculateBookingPrice('timeslot', { slotCount: 2 });
    assert.equal(slotPrice, 100);

    const fullDayPrice = await calculateBookingPrice('fullday');
    assert.equal(fullDayPrice, 200);

    const multiDayPrice = await calculateBookingPrice('multiday', { days: 3 });
    assert.equal(multiDayPrice, 540); // 180 * 3
  });
});

test('=== 2. Time Overlap & Conflict Detection Tests ===', async (t) => {
  const TEST_SERVER_ID = 991;
  const TEST_USER_1 = 901;

  // Ensure test user exists for foreign key
  await db.query(`
    INSERT INTO users (id, username, email, password) 
    VALUES (?, 'test_user_901', 'test_user_901@example.com', 'password123')
    ON DUPLICATE KEY UPDATE username = 'test_user_901'
  `, [TEST_USER_1]);

  // Setup test environment
  await db.query(`DELETE FROM bookings WHERE server_id = ?`, [TEST_SERVER_ID]);
  await db.query(`
    INSERT INTO servers (id, name, ip, pi_host, status) 
    VALUES (?, 'Test Overlap Server', '127.0.0.1', '127.0.0.1', 'online')
    ON DUPLICATE KEY UPDATE status = 'online'
  `, [TEST_SERVER_ID]);

  await t.test('ตรวจพบการจองทับซ้อน (Overlap) กับรายการที่จ่ายเงินแล้ว (Paid)', async () => {
    // 1. สร้างรายการจองที่ PAID แล้ว 10:00 - 14:00
    await db.query(`
      INSERT INTO bookings (server_id, user_id, booking_type, start_time, end_time, amount, payment_status, ip)
      VALUES (?, ?, 'timeslot', '2026-11-01 10:00:00', '2026-11-01 14:00:00', 100, 'paid', '127.0.0.1')
    `, [TEST_SERVER_ID, TEST_USER_1]);

    // 2. ตรวจสอบว่าช่วงเวลา 12:00 - 16:00 (ทับซ้อน) ตรวจพบ Conflict หรือไม่
    const reqStart = '2026-11-01 12:00:00';
    const reqEnd = '2026-11-01 16:00:00';

    const [conflicts] = await db.query(`
      SELECT id, payment_status FROM bookings 
      WHERE server_id = ? 
        AND payment_status = 'paid'
        AND start_time < ? 
        AND end_time > ?
    `, [TEST_SERVER_ID, reqEnd, reqStart]);

    assert.equal(conflicts.length > 0, true, 'ควรตรวจพบ Conflict กับรายการที่ชำระเงินแล้ว');
  });

  await t.test('Idle Time Optimization: ช่วงเวลาติดกัน (Adjacent) 14:00 - 18:00 ต้องไม่ชนและจองได้', async () => {
    const adjacentStart = '2026-11-01 14:00:00';
    const adjacentEnd = '2026-11-01 18:00:00';

    const [conflicts] = await db.query(`
      SELECT id FROM bookings 
      WHERE server_id = ? 
        AND payment_status = 'paid'
        AND start_time < ? 
        AND end_time > ?
    `, [TEST_SERVER_ID, adjacentEnd, adjacentStart]);

    assert.equal(conflicts.length, 0, 'ช่วงเวลาติดกันต้องจองได้ ไม่บล็อกเวลาเกินจริง');
  });

  // Cleanup
  await db.query(`DELETE FROM bookings WHERE server_id = ?`, [TEST_SERVER_ID]);
  await db.query(`DELETE FROM servers WHERE id = ?`, [TEST_SERVER_ID]);
});

test('=== 3. Multi-Server Booking Independence Tests ===', async (t) => {
  const SERVER_A = 992;
  const SERVER_B = 993;
  const USER_ID = 905;

  await db.query(`
    INSERT INTO users (id, username, email, password) 
    VALUES (?, 'test_user_905', 'test_user_905@example.com', 'password123')
    ON DUPLICATE KEY UPDATE username = 'test_user_905'
  `, [USER_ID]);

  await db.query(`DELETE FROM bookings WHERE server_id IN (?, ?)`, [SERVER_A, SERVER_B]);
  await db.query(`
    INSERT INTO servers (id, name, ip, pi_host, status) VALUES 
    (?, 'Server Alpha', '127.0.0.1', '127.0.0.1', 'online'),
    (?, 'Server Beta', '127.0.0.1', '127.0.0.1', 'online')
    ON DUPLICATE KEY UPDATE status = 'online'
  `, [SERVER_A, SERVER_B]);

  await t.test('ผู้ใช้คนเดียวกันสามารถจอง Server Alpha และ Server Beta ในเวลาเดียวกันได้', async () => {
    const sameTimeStart = '2026-11-02 10:00:00';
    const sameTimeEnd = '2026-11-02 14:00:00';

    // จอง Server Alpha
    await db.query(`
      INSERT INTO bookings (server_id, user_id, booking_type, start_time, end_time, amount, payment_status, ip)
      VALUES (?, ?, 'timeslot', ?, ?, 100, 'paid', '127.0.0.1')
    `, [SERVER_A, USER_ID, sameTimeStart, sameTimeEnd]);

    // ตรวจสอบความว่างของ Server Beta สำหรับ User คนเดิม
    const [conflictsBeta] = await db.query(`
      SELECT id FROM bookings 
      WHERE server_id = ? 
        AND payment_status = 'paid'
        AND start_time < ? 
        AND end_time > ?
    `, [SERVER_B, sameTimeEnd, sameTimeStart]);

    assert.equal(conflictsBeta.length, 0, 'Server Beta ต้องยังคงว่างให้จองได้ แม้ user เดียวกันจะจอง Server Alpha อยู่');
  });

  // Cleanup
  await db.query(`DELETE FROM bookings WHERE server_id IN (?, ?)`, [SERVER_A, SERVER_B]);
  await db.query(`DELETE FROM servers WHERE id IN (?, ?)`, [SERVER_A, SERVER_B]);
});

test('=== 4. First-Paid-First-Served Concurrency Locking Tests ===', async (t) => {
  const TEST_SERVER_ID = 994;
  const USER_A = 910;
  const USER_B = 911;

  await db.query(`
    INSERT INTO users (id, username, email, password) VALUES 
    (?, 'test_user_910', 'test_user_910@example.com', 'pass1'),
    (?, 'test_user_911', 'test_user_911@example.com', 'pass2')
    ON DUPLICATE KEY UPDATE username = VALUES(username)
  `, [USER_A, USER_B]);

  await db.query(`DELETE FROM bookings WHERE server_id = ?`, [TEST_SERVER_ID]);
  await db.query(`
    INSERT INTO servers (id, name, ip, pi_host, status) 
    VALUES (?, 'Race Condition Node', '127.0.0.1', '127.0.0.1', 'online')
    ON DUPLICATE KEY UPDATE status = 'online'
  `, [TEST_SERVER_ID]);

  const targetStart = '2026-11-03 18:00:00';
  const targetEnd = '2026-11-03 22:00:00';

  // 1. จำลอง User A สร้าง pending booking
  const [resA] = await db.query(`
    INSERT INTO bookings (server_id, user_id, booking_type, start_time, end_time, amount, payment_status, lock_expires_at, ip)
    VALUES (?, ?, 'timeslot', ?, ?, 100, 'pending', DATE_ADD(NOW(), INTERVAL 15 MINUTE), '127.0.0.1')
  `, [TEST_SERVER_ID, USER_A, targetStart, targetEnd]);
  const bookingAId = resA.insertId;

  // 2. จำลอง User B สร้าง pending booking ชนช่วงเวลาเดียวกัน
  const [resB] = await db.query(`
    INSERT INTO bookings (server_id, user_id, booking_type, start_time, end_time, amount, payment_status, lock_expires_at, ip)
    VALUES (?, ?, 'timeslot', ?, ?, 100, 'pending', DATE_ADD(NOW(), INTERVAL 15 MINUTE), '127.0.0.1')
  `, [TEST_SERVER_ID, USER_B, targetStart, targetEnd]);
  const bookingBId = resB.insertId;

  await t.test('User B จ่ายเงินสำเร็จก่อน -> ได้รับสิทธิ์ล็อคสมบูรณ์ (paid)', async () => {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const result = await processPaymentSuccess(connection, bookingBId, 'TXN_B_WINNER_001');
      await connection.commit();

      assert.equal(result.success, true);

      const [checkB] = await db.query('SELECT payment_status, status FROM bookings WHERE id = ?', [bookingBId]);
      assert.equal(checkB[0].payment_status, 'paid');
      assert.equal(checkB[0].status, 'confirmed');
    } finally {
      connection.release();
    }
  });

  await t.test('User A ที่จ่ายทีหลัง ต้องถูกปฏิเสธ (409 Conflict) และสถานะถูก Cancel อัตโนมัติ', async () => {
    const connection = await db.getConnection();
    let thrownError = null;

    try {
      await connection.beginTransaction();
      await processPaymentSuccess(connection, bookingAId, 'TXN_A_LATE_002');
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      thrownError = err;
    } finally {
      connection.release();
    }

    assert.ok(thrownError, 'User A ต้องเกิด error');
    assert.equal(thrownError.status, 409, 'Status code ต้องเป็น 409 Conflict');
    assert.equal(thrownError.conflict, true);

    // ตรวจสอบสถานะในฐานข้อมูลว่า User A ถูก Cancelled
    const [checkA] = await db.query('SELECT payment_status FROM bookings WHERE id = ?', [bookingAId]);
    assert.equal(checkA[0].payment_status, 'cancelled');
  });

  // Cleanup
  await db.query(`DELETE FROM bookings WHERE server_id = ?`, [TEST_SERVER_ID]);
  await db.query(`DELETE FROM servers WHERE id = ?`, [TEST_SERVER_ID]);
});
