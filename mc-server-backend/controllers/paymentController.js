require('dotenv').config();
const fs = require('fs');
const Omise = require('omise');
const db = require('../models/db');
const { BLOCK_SCOPE } = require('../config/bookingConstants');

const omise = Omise({
  publicKey: process.env.OMISE_PUBLIC_KEY || '',
  secretKey: process.env.OMISE_SECRET_KEY || '',
});

// Helper to check if Omise keys are valid configuration (not default placeholders)
const isOmiseConfigured = () => {
  const pKey = process.env.OMISE_PUBLIC_KEY || '';
  const sKey = process.env.OMISE_SECRET_KEY || '';
  return pKey.length > 10 && sKey.length > 10 && !pKey.includes('xxxx') && !sKey.includes('xxxx');
};

/**
 * First-Paid-First-Served Payment Finalizer
 * ทำงานภายใต้ Database Transaction ด้วย Row-Level Locking (SELECT ... FOR UPDATE)
 * เพื่อป้องกัน Race Condition โดยสมบูรณ์
 */
async function processPaymentSuccess(connection, bookingId, chargeId = null) {
  // 1. Lock แถวของ booking นี้เพื่อตรวจเช็คสถานะปัจจุบัน
  const [bookings] = await connection.query(
    'SELECT * FROM bookings WHERE id = ? FOR UPDATE',
    [bookingId]
  );

  if (bookings.length === 0) {
    throw { status: 404, message: 'ไม่พบข้อมูลการจอง' };
  }

  const booking = bookings[0];

  // ถ้าชำระเงินเรียบร้อยไปแล้ว
  if (booking.payment_status === 'paid') {
    return { success: true, alreadyPaid: true, booking };
  }

  // ถ้าถูกยกเลิกไปแล้ว (เพราะหมดเวลาหรือมีคนอื่นแย่งชำระเงินไปก่อน)
  if (booking.payment_status === 'cancelled' || booking.payment_status === 'expired') {
    throw {
      status: 409,
      conflict: true,
      message: 'รายการจองนี้ถูกยกเลิกไปแล้ว เนื่องจากมีผู้ใช้อื่นชำระเงินในรอบเวลานี้สำเร็จก่อนหน้าคุณ (First-Paid-First-Served)'
    };
  }

  // ตรวจสอบว่าผู้จองเป็น admin หรือไม่ (admin จองเพื่อทดสอบระบบ)
  const [userRows] = await connection.query('SELECT role FROM users WHERE id = ?', [booking.user_id]);
  const isBookingAdmin = userRows.length > 0 && userRows[0].role === 'admin';

  // 2. Concurrency Check: ตรวจสอบว่ามีผู้ใช้อื่นชำระเงิน (paid) ในช่วงเวลาที่ทับซ้อนกันตัดหน้าไปแล้วหรือไม่
  // เงื่อนไข Overlap: start_time < booking.end_time AND end_time > booking.start_time
  // ตามกติกา BLOCK_SCOPE = 'all': ชำระแล้วเต็มทุกเซิร์ฟเวอร์
  let paidConflictQuery = `
    SELECT b.id, b.server_id FROM bookings b
    LEFT JOIN users u ON b.user_id = u.id
    WHERE b.id != ? 
      AND (u.role IS NULL OR u.role != 'admin')
      AND (b.payment_status = 'paid' OR b.status = 'confirmed')
      AND b.start_time < ? 
      AND b.end_time > ? 
    FOR UPDATE`;
  let paidParams = [booking.id, booking.end_time, booking.start_time];

  if (BLOCK_SCOPE !== 'all') {
    paidConflictQuery = `
      SELECT b.id, b.server_id FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      WHERE b.server_id = ? 
        AND b.id != ? 
        AND (u.role IS NULL OR u.role != 'admin')
        AND (b.payment_status = 'paid' OR b.status = 'confirmed')
        AND b.start_time < ? 
        AND b.end_time > ? 
      FOR UPDATE`;
    paidParams = [booking.server_id, booking.id, booking.end_time, booking.start_time];
  }

  const [paidConflicts] = await connection.query(paidConflictQuery, paidParams);

  if (!isBookingAdmin && paidConflicts.length > 0) {
    // กติกา: ตอนยืนยันการชำระถ้าชนกัน ห้ามเปลี่ยนเป็นชำระแล้ว แต่รายงานผู้ใช้ก่อนว่าจะจัดการอย่างไร
    throw {
      status: 409,
      conflict: true,
      message: 'ช่วงเวลานี้มีผู้ใช้อื่นชำระเงินสำเร็จไปก่อนแล้ว ระบบไม่สามารถเปลี่ยนสถานะเป็นชำระแล้วได้ (กรุณาติดต่อเจ้าหน้าที่เพื่อดำเนินการคืนเงินหรือเปลี่ยนรอบเวลา)'
    };
  }

  // 3. ถ้าไม่มีใครตัดหน้า -> สิทธิ์เป็นของผู้ใช้คนนี้ทันที (Mark as PAID)
  await connection.query(
    `UPDATE bookings 
     SET status = 'confirmed', payment_status = 'paid', lock_expires_at = NULL,
         omise_charge_id = COALESCE(?, omise_charge_id)
     WHERE id = ?`,
    [chargeId, booking.id]
  );

  // อัปเดต time_slots ของ booking นี้ให้เป็น booked
  if (!isBookingAdmin && booking.slot_id) {
    await connection.query(
      "UPDATE time_slots SET status = 'booked' WHERE booking_id = ? OR id = ?",
      [booking.id, booking.slot_id]
    );
  }

  // 4. Auto-cancel รายการ pending อื่นๆ ทั้งหมดที่ทับซ้อนกับช่วงเวลานี้
  if (!isBookingAdmin) {
    let cancelQuery = `
      SELECT id, slot_id FROM bookings 
      WHERE id != ? 
        AND payment_status = 'pending'
        AND start_time < ? 
        AND end_time > ?`;
    let cancelParams = [booking.id, booking.end_time, booking.start_time];

    if (BLOCK_SCOPE !== 'all') {
      cancelQuery = `
        SELECT id, slot_id FROM bookings 
        WHERE server_id = ? 
          AND id != ? 
          AND payment_status = 'pending'
          AND start_time < ? 
          AND end_time > ?`;
      cancelParams = [booking.server_id, booking.id, booking.end_time, booking.start_time];
    }

    const [overlappingPending] = await connection.query(cancelQuery, cancelParams);

    if (overlappingPending.length > 0) {
      const pendingIds = overlappingPending.map(p => p.id);
      await connection.query(
        `UPDATE bookings 
         SET status = 'cancelled', payment_status = 'cancelled', lock_expires_at = NULL 
         WHERE id IN (?)`,
        [pendingIds]
      );
      console.log(`[First-Paid-First-Served] Auto-cancelled ${pendingIds.length} conflicting pending bookings:`, pendingIds);
    }
  }

  return { success: true, alreadyPaid: false, booking };
}

