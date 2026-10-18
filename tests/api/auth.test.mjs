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

test('QA API Suite: ระบบยืนยันตัวตนและความปลอดภัย (Authentication & Authorization)', async (t) => {
  const testUsername = `qatest_${Date.now().toString(36)}`;
  const testPassword = 'Password123!';
  const testEmail = `${testUsername}@example.com`;
  let authToken = '';

  // 1. ทดสอบสมัครสมาชิกใหม่ (Register)
  await t.test('AUTH-01: สมัครสมาชิกใหม่ (Register) สำเร็จ', async () => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: testUsername,
        password: testPassword,
        email: testEmail
      })
    });
    const data = await res.json();
    assert.equal(res.status, 201, 'ต้องสมัครสมาชิกสำเร็จด้วย status 201');
    assert.ok(data.message || data.success, 'ต้องมีข้อความตอบกลับสำเร็จ');

    reportResults.push({
      test: 'AUTH-01: สมัครสมาชิกใหม่ (Register)',
      status: 'passed',
      detail: `สมัครสมาชิกผู้ใช้ ${testUsername} สำเร็จ (HTTP 201)`
    });
  });

  // 2. ทดสอบสมัครสมาชิกด้วย Username ซ้ำ (Duplicate Username)
  await t.test('AUTH-02: ป้องกันสมัครสมาชิกด้วย Username ซ้ำ', async () => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: testUsername,
        password: testPassword,
        email: `another_${testEmail}`
      })
    });
    assert.ok([400, 409].includes(res.status), 'ต้องปฏิเสธด้วย status 400 หรือ 409');

    reportResults.push({
      test: 'AUTH-02: ป้องกันสมัครสมาชิกด้วย Username ซ้ำ',
      status: 'passed',
      detail: `ระบบปฏิเสธการลงทะเบียนซ้ำด้วย status ${res.status}`
    });
  });

  // 3. ทดสอบเข้าสู่ระบบด้วยข้อมูลถูกต้อง (Login Success)
  await t.test('AUTH-03: เข้าสู่ระบบด้วยข้อมูลถูกต้อง (Login Success) ได้รับ JWT', async () => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: testUsername,
        password: testPassword
      })
    });
    const data = await res.json();
    assert.equal(res.status, 200, 'ต้อง login สำเร็จด้วย status 200');
    assert.ok(data.token, 'ต้องได้รับ JWT token');
    authToken = data.token;

    reportResults.push({
      test: 'AUTH-03: เข้าสู่ระบบด้วยข้อมูลถูกต้อง',
      status: 'passed',
      detail: 'เข้าสู่ระบบสำเร็จและได้รับ JWT Access Token'
    });
  });

  // 4. ทดสอบเข้าสู่ระบบด้วยรหัสผ่านผิด (Invalid Password)
  await t.test('AUTH-04: ปฏิเสธการเข้าสู่ระบบด้วยรหัสผ่านผิด (HTTP 401)', async () => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: testUsername,
        password: 'WrongPassword999'
      })
    });
    assert.equal(res.status, 401, 'ต้องได้ status 401 Unauthorized');

    reportResults.push({
      test: 'AUTH-04: ปฏิเสธรหัสผ่านผิด',
      status: 'passed',
      detail: 'ระบบปฏิเสธรหัสผ่านไม่ถูกต้องด้วย HTTP 401'
    });
  });

  // 5. ทดสอบเข้าถึง Protected Route ด้วย Token ที่ถูกต้อง (/api/auth/me)
  await t.test('AUTH-05: ตรวจสอบข้อมูลผู้ใช้ปัจจุบัน (/api/auth/me)', async () => {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.username, testUsername);

    reportResults.push({
      test: 'AUTH-05: ตรวจสอบข้อมูลผู้ใช้ผ่าน Token',
      status: 'passed',
      detail: `ยืนยันข้อมูลผู้ใช้ ${data.username} ผ่าน Token ถูกต้อง`
    });
  });

  // 6. ทดสอบเข้าถึง Protected Route โดยไม่มี Token (HTTP 401)
  await t.test('AUTH-06: ปฏิเสธการเข้าถึง Protected Route หากไม่มี Token', async () => {
    const res = await fetch(`${API_BASE}/auth/me`);
    assert.equal(res.status, 401, 'ต้องได้ status 401 Unauthorized');

    reportResults.push({
      test: 'AUTH-06: ป้องกัน Endpoint โดยไม่มี Token',
      status: 'passed',
      detail: 'ระบบรักษาความปลอดภัย ปฏิเสธคำขอที่ไม่มี JWT ด้วย HTTP 401'
    });
  });

  t.after(() => {
    const outPath = path.join(REPORTS_DIR, 'qa-auth.json');
    fs.writeFileSync(outPath, JSON.stringify({
      suite: 'QA Authentication & Authorization Suite',
      timestamp: new Date().toISOString(),
      totalTests: reportResults.length,
      passedTests: reportResults.filter(r => r.status === 'passed').length,
      results: reportResults
    }, null, 2), 'utf8');
    console.log(`\n✅ บันทึกผลทดสอบ Auth QA ที่: ${outPath}`);
  });
});
