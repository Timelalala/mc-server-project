import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

const API_BASE = 'http://127.0.0.1:5000/api';
const LOG_FILE = path.join(rootDir, 'tests/created-bookings.log');
const REPORTS_DIR = path.join(rootDir, 'tests/reports');

// ฟังก์ชันสร้าง timestamp วันเวลาสำหรับชื่อไฟล์รายงาน
const getTimestamp = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${min}`;
};

// Helper สร้างวันที่ในอนาคต (>= 60 วันข้างหน้า) ที่ยังไม่มีการจองใดๆ
const getFreeFutureDates = async (startDays, count = 1) => {
  let days = startDays;
  while (days < startDays + 500) {
    let allClear = true;
    const dates = [];
    for (let i = 0; i < count; i++) {
      const d = new Date();
      d.setDate(d.getDate() + days + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      dates.push(dateStr);
      try {
        const res = await fetch(`${API_BASE}/servers/1/slots?date=${dateStr}`);
        if (res.ok) {
          const slots = await res.json();
          if (slots.some(s => s.status === 'booked')) {
            allClear = false;
            break;
          }
        }
      } catch (e) {
        allClear = false;
        break;
      }
    }
    if (allClear) {
      return { dates, nextStart: days + count + 2 };
    }
    days += count;
  }
  const fallback = [];
  for (let i = 0; i < count; i++) {
    const d = new Date();
    d.setDate(d.getDate() + days + i);
    fallback.push(d.toISOString().split('T')[0]);
  }
  return { dates: fallback, nextStart: days + count + 2 };
};

// จดบันทึก booking ID ที่ชำระแล้วลงใน created-bookings.log
const logPaidBooking = (id, detail) => {
  const line = `[${new Date().toISOString()}] ID: ${id} | ${detail}\n`;
  fs.appendFileSync(LOG_FILE, line, 'utf8');
};

// บันทึกรายงานผลการทดสอบเป็น JSON
const reportResults = [];

test('API Suite: กติกาการจองเซิร์ฟเวอร์ Minecraft (BLOCK_SCOPE="all")', async (t) => {
  let userToken = '';
  let adminToken = '';
  const pendingBookingIds = [];

  // ค้นหาวันที่ว่างในอนาคต (>= 60 วันข้างหน้า) ไม่ชนกับ test run รอบก่อนๆ แน่นอน
  let currentOffset = 65;
  const res2 = await getFreeFutureDates(currentOffset, 1);
  const dateTest2 = res2.dates[0];
  currentOffset = res2.nextStart;

  const res3 = await getFreeFutureDates(currentOffset, 1);
  const dateTest3 = res3.dates[0];
  currentOffset = res3.nextStart;

  const res5 = await getFreeFutureDates(currentOffset, 1);
  const dateTest5 = res5.dates[0];
  currentOffset = res5.nextStart;

  const res6 = await getFreeFutureDates(currentOffset, 3);
  const dateTest6Start = res6.dates[0];
  const dateTest6End = res6.dates[2];
  currentOffset = res6.nextStart;

  const res8 = await getFreeFutureDates(currentOffset, 1);
  const dateTest8 = res8.dates[0];

  // เข้าสู่ระบบเพื่อรับ Token
  try {
    const loginUser = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'autotest_user', password: 'password123' })
    }).then(r => r.json());
    userToken = loginUser.token;

    const loginAdmin = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'password123' })
    }).then(r => r.json());
    adminToken = loginAdmin.token;
  } catch (err) {
    console.error('Login error:', err);
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${userToken}`
  };

  const adminHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`
  };

  // Helper สร้างการจอง
  const createBookingReq = async (body, headers = authHeaders) => {
    const res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...body,
        note: 'AUTOTEST'
      })
    });
    const data = await res.json();
    if (res.status === 201 && data.bookingId) {
      pendingBookingIds.push(data.bookingId);
    }
    return { status: res.status, data };
  };

  // Helper จำลองการชำระเงิน
  const simulatePaymentReq = async (bookingId) => {
    const res = await fetch(`${API_BASE}/payment/simulate-success`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ bookingId })
    });
    const data = await res.json();
    if (res.status === 200 && data.success) {
      logPaidBooking(bookingId, `AUTOTEST Paid booking created`);
    }
    return { status: res.status, data };
  };

  // =========================================================================
  // ข้อ 1: สล็อตที่หมดเวลา (สล็อตในอดีต) ไม่สามารถจองได้
  // =========================================================================
  await t.test('1. ช่วงที่จบแล้วจองไม่ได้ (หมดเวลา) -> ปฏิเสธ 400', async () => {
    const res = await createBookingReq({
      serverId: 1,
      bookingType: 'daily',
      startTime: '2026-01-01 10:00:00',
      endTime: '2026-01-01 12:00:00',
      amount: 50
    });

    assert.equal(res.status, 400, 'ต้องได้ status 400');
    assert.match(res.data.message, /หมดเวลา/);

    reportResults.push({
      test: '1. ช่วงที่จบแล้วจองไม่ได้',
      status: 'passed',
      detail: 'ได้ 400 พร้อมข้อความแจ้งเตือนหมดเวลา'
    });
  });

  // =========================================================================
  // ข้อ 2: การจองที่ยังไม่ชำระ (Pending) ไม่ทำให้ช่องเต็ม
  // =========================================================================
  await t.test('2. การจองที่ยังไม่ชำระ (Pending) ไม่ทำให้ช่องเต็ม', async () => {
    const testDate = dateTest2;
    // ดึง slots ของวันนั้น
    const slotsRes = await fetch(`${API_BASE}/servers/1/slots?date=${testDate}`).then(r => r.json());
    assert.ok(Array.isArray(slotsRes) && slotsRes.length > 0);
    const targetSlot = slotsRes[0];

    // ผู้ใช้สร้างการจองแต่ยังไม่ชำระ
    const createRes = await createBookingReq({
      serverId: 1,
      bookingType: 'timeslot',
      slotIds: [targetSlot.id]
    });
    assert.equal(createRes.status, 201);

    // ตรวจสอบ slot อีกครั้ง ต้องยังคงเป็น 'available' (ไม่เต็ม)
    const checkSlots = await fetch(`${API_BASE}/servers/1/slots?date=${testDate}`).then(r => r.json());
    const slotAfter = checkSlots.find(s => s.id === targetSlot.id);
    assert.equal(slotAfter.status, 'available', 'ช่องยังต้องว่างสำหรับคนอื่น');

    reportResults.push({
      test: '2. การจองที่ยังไม่ชำระไม่ทำให้ช่องเต็ม',
      status: 'passed',
      detail: `สร้างการจอง #${createRes.data.bookingId} (pending) แล้ว slot ยังคงว่าง (available)`
    });
  });

  // =========================================================================
  // ข้อ 3 & 4: ชำระแล้วเต็มทุกเซิร์ฟเวอร์ (BLOCK_SCOPE="all") และ 409 ทับช่วงเต็ม
  // =========================================================================
  await t.test('3 & 4. การจองที่ชำระแล้วทำให้เต็มทุกเซิร์ฟเวอร์ และจองซ้ำได้ 409', async () => {
    const testDate = dateTest3;
    const slotsServer1 = await fetch(`${API_BASE}/servers/1/slots?date=${testDate}`).then(r => r.json());
    const targetSlot = slotsServer1[1]; // ช่องที่ 2 (11:00-13:00)

    // 1. สร้างการจองบน Server 1
    const create1 = await createBookingReq({
      serverId: 1,
      bookingType: 'timeslot',
      slotIds: [targetSlot.id]
    });
    assert.equal(create1.status, 201);
    const bookingId1 = create1.data.bookingId;

    // 2. จำลองการชำระเงินสำเร็จ
    const pay1 = await simulatePaymentReq(bookingId1);
    assert.equal(pay1.status, 200);

    // 3. ตรวจสอบบน Server 2 ในวันและเวลาเดียวกัน ต้องขึ้น 'booked' (เต็มแล้ว) เนื่องจาก BLOCK_SCOPE='all'
    const slotsServer2 = await fetch(`${API_BASE}/servers/2/slots?date=${testDate}`).then(r => r.json());
    const slotOnServer2 = slotsServer2.find(s => s.time_start === targetSlot.time_start);
    assert.ok(slotOnServer2, 'ต้องพบสล็อตเวลาเดียวกันบน Server 2');
    assert.equal(slotOnServer2.status, 'booked', 'Server 2 ต้องถูกบล็อกเป็น booked ด้วย');

    // 4. พยายามสร้างการจองบน Server 2 ในเวลาที่ทับซ้อนกัน ต้องได้ 409 ข้อความภาษาไทย
    const create2 = await createBookingReq({
      serverId: 2,
      bookingType: 'timeslot',
      slotIds: [slotOnServer2.id]
    });
    assert.equal(create2.status, 409, 'ต้องตอบกลับ 409 Conflict');
    assert.match(create2.data.message, /ช่วงเวลานี้ถูกจองและชำระเงินสำเร็จไปแล้ว/);

    reportResults.push({
      test: '3. ชำระแล้วเต็มทุกเซิร์ฟเวอร์ (BLOCK_SCOPE=all)',
      status: 'passed',
      detail: `ชำระ #${bookingId1} บน Server 1 แล้ว Server 2 ติดสถานะ booked`
    });

    reportResults.push({
      test: '4. สร้างการจองทับช่วงที่เต็ม -> 409 ข้อความภาษาไทย',
      status: 'passed',
      detail: 'ตอบกลับ 409: "ช่วงเวลานี้ถูกจองและชำระเงินสำเร็จไปแล้ว กรุณาเลือกช่วงเวลาอื่น"'
    });
  });

  // =========================================================================
  // ข้อ 5: จองทั้งวัน (Fullday) ชำระแล้ว -> ทุก slot ของวันนั้นเต็ม
  // =========================================================================
  await t.test('5. จองทั้งวันที่ชำระแล้ว -> ทุก slot ในวันนั้นเต็มทุกเซิร์ฟเวอร์', async () => {
    const testDate = dateTest5;
    const createRes = await createBookingReq({
      serverId: 1,
      bookingType: 'fullday',
      startDate: testDate,
      endDate: testDate,
      amount: 200
    });
    assert.equal(createRes.status, 201);
    const bookingId = createRes.data.bookingId;

    const payRes = await simulatePaymentReq(bookingId);
    assert.equal(payRes.status, 200);

    // ตรวจสอบ slots ของ Server 1 และ Server 3
    const slots1 = await fetch(`${API_BASE}/servers/1/slots?date=${testDate}`).then(r => r.json());
    const slots3 = await fetch(`${API_BASE}/servers/3/slots?date=${testDate}`).then(r => r.json());

    assert.ok(slots1.every(s => s.status === 'booked'), 'ทุกช่องบน Server 1 ต้องเต็ม (booked)');
    assert.ok(slots3.every(s => s.status === 'booked'), 'ทุกช่องบน Server 3 ต้องเต็ม (booked)');

    reportResults.push({
      test: '5. จองทั้งวันที่ชำระแล้ว -> ทุก slot ในวันนั้นเต็ม',
      status: 'passed',
      detail: `ชำระ #${bookingId} แบบ fullday ส่งผลให้ทุกช่องในวันที่ ${testDate} เต็ม 100%`
    });
  });

  // =========================================================================
  // ข้อ 6: จองหลายวัน 3 วัน (Multiday) ชำระแล้ว -> ทุกวันในช่วงเต็ม
  // =========================================================================
  await t.test('6. จองหลายวัน 3 วันที่ชำระแล้ว -> ทุกวันในช่วงเต็ม', async () => {
    const startDate = dateTest6Start;
    const endDate = dateTest6End;
    const createRes = await createBookingReq({
      serverId: 1,
      bookingType: 'multiday',
      startDate,
      endDate,
      amount: 540
    });
    assert.equal(createRes.status, 201);
    const bookingId = createRes.data.bookingId;

    const payRes = await simulatePaymentReq(bookingId);
    assert.equal(payRes.status, 200);

    // ตรวจสอบทั้ง 3 วัน
    const startD = new Date(startDate);
    const endD = new Date(endDate);
    for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const slots = await fetch(`${API_BASE}/servers/2/slots?date=${dateStr}`).then(r => r.json());
      assert.ok(slots.every(s => s.status === 'booked'), `ทุกช่องในวันที่ ${dateStr} ต้องเต็ม`);
    }

    reportResults.push({
      test: '6. จองหลายวัน 3 วันที่ชำระแล้ว -> ทุกวันในช่วงเต็ม',
      status: 'passed',
      detail: `ชำระ #${bookingId} แบบ multiday (${startDate} ถึง ${endDate}) ทุกวันเต็มทั้งหมด`
    });
  });

  // =========================================================================
  // ข้อ 7: ตรวจสอบ Busy-Dates Endpoint (วัน N+2 เต็มแล้วตัวเลือกจากวัน N หยุดที่ N+1)
  // =========================================================================
  await t.test('7. ตรวจสอบ busy-dates สำหรับป้องกันการจองข้ามวันเต็ม', async () => {
    const res = await fetch(`${API_BASE}/servers/busy-dates`).then(r => r.json());
    assert.ok(Array.isArray(res.fullBookedDates), 'ต้องมีรายการ fullBookedDates');

    // วันที่ของ Test 5 และ Test 6 ต้องอยู่ใน fullBookedDates
    assert.ok(res.fullBookedDates.includes(dateTest5));
    assert.ok(res.fullBookedDates.includes(dateTest6Start));
    assert.ok(res.fullBookedDates.includes(dateTest6End));

    reportResults.push({
      test: '7. ระบบตรวจสอบวันเต็ม (Busy-Dates)',
      status: 'passed',
      detail: 'API ส่ง fullBookedDates ครอบคลุมวันที่จองทั้งวันและหลายวันทั้งหมด'
    });
  });

  // =========================================================================
  // ข้อ 8: Concurrency Test: สองคนชำระช่วงเดียวกัน คนที่สองไม่ผ่าน (First-Paid-First-Served)
  // =========================================================================
  await t.test('8. Concurrency Test: สองคนชำระช่วงเดียวกัน คนที่สองได้ 409', async () => {
    const testDate = dateTest8;
    const slotsS1 = await fetch(`${API_BASE}/servers/1/slots?date=${testDate}`).then(r => r.json());
    const slotsS2 = await fetch(`${API_BASE}/servers/2/slots?date=${testDate}`).then(r => r.json());

    // คนที่ 1 สร้างการจองบน Server 1
    const createA = await createBookingReq({
      serverId: 1,
      bookingType: 'timeslot',
      slotIds: [slotsS1[0].id]
    });
    assert.equal(createA.status, 201, 'การจอง A ต้องสร้างสำเร็จ');

    // คนที่ 2 สร้างการจองในช่วงเวลาเดียวกันบน Server 2
    const createB = await createBookingReq({
      serverId: 2,
      bookingType: 'timeslot',
      slotIds: [slotsS2[0].id]
    });
    assert.equal(createB.status, 201, 'การจอง B ต้องสร้างสำเร็จ');

    const bookingA = createA.data.bookingId;
    const bookingB = createB.data.bookingId;

    // คนที่ 1 ชำระเงินสำเร็จ
    const payA = await simulatePaymentReq(bookingA);
    assert.equal(payA.status, 200, 'คนแรกต้องชำระสำเร็จ');

    // คนที่ 2 พยายามชำระเงินตามมาทีหลัง (ต้องถูกปฏิเสธ 409 Conflict)
    const payB = await simulatePaymentReq(bookingB);
    assert.equal(payB.status, 409, 'คนที่สองต้องได้ 409 Conflict');
    assert.match(payB.data.message, /มีผู้ใช้อื่นชำระเงิน/);

    reportResults.push({
      test: '8. Concurrency: ชำระพร้อมกัน คนที่สองได้ 409',
      status: 'passed',
      detail: `การจอง #${bookingA} ได้รับสิทธิ์, การจอง #${bookingB} ถูกปฏิเสธ 409 ตามหลัก First-Paid-First-Served`
    });
  });

  // =========================================================================
  // Cleanup ใน finally: ลบเฉพาะการจองที่ยัง pending
  // =========================================================================
  t.after(async () => {
    for (const bId of pendingBookingIds) {
      try {
        await fetch(`${API_BASE}/bookings/${bId}/cancel`, {
          method: 'POST',
          headers: authHeaders
        });
      } catch (e) {}
    }

    // เขียนไฟล์รายงานผล
    const reportFilename = `api-${getTimestamp()}.json`;
    const reportPath = path.join(REPORTS_DIR, reportFilename);
    fs.writeFileSync(reportPath, JSON.stringify({
      suite: 'API Booking Rules Test Suite',
      timestamp: new Date().toISOString(),
      blockScope: 'all',
      minMinutesLeft: 15,
      totalTests: reportResults.length,
      passedTests: reportResults.filter(r => r.status === 'passed').length,
      results: reportResults
    }, null, 2), 'utf8');

    console.log(`\n✅ บันทึกรายงานผลการทดสอบ API เรียบร้อยที่: ${reportPath}`);
  });
});
