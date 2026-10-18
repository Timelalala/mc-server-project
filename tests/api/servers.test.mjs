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

test('QA API Suite: ข้อมูลเซิร์ฟเวอร์ สล็อตเวลา และระบบสถานะ (Servers & Slots)', async (t) => {
  // 1. ตรวจสอบรายการเซิร์ฟเวอร์ทั้งหมด (GET /api/servers)
  await t.test('SRV-01: ดึงรายการเซิร์ฟเวอร์ทั้งหมด (MC1–MC4)', async () => {
    const res = await fetch(`${API_BASE}/servers`);
    const servers = await res.json();
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(servers) && servers.length >= 4, 'ต้องมีเซิร์ฟเวอร์อย่างน้อย 4 ตัว');

    // ตรวจสอบฟิลด์สำคัญในโครงสร้างเซิร์ฟเวอร์
    const s1 = servers.find(s => s.id === 1);
    assert.ok(s1, 'ต้องพบเซิร์ฟเวอร์ ID 1');
    assert.ok(s1.name, 'ต้องมีฟิลด์ name');
    assert.ok(s1.port, 'ต้องมีฟิลด์ port');

    reportResults.push({
      test: 'SRV-01: ดึงรายการเซิร์ฟเวอร์ทั้งหมด',
      status: 'passed',
      detail: `พบเซิร์ฟเวอร์ครบ ${servers.length} รายการ (MC1–MC4 พร้อมพอร์ตเกม)`
    });
  });

  // 2. ตรวจสอบข้อมูลสล็อตเวลา (GET /api/servers/:id/slots)
  await t.test('SRV-02: คำนวณสถานะสล็อตเวลา 5 ลำดับถูกต้อง', async () => {
    const today = new Date().toISOString().split('T')[0];
    const res = await fetch(`${API_BASE}/servers/1/slots?date=${today}`);
    const slots = await res.json();
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(slots) && slots.length > 0, 'ต้องมีรายการสล็อตเวลา');

    // ตรวจสอบว่าทุกสล็อตมีสถานะเป็น 1 ใน 5 สถานะที่ระบบรองรับ
    const validStatuses = ['available', 'ongoing', 'too_short', 'booked', 'expired'];
    for (const slot of slots) {
      assert.ok(validStatuses.includes(slot.status), `สถานะ "${slot.status}" ต้องอยู่ใน 5 สถานะที่กำหนด`);
      assert.ok(slot.time_start && slot.time_end, 'ต้องมีเวลาเริ่มต้นและสิ้นสุด');
    }

    reportResults.push({
      test: 'SRV-02: ตรวจสอบโครงสร้างและ 5 สถานะสล็อตเวลา',
      status: 'passed',
      detail: `สล็อตทั้งหมด ${slots.length} สล็อต มีสถานะตรงตามมาตรฐาน 5 สถานะ`
    });
  });

  // 3. ตรวจสอบ Endpoint วันที่เต็ม (GET /api/servers/busy-dates)
  await t.test('SRV-03: ตรวจสอบรายการวันที่เต็ม (busy-dates)', async () => {
    const res = await fetch(`${API_BASE}/servers/busy-dates`);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(data.fullBookedDates), 'ต้องมีอาเรย์ fullBookedDates');

    reportResults.push({
      test: 'SRV-03: รายการวันที่เต็มสำหรับปฏิทิน',
      status: 'passed',
      detail: `ส่ง fullBookedDates ถูกต้อง มีวันที่เต็มทั้งหมด ${data.fullBookedDates.length} วัน`
    });
  });

  // 4. ตรวจสอบ System Health Check (GET /api/system/health)
  await t.test('SRV-04: ตรวจสอบสถานะสุขภาพระบบ (System Health Check)', async () => {
    const res = await fetch(`${API_BASE}/system/health`);
    const health = await res.json();
    assert.equal(res.status, 200);
    assert.ok(health.status === 'ok' || health.database, 'ต้องส่งสถานะสุขภาพระบบปกติ');

    reportResults.push({
      test: 'SRV-04: System Health Check',
      status: 'passed',
      detail: 'ระบบ Backend และการเชื่อมต่อฐานข้อมูลทำงานปกติ (Health: OK)'
    });
  });

  t.after(() => {
    const outPath = path.join(REPORTS_DIR, 'qa-servers.json');
    fs.writeFileSync(outPath, JSON.stringify({
      suite: 'QA Servers & Slots Suite',
      timestamp: new Date().toISOString(),
      totalTests: reportResults.length,
      passedTests: reportResults.filter(r => r.status === 'passed').length,
      results: reportResults
    }, null, 2), 'utf8');
    console.log(`\n✅ บันทึกผลทดสอบ Servers QA ที่: ${outPath}`);
  });
});