// POST /api/payment/create-charge
// สร้าง PromptPay Charge + QR Code
async function createCharge(req, res) {
  const { bookingId, amount = 5000 } = req.body;
  const userId = req.user.id;

  try {
    const [rows] = await db.query(
      'SELECT * FROM bookings WHERE id=? AND user_id=?',
      [bookingId, userId]
    );
    if (!rows[0]) return res.status(404).json({ message: 'ไม่พบการจอง' });
    if (rows[0].payment_status === 'paid') {
      return res.status(400).json({ message: 'การจองนี้ได้รับการชำระเงินเรียบร้อยแล้ว' });
    }
    if (rows[0].payment_status === 'cancelled') {
      return res.status(409).json({ message: 'การจองนี้ถูกยกเลิกแล้ว เนื่องจากมีผู้อื่นชำระเงินช่วงเวลานี้ไปแล้ว' });
    }

    // Fallback to Simulation Mode if Omise keys are not configured
    if (!isOmiseConfigured()) {
      console.log(`[OMISE SIMULATION] Using simulated PromptPay QR for booking ID ${bookingId}`);
      const mockChargeId = `chg_test_sim_${Date.now()}`;
      const dummyQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=PROMPTPAY_MOCK_PAYMENT_BOOKING_${bookingId}`;

      await db.query(
        'UPDATE bookings SET omise_charge_id=?, payment_status=? WHERE id=?',
        [mockChargeId, 'pending', bookingId]
      );

      return res.json({
        chargeId: mockChargeId,
        qrUrl: dummyQrUrl,
        amount: amount,
        currency: 'THB',
        status: 'pending',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        simulated: true,
        message: 'จำลองการสร้าง QR Code PromptPay (First-Paid-First-Served Active)'
      });
    }

    // สร้าง Charge บน Omise
    const charge = await omise.charges.create({
      amount: amount,
      currency: 'THB',
      source: { type: 'promptpay' },
      metadata: { booking_id: bookingId, user_id: userId },
    });

    const qrUrl = charge.source?.scannable_code?.image?.download_uri || null;

    await db.query(
      'UPDATE bookings SET omise_charge_id=?, payment_status=? WHERE id=?',
      [charge.id, 'pending', bookingId]
    );

    res.json({
      chargeId: charge.id,
      qrUrl,
      amount: charge.amount,
      currency: charge.currency,
      status: charge.status,
      expiresAt: charge.expires_at,
      authorizeUri: charge.authorize_uri,
    });
  } catch (err) {
    console.error('Create charge error:', err);
    res.status(500).json({ message: 'สร้าง QR Code ไม่สำเร็จ', error: err.message });
  }
}

// GET /api/payment/status/:chargeId
async function getChargeStatus(req, res) {
  const { chargeId } = req.params;
  const connection = await db.getConnection();

  try {
    // 1. Simulation Check
    if (chargeId.startsWith('chg_test_sim_')) {
      const [bookings] = await connection.query('SELECT * FROM bookings WHERE omise_charge_id=?', [chargeId]);
      const booking = bookings[0];

      return res.json({
        chargeId: chargeId,
        status: booking ? (booking.payment_status === 'paid' ? 'successful' : booking.payment_status) : 'pending',
        paid: booking ? booking.payment_status === 'paid' : false,
        amount: booking ? Math.round(booking.amount * 100) : 5000,
        simulated: true
      });
    }

    // 2. Real Omise Charge Check
    const charge = await omise.charges.retrieve(chargeId);
    const bookingId = charge.metadata?.booking_id;

    if (bookingId && charge.status === 'successful') {
      await connection.beginTransaction();
      try {
        await processPaymentSuccess(connection, bookingId, charge.id);
        await connection.commit();
      } catch (err) {
        await connection.rollback();
        if (err.conflict) {
          return res.status(409).json({ message: err.message, status: 'conflict' });
        }
        throw err;
      }
    } else if (bookingId && ['failed', 'expired'].includes(charge.status)) {
      await connection.query(
        "UPDATE bookings SET status='cancelled', payment_status=? WHERE id=?",
        [charge.status, bookingId]
      );
      await connection.query(
        "UPDATE time_slots SET status='available', booking_id=NULL WHERE booking_id=?",
        [bookingId]
      );
    }

    res.json({
      chargeId: charge.id,
      status: charge.status,
      paid: charge.paid,
      amount: charge.amount,
    });
  } catch (err) {
    console.error('getChargeStatus error:', err);
    res.status(500).json({ message: 'ดึงสถานะไม่สำเร็จ', error: err.message });
  } finally {
    connection.release();
  }
}

// POST /api/payment/webhook
async function webhook(req, res) {
  const event = req.body;

  if (event.key === 'charge.complete') {
    const charge = event.data;
    const bookingId = charge.metadata?.booking_id;

    if (bookingId) {
      const connection = await db.getConnection();
      try {
        if (charge.status === 'successful') {
          await connection.beginTransaction();
          await processPaymentSuccess(connection, bookingId, charge.id);
          await connection.commit();
          console.log(`✅ Webhook: Booking ${bookingId} paid & secured via first-paid-first-served`);
        } else if (['failed', 'expired'].includes(charge.status)) {
          await connection.query(
            "UPDATE bookings SET status='cancelled', payment_status=? WHERE id=?",
            [charge.status, bookingId]
          );
          await connection.query(
            "UPDATE time_slots SET status='available', booking_id=NULL WHERE booking_id=?",
            [bookingId]
          );
        }
      } catch (err) {
        await connection.rollback();
        console.error('Webhook processing error:', err);
      } finally {
        connection.release();
      }
    }
  }

  res.status(200).json({ received: true });
}

// POST /api/payment/simulate-success
// จำลองการชำระเงินสำเร็จ พร้อมทดสอบ Concurrency Locking (First-Paid-First-Served)
async function simulateSuccess(req, res) {
  const { bookingId } = req.body;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const result = await processPaymentSuccess(connection, bookingId, `sim_paid_${Date.now()}`);

    await connection.commit();

    return res.json({
      success: true,
      message: 'จำลองการชำระเงินสำเร็จ สิทธิ์ถูกล็อกให้คุณเรียบร้อยแล้ว!',
      bookingId: Number(bookingId),
      status: 'confirmed',
      payment_status: 'paid'
    });
  } catch (err) {
    await connection.rollback();
    if (err.conflict) {
      return res.status(409).json({ message: err.message });
    }
    if (err.status) {
      return res.status(err.status).json({ message: err.message });
    }
    console.error('simulateSuccess error:', err);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการประมวลผลการชำระเงิน: ' + err.message });
  } finally {
    connection.release();
  }
}

// POST /api/payment/verify-slip
// ตรวจสอบสลิปโอนเงินผ่าน EasySlip API
async function verifySlip(req, res) {
  const { bookingId } = req.body;

  if (!bookingId) {
    return res.status(400).json({ message: 'กรุณาระบุ bookingId' });
  }

  if (!req.file) {
    return res.status(400).json({ message: 'กรุณาอัปโหลดรูปภาพสลิปโอนเงิน' });
  }

  const filePath = req.file.path;
  const connection = await db.getConnection();

  try {
    // 1. ตรวจสอบข้อมูลการจอง
    const [bookings] = await connection.query(
      'SELECT * FROM bookings WHERE id = ?',
      [bookingId]
    );

    if (bookings.length === 0) {
      return res.status(404).json({ message: 'ไม่พบข้อมูลการจอง' });
    }

    const booking = bookings[0];

    if (booking.payment_status === 'paid') {
      return res.json({
        success: true,
        alreadyPaid: true,
        message: 'รายการจองนี้ชำระเงินเรียบร้อยแล้ว'
      });
    }

    if (booking.payment_status === 'cancelled' || booking.payment_status === 'expired') {
      return res.status(409).json({
        message: 'รายการจองนี้ถูกยกเลิกไปแล้ว เนื่องจากหมดเวลาชำระเงินหรือมีผู้อื่นชำระเงินตัดหน้าไปก่อน'
      });
    }

    // 2. เรียก EasySlip API (v1 /verify)
    const apiKey = process.env.EASYSLIP_API_KEY || 'd9e3ac4b-6328-4de4-a5a3-2836f5716fb8';
    const fileBuffer = fs.readFileSync(filePath);
    const blob = new Blob([fileBuffer], { type: req.file.mimetype || 'image/jpeg' });
    const formData = new FormData();
    formData.append('file', blob, req.file.originalname || 'slip.jpg');

    let easySlipRes;
    try {
      const response = await fetch('https://api.easyslip.com/v1/verify', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        body: formData
      });
      easySlipRes = await response.json();
    } catch (apiErr) {
      console.error('EasySlip connection error:', apiErr);
      return res.status(502).json({ message: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ตรวจสอบสลิป EasySlip ได้: ' + apiErr.message });
    }

    if (!easySlipRes || easySlipRes.status !== 200 || !easySlipRes.data) {
      const errCode = easySlipRes?.message || 'unknown_error';
      const errorMap = {
        'invalid_image': 'รูปภาพสลิปไม่ถูกต้อง หรือไม่พบ QR Code บนสลิป',
        'slip_not_found': 'ไม่พบข้อมูลรายการโอนเงินนี้ในระบบธนาคาร',
        'duplicate_slip': 'สลิปนี้ถูกใช้งานไปแล้วในระบบ EasySlip',
        'unauthorized': 'API Key ไม่ถูกต้อง',
        'out_of_quota': 'โควตาการตรวจสอบสลิปใน EasySlip หมด'
      };
      const thMsg = errorMap[errCode] || `สลิปไม่ผ่านการตรวจสอบ (${errCode})`;
      return res.status(400).json({ message: thMsg, errorDetail: easySlipRes });
    }

    const slipData = easySlipRes.data;
    const transRef = slipData.transRef;
    const transferAmount = Number(slipData.amount?.amount ?? slipData.amount ?? 0);

    // 3. ตรวจสอบสลิปซ้ำใน Database ตัวเอง (Anti-Replay Protection)
    const [existingSlip] = await connection.query(
      'SELECT id FROM bookings WHERE slip_trans_ref = ? AND id != ?',
      [transRef, bookingId]
    );

    if (existingSlip.length > 0) {
      return res.status(400).json({
        message: `สลิปนี้ถูกใช้ยืนยันการจองไปแล้วในระบบ (Ref: ${transRef}) ไม่สามารถใช้ซ้ำได้`
      });
    }

    // 4. ตรวจสอบยอดเงินโอนจริงเทียบกับราคาการจอง
    const requiredAmount = Number(booking.amount);
    if (transferAmount < requiredAmount) {
      return res.status(400).json({
        message: `ยอดเงินในสลิป (${transferAmount} บาท) ไม่พอกับค่าบริการที่ต้องชำระ (${requiredAmount} บาท)`
      });
    }

    // 5. บันทึกผลสำเร็จภายใต้ Transaction (First-Paid-First-Served)
    await connection.beginTransaction();

    await connection.query(
      'UPDATE bookings SET slip_file = ?, slip_trans_ref = ? WHERE id = ?',
      [req.file.filename, transRef, bookingId]
    );

    const payResult = await processPaymentSuccess(connection, bookingId, `easyslip_${transRef}`);

    await connection.commit();

    return res.json({
      success: true,
      message: 'ตรวจสอบสลิปสำเร็จ! ชำระเงินเรียบร้อยและล็อกสิทธิ์เซิร์ฟเวอร์แล้ว',
      data: {
        bookingId: Number(bookingId),
        transRef,
        amount: transferAmount,
        date: slipData.date,
        sender: slipData.sender,
        receiver: slipData.receiver
      }
    });

  } catch (err) {
    await connection.rollback();
    if (err.conflict) {
      return res.status(409).json({ message: err.message });
    }
    if (err.status) {
      return res.status(err.status).json({ message: err.message });
    }
    console.error('verifySlip error:', err);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการตรวจสอบสลิป: ' + (err.message || err) });
  } finally {
    connection.release();
  }
}

module.exports = {
  createCharge,
  getChargeStatus,
  webhook,
  simulateSuccess,
  processPaymentSuccess,
  verifySlip
};
