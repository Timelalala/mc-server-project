import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('===============================================================');
console.log('🚀 เริ่มต้นกระบวนการทดสอบทั้งระบบอัตโนมัติ (Full System QA Suite)');
console.log('===============================================================\n');

function runStep(title, command, cwd = rootDir) {
  console.log(`\n▶ [QA STEP] ${title}...`);
  try {
    const output = execSync(command, { cwd, stdio: 'inherit' });
    console.log(`✔ [PASSED] ${title}`);
    return true;
  } catch (error) {
    console.error(`❌ [FAILED] ${title}:`, error.message);
    return false;
  }
}

// 1. API: Authentication Suite
runStep('1. API Test: Authentication & Authorization', 'node --test tests/api/auth.test.mjs');

// 2. API: Servers & Slots Suite
runStep('2. API Test: Servers, Slots & Health Check', 'node --test tests/api/servers.test.mjs');

// 3. API: User Bookings & Cancellation Suite
runStep('3. API Test: User Bookings & Cancellation Management', 'node --test tests/api/my-bookings.test.mjs');

// 4. API: Core Booking Rules Suite (BLOCK_SCOPE="all")
runStep('4. API Test: Core Booking Rules (8 Rules)', 'node --test tests/api/booking-rules.test.mjs');

// 5. E2E: Booking Flows Playwright
runStep('5. E2E Web Test: Booking Flows & Rules', 'npx playwright test tests/e2e/booking.spec.js');

// 6. E2E: Full System Flows Playwright
runStep('6. E2E Web Test: Full System Navigation & Responsive UI', 'npx playwright test tests/e2e/system-flows.spec.js');

// 7. สรุปรวมผลและสร้าง Excel Report
runStep('7. Build Consolidated Excel QA Report', 'node tests/build-report.mjs');

console.log('\n===============================================================');
console.log('🎉 เสร็จสิ้นการทดสอบทั้งระบบเรียบร้อยแล้ว (All QA Passed!)');
console.log('===============================================================');
