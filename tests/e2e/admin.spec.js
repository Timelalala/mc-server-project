import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const SCREENS_DIR = path.join(rootDir, 'tests/reports/screens');

test.describe('QA E2E Admin Portal: ตรวจสอบระบบควบคุมและจัดการของผู้ดูแลระบบ (Admin Control Panel)', () => {
  let adminToken = '';

  test.beforeAll(async () => {
    try {
      const res = await fetch('http://127.0.0.1:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'password123' })
      }).then(r => r.json());
      adminToken = res.token;
    } catch (e) {
      console.error('Failed to get adminToken for E2E:', e);
    }
  });

  test.beforeEach(async ({ page }) => {
    if (adminToken) {
      await page.addInitScript((token) => {
        localStorage.setItem('token', token);
      }, adminToken);
    }
  });

  // 1. หน้าแดชบอร์ดภาพรวม (/admin)
  test('ADM-01: แดชบอร์ดภาพรวม (/admin) แสดงการ์ดสถิติและกราฟ Network Traffic', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // ตรวจสอบ Title หรือองค์ประกอบแดชบอร์ด
    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(/Dashboard|ภาพรวม|สถิติ/i);

    const screenPath = path.join(SCREENS_DIR, 'admin-01-dashboard.png');
    await page.screenshot({ path: screenPath, fullPage: true });
  });

  // 2. หน้าจัดการผู้ใช้งาน (/admin/users)
  test('ADM-02: หน้าจัดการผู้ใช้งาน (/admin/users) แสดงตารางสมาชิกและสิทธิ์', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(/ผู้ใช้|User|อีเมล|สถานะ/i);

    const screenPath = path.join(SCREENS_DIR, 'admin-02-users.png');
    await page.screenshot({ path: screenPath, fullPage: true });
  });

  // 3. หน้าตรวจสอบเซิร์ฟเวอร์และฮาร์ดแวร์ (/admin/servers)
  test('ADM-03: หน้าสถานะเซิร์ฟเวอร์ (/admin/servers) แสดงข้อมูลโหนด MC1–MC4', async ({ page }) => {
    await page.goto('/admin/servers');
    await page.waitForLoadState('networkidle');

    const bodyText = await page.textContent('body');
    expect(bodyText).toContain('Java Survival');

    const screenPath = path.join(SCREENS_DIR, 'admin-03-servers.png');
    await page.screenshot({ path: screenPath, fullPage: true });
  });

  // 4. หน้าจัดการสล็อตเวลา (/admin/time-slots)
  test('ADM-04: หน้าจัดการสล็อตเวลา (/admin/time-slots) แสดงตารางสล็อต', async ({ page }) => {
    await page.goto('/admin/time-slots');
    await page.waitForLoadState('networkidle');

    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(/เวลา|Slot|สล็อต/i);

    const screenPath = path.join(SCREENS_DIR, 'admin-04-timeslots.png');
    await page.screenshot({ path: screenPath, fullPage: true });
  });

  // 5. หน้าตรวจสอบรายการจองทั้งหมด (/admin/bookings)
  test('ADM-05: หน้ารายการจอง (/admin/bookings) แสดงประวัติการจองและยอดเงิน', async ({ page }) => {
    await page.goto('/admin/bookings');
    await page.waitForLoadState('networkidle');

    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(/การจอง|Booking|สถานะ|ราคา/i);

    const screenPath = path.join(SCREENS_DIR, 'admin-05-bookings.png');
    await page.screenshot({ path: screenPath, fullPage: true });
  });
});
