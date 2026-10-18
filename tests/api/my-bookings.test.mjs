import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const API_BASE = 'http://127.0.0.1:5000/api';
const REPORTS_DIR = path.join(rootDir, 'tests/reports');

const reportResults = [];

test('QA API Suite: รายการการจองของผู้ใช้และการยกเลิก (User Bookings & Cancellation)', async (t) => {
  let userToken = '';

  // ล็อกอินรับ Token
  try {
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'autotest_user', password: 'password123' })
    }).then(r => r.json());
    userToken = loginRes.token;
  } catch (e) {
    console.error('Login error:', e);
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${userToken}`
  };

  // 1. ตรวจสอบการดึงรายการจองของผู้ใช้ (GET /api/bookings/my)
  await t.test('UBK-01: ดึงประวัติการจองของผู้ใช้ (GET /api/bookings/my)', async () => {
    const res = await fetch(`${API_BASE}/bookings/my`, { headers: authHeaders });
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(data), 'ต้องได้รับรายการประวัติการจองเป็น Array');

    reportResults.push({
      test: 'UBK-01: ดึงประวัติการจองของผู้ใช้',
      status: 'passed',
      detail: `ดึงรายการการจองสำเร็จ พบทั้งหมด ${data.length} รายการ`
    });
  });

  // 2. ทดสอบสร้างการจอง Pending แล้วยกเลิกการจอง (POST /api/bookings/:id/cancel)
  await t.test('UBK-02: ยกเลิกการจองสถานะ Pending สำเร็จ', async () => {
    // หาวันที่ในอนาคต (>= 80 วันข้างหน้า)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 85);
    const dateStr = futureDate.toISOString().split('T')[0];

    // ดึงสล็อต
    const slotsRes = await fetch(`${API_BASE}/servers/1/slots?date=${dateStr}`).then(r => r.json());
    const slot = slotsRes[0];

    // สร้างการจอง
    const createRes = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        serverId: 1,
        bookingType: 'timeslot',
        slotIds: [slot.id],
        note: 'AUTOTEST PENDING CANCEL'
      })
    });
    const createData = await createRes.json();
    assert.equal(createRes.status, 201);
    const bookingId = createData.bookingId;

    // ยกเลิกการจอง
    const cancelRes = await fetch(`${API_BASE}/bookings/${bookingId}/cancel`, {
      method: 'POST',
      headers: authHeaders
    });
    const cancelData = await cancelRes.json();
    assert.equal(cancelRes.status, 200, 'ต้องยกเลิกสำเร็จด้วย status 200');
    assert.ok(cancelData.message || cancelData.success);

    reportResults.push({
      test: 'UBK-02: ยกเลิกการจอง Pending สำเร็จ',
      status: 'passed',
      detail: `สร้างการจอง #${bookingId} และยกเลิกสำเร็จผ่าน API`
    });
  });

  // 3. กฎความปลอดภัย: ห้ามยกเลิกการจองที่ชำระเงินแล้ว (Paid Booking Cannot Be Cancelled via API)
  await t.test('UBK-03: ป้องกันการยกเลิกการจองที่ชำระแล้วผ่าน API', async () => {
    // ทดสอบส่ง cancel ไปยัง booking ที่ชำระแล้ว (เช่น ID 33 ที่บันทึกไว้)
    const res = await fetch(`${API_BASE}/bookings/33/cancel`, {
      method: 'POST',
      headers: authHeaders
    });
    // ต้องถูกปฏิเสธ (400 หรือ 403)
    assert.ok([400, 403, 404].includes(res.status), 'ต้องปฏิเสธการยกเลิกการจองที่ชำระแล้ว');

    reportResults.push({
      test: 'UBK-03: ป้องกันการยกเลิกการจองที่ชำระแล้ว',
      status: 'passed',
      detail: `ระบบปฏิเสธการยกเลิกการจองที่ชำระแล้วด้วย status ${res.status} (ถูกต้องตามกติกา)`
    });
  });

  t.after(() => {
    const outPath = path.join(REPORTS_DIR, 'qa-my-bookings.json');
    fs.writeFileSync(outPath, JSON.stringify({
      suite: 'QA User Bookings & Cancellation Suite',
      timestamp: new Date().toISOString(),
      totalTests: reportResults.length,
      passedTests: reportResults.filter(r => r.status === 'passed').length,
      results: reportResults
    }, null, 2), 'utf8');
    console.log(`\n✅ บันทึกผลทดสอบ User Bookings QA ที่: ${outPath}`);
  });
});
