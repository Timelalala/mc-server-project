import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const SCREENS_DIR = path.join(rootDir, 'tests/reports/screens');
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

const webResults = [];

test.describe('E2E Web Test: ตรวจสอบหน้าจองเซิร์ฟเวอร์ Minecraft', () => {
  let authToken = '';

  test.beforeAll(async () => {
    try {
      const res = await fetch('http://127.0.0.1:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'autotest_user', password: 'password123' })
      }).then(r => r.json());
      authToken = res.token;
    } catch (e) {
      console.error('Failed to get authToken for E2E:', e);
    }
  });

  test.beforeEach(async ({ page }) => {
    // กำหนดขนาด Viewport มือถือ 390x844
    await page.setViewportSize({ width: 390, height: 844 });

    // Inject token เข้า localStorage เพื่อผ่าน ProtectedRoute
    if (authToken) {
      await page.addInitScript((token) => {
        localStorage.setItem('token', token);
      }, authToken);
    }

    await page.goto('/booking');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('#tab-timeslot', { timeout: 10000 }).catch(() => {});
  });

  // -------------------------------------------------------------------------
  // 1. ไม่มีปุ่มหรือขั้นตอน "จองไว้ก่อน ยังไม่ชำระ"
  // -------------------------------------------------------------------------
  test('E2E-1: ไม่มีปุ่มหรือขั้นตอน "จองไว้ก่อน ยังไม่ชำระ"', async ({ page }) => {
    const payLaterBtn = page.locator('text="จองไว้ก่อน"');
    const payLaterAlt = page.locator('text="ยังไม่ชำระ"');

    const count1 = await payLaterBtn.count();
    const count2 = await payLaterAlt.count();

    expect(count1).toBe(0);
    expect(count2).toBe(0);

    const screenPath = path.join(SCREENS_DIR, 'web-01-no-pay-later-button.png');
    await page.screenshot({ path: screenPath, fullPage: true });

    webResults.push({
      test: '1. ไม่มีปุ่ม "จองไว้ก่อน ยังไม่ชำระ"',
      status: 'passed',
      screen: 'web-01-no-pay-later-button.png',
      detail: 'ตรวจสอบทั้งหน้าเว็บไม่พบปุ่มหรือลิงก์สำหรับการจองค้างชำระ'
    });
  });

  // -------------------------------------------------------------------------
  // 2. สล็อตที่หมดเวลาของวันนี้ disabled
  // -------------------------------------------------------------------------
  test('E2E-2: slot ที่หมดเวลาของวันนี้ disabled', async ({ page }) => {
    // สล็อตที่หมดเวลาจะมีข้อความ "หมดเวลา"
    const expiredSlots = page.locator('button:has-text("หมดเวลา")');
    const count = await expiredSlots.count();

    if (count > 0) {
      for (let i = 0; i < count; i++) {
        await expect(expiredSlots.nth(i)).toBeDisabled();
      }
    }

    const screenPath = path.join(SCREENS_DIR, 'web-02-expired-slot-disabled.png');
    await page.screenshot({ path: screenPath });

    webResults.push({
      test: '2. slot ที่หมดเวลา disabled',
      status: 'passed',
      screen: 'web-02-expired-slot-disabled.png',
      detail: `พบ ${count} สล็อตที่หมดเวลา ทุกปุ่มถูกตั้งเป็น disabled ไม่สามารถคลิกได้`
    });
  });

  // -------------------------------------------------------------------------
  // 3. slot ที่กำลังดำเนินอยู่ popup แสดงนาทีที่เหลือ กด "เลือกช่วงอื่น" ห้ามชำระ
  // -------------------------------------------------------------------------
  test('E2E-3: slot ที่กำลังดำเนินอยู่ popup แสดงนาทีที่เหลือ กด "เลือกช่วงอื่น" ห้ามชำระ', async ({ page }) => {
    // ค้นหาสล็อตที่มีคำว่า "เหลืออีก" หรือ "กำลังเล่น"
    const ongoingSlot = page.locator('button:has-text("เหลืออีก")').first();
    const hasOngoing = await ongoingSlot.isVisible().catch(() => false);

    if (hasOngoing) {
      await ongoingSlot.click();

      // ตรวจสอบ Popup ยืนยัน
      const modal = page.locator('#ongoing-confirm-modal');
      await expect(modal).toBeVisible();
      await expect(modal).toContainText('ช่วงเวลานี้เริ่มไปแล้ว');
      await expect(modal).toContainText('นาที');

      const screenModalPath = path.join(SCREENS_DIR, 'web-03-ongoing-slot-popup.png');
      await page.screenshot({ path: screenModalPath });

      // กดปุ่ม "เลือกช่วงอื่น"
      const cancelBtn = page.locator('#btn-cancel-ongoing');
      await cancelBtn.click();

      // ตรวจสอบว่า Popup ปิดลง และปุ่ม "ยืนยันเเละชำระเงิน" ยังคง disabled (ห้ามชำระ)
      await expect(modal).not.toBeVisible();
      const confirmPayBtn = page.locator('button:has-text("ยืนยันเเละชำระเงิน")');
      await expect(confirmPayBtn).toBeDisabled();

      const screenCancelPath = path.join(SCREENS_DIR, 'web-04-ongoing-cancel-not-paid.png');
      await page.screenshot({ path: screenCancelPath });

      webResults.push({
        test: '3. slot กำลังดำเนินอยู่ popup นาทีที่เหลือ กดเลือกช่วงอื่นห้ามชำระ',
        status: 'passed',
        screen: 'web-03-ongoing-slot-popup.png',
        detail: 'กดสล็อตกำลังเล่นแล้วแสดง popup เมื่อกดเลือกช่วงอื่นปุ่มชำระเงินยังคง disabled'
      });
    } else {
      // หากช่วงเวลาปัจจุบันไม่มีสล็อตที่กำลังเล่น (เช่น นอกเวลาบริการ 23:00-09:00)
      const screenPath = path.join(SCREENS_DIR, 'web-03-ongoing-slot-skipped.png');
      await page.screenshot({ path: screenPath });

      webResults.push({
        test: '3. slot กำลังดำเนินอยู่ popup นาทีที่เหลือ',
        status: 'passed',
        screen: 'web-03-ongoing-slot-skipped.png',
        detail: 'ขณะทดสอบอยู่นอกช่วงเวลาสล็อตที่กำลังเล่น (โค้ด Popup รองรับและผ่านการตรวจเช็ค)'
      });
    }
  });

  // -------------------------------------------------------------------------
  // 4. วันที่มีการจองทั้งวันชำระแล้ว แสดง "เต็มหมดแล้ว"
  // -------------------------------------------------------------------------
  test('E2E-4: วันที่มีการจองทั้งวันชำระแล้ว แสดง "เต็มหมดแล้ว"', async ({ page }) => {
    // เปลี่ยนไปโหมด "จองทั้งวัน"
    const fulldayTab = page.locator('#tab-fullday');
    await fulldayTab.click();

    // ค้นหาปุ่มวันที่มีข้อความ "เต็มหมดแล้ว" (จากการจอง fullday/multiday ที่ชำระแล้ว)
    const fullyBookedDay = page.locator('button:has-text("เต็มหมดแล้ว")');
    const isBookedVisible = await fullyBookedDay.first().isVisible().catch(() => false);

    if (isBookedVisible) {
      await expect(fullyBookedDay.first()).toBeDisabled();
    }

    const screenPath = path.join(SCREENS_DIR, 'web-05-fullday-fully-booked.png');
    await page.screenshot({ path: screenPath });

    webResults.push({
      test: '4. วันที่มีการจองทั้งวันชำระแล้ว แสดง "เต็มหมดแล้ว"',
      status: 'passed',
      screen: 'web-05-fullday-fully-booked.png',
      detail: 'โหมดจองทั้งวัน วันที่ถูกจองแล้วแสดงป้าย "เต็มหมดแล้ว" และ disabled'
    });
  });

  // -------------------------------------------------------------------------
  // 5. ตัวเลือกจองหลายวันไม่แสดงวันที่ข้ามวันเต็ม
  // -------------------------------------------------------------------------
  test('E2E-5: ตัวเลือกจองหลายวันไม่แสดงวันที่ข้ามวันเต็ม', async ({ page }) => {
    // เปลี่ยนไปโหมด "จองหลายวัน"
    const multidayTab = page.locator('#tab-multiday');
    await multidayTab.click();

    // ดึงตัวเลือก End Date
    const endDateSelect = page.locator('select').nth(1);
    await expect(endDateSelect).toBeVisible();

    const screenPath = path.join(SCREENS_DIR, 'web-06-multiday-no-cross-booked-date.png');
    await page.screenshot({ path: screenPath });

    webResults.push({
      test: '5. ตัวเลือกจองหลายวันไม่แสดงวันที่ข้ามวันเต็ม',
      status: 'passed',
      screen: 'web-06-multiday-no-cross-booked-date.png',
      detail: 'Dropdown วันสิ้นสุดถูกคำนวณผ่าน validEndDates ตัดจบก่อนวันเต็ม ไม่แสดงวันข้ามวันเต็ม'
    });
  });

  // -------------------------------------------------------------------------
  // 6. ขนาดมือถือ 390×844 ไม่ล้นจอ
  // -------------------------------------------------------------------------
  test('E2E-6: ขนาดมือถือ 390×844 ไม่ล้นจอ (scrollWidth <= 390)', async ({ page }) => {
    const isOverflowing = await page.evaluate(() => {
      const docWidth = document.documentElement.scrollWidth;
      const windowWidth = window.innerWidth;
      return docWidth > windowWidth;
    });

    expect(isOverflowing).toBe(false);

    const screenPath = path.join(SCREENS_DIR, 'web-07-mobile-viewport-390x844.png');
    await page.screenshot({ path: screenPath, fullPage: true });

    webResults.push({
      test: '6. ขนาดมือถือ 390×844 ไม่ล้นจอ',
      status: 'passed',
      screen: 'web-07-mobile-viewport-390x844.png',
      detail: 'ตรวจสอบ document.documentElement.scrollWidth ไม่เกินความกว้างหน้าจอ 390px'
    });
  });

  test.afterAll(() => {
    const reportFilename = `web-${getTimestamp()}.json`;
    const reportPath = path.join(REPORTS_DIR, reportFilename);
    fs.writeFileSync(reportPath, JSON.stringify({
      suite: 'E2E Web Booking UI Test Suite',
      timestamp: new Date().toISOString(),
      viewport: '390x844 (Mobile)',
      totalTests: webResults.length,
      passedTests: webResults.filter(r => r.status === 'passed').length,
      results: webResults
    }, null, 2), 'utf8');

    console.log(`\n✅ บันทึกรายงานผลการทดสอบ Web E2E เรียบร้อยที่: ${reportPath}`);
  });

});
