import ExcelJS from 'exceljs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const MANUAL_FILE = path.join(rootDir, 'tests/TEST-MANUAL.xlsx');

async function createManualSheets() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Minecraft Server QA & Product Team';
  workbook.created = new Date();

  // Helper กำหนดสไตล์หัวตาราง
  const setHeaderStyle = (row, bgColor = 'FF1E3A8A') => {
    row.height = 32;
    row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    row.alignment = { horizontal: 'center', vertical: 'middle' };
    row.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bgColor }
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'medium' },
        right: { style: 'thin' }
      };
    });
  };

  // Helper ใส่ขอบตาราง
  const setBorders = (row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
      };
    });
  };

  // =========================================================================
  // 1. ชีต System-Test (Step-by-Step Test Cases สำหรับ Tester / QA)
  // =========================================================================
  const sysSheet = workbook.addWorksheet('System-Test');
  sysSheet.columns = [
    { header: 'Test Case ID', key: 'tcId', width: 16 },
    { header: 'Test Scenario / Title', key: 'title', width: 32 },
    { header: 'Pre-conditions (เงื่อนไขก่อนหน้า)', key: 'preconditions', width: 35 },
    { header: 'Test Steps (ขั้นตอนการกด 1-2-3)', key: 'steps', width: 50 },
    { header: 'Test Data (ข้อมูลที่ใช้เทส)', key: 'testData', width: 35 },
    { header: 'Expected Result (ผลลัพธ์ที่คาดหวัง)', key: 'expected', width: 45 },
    { header: 'Actual Result (ผลลัพธ์ที่เกิดขึ้นจริง)', key: 'actual', width: 45 },
    { header: 'Status (สถานะ)', key: 'status', width: 15 }
  ];
  setHeaderStyle(sysSheet.getRow(1), 'FF1E3A8A'); // น้ำเงินเข้ม Blue-900

  const systemCases = [
    {
      tcId: 'ST-AUTH-001',
      title: 'สมัครสมาชิกและตรวจสอบการนำทาง',
      preconditions: 'ผู้ใช้ยังไม่ได้ล็อกอิน เปิดหน้าเว็บที่ /register',
      steps: '1. กรอก Username, Email, Password ให้ครบ\n2. กดปุ่ม "สมัครสมาชิก"',
      testData: 'User: user_demo9\nEmail: demo9@mail.com\nPass: Pass1234!',
      expected: 'ระบบสร้างผู้ใช้ใหม่สำเร็จ แจ้งเตือน และ Redirect ไปหน้า /login',
      actual: 'สร้างบัญชีสำเร็จและถูกนำทางไปหน้า /login ทันที',
      status: 'Pass'
    },
    {
      tcId: 'ST-AUTH-002',
      title: 'เข้าสู่ระบบด้วยรหัสผ่านถูกต้อง',
      preconditions: 'มีบัญชีในฐานข้อมูลเรียบร้อยแล้ว',
      steps: '1. ไปที่หน้า /login\n2. กรอก Username และ Password\n3. กดปุ่ม Login',
      testData: 'Username: autotest_user\nPassword: password123',
      expected: 'บันทึก JWT ใน LocalStorage และนำเข้าสู่หน้าแรก / พร้อมแสดง Navbar ผู้ใช้',
      actual: 'เข้าสู่ระบบสำเร็จ แสดงชื่อผู้ใช้บนแถบเมนูด้านบน',
      status: 'Pass'
    },
    {
      tcId: 'ST-BOOK-001',
      title: 'สล็อตเวลาในอดีต (หมดเวลา) ปิดใช้งาน',
      preconditions: 'ล็อกอินแล้ว อยู่ที่หน้า /booking ในวันปัจจุบัน',
      steps: '1. ไปที่แท็บ "จองรายช่วงเวลา"\n2. ตรวจสอบสล็อตเวลาที่ผ่านพ้นไปแล้ว',
      testData: 'วันที่: วันนี้\nสล็อต: ช่วงเวลาในอดีต',
      expected: 'สล็อตมีป้าย "หมดเวลา" เป็นสีเทา ปิดใช้งาน (disabled) ไม่สามารถคลิกได้',
      actual: 'สล็อต disabled และไม่สามารถกดเลือกได้ถูกต้อง',
      status: 'Pass'
    },
    {
      tcId: 'ST-BOOK-002',
      title: 'สล็อตเวลาที่เริ่มไปแล้ว (Ongoing) แจ้งเตือนนาทีที่เหลือ',
      preconditions: 'สล็อตของเวลาปัจจุบันเริ่มไปแล้วและเหลือเวลา > 15 นาที',
      steps: '1. คลิกเลือกสล็อตเวลาปัจจุบันที่กำลังดำเนินอยู่\n2. สังเกต Modal Popup',
      testData: 'สล็อต: เวลาปัจจุบัน (Ongoing)',
      expected: 'แสดง Popup เตือน: "ช่วงเวลานี้เริ่มไปแล้ว เหลืออีก X นาที" มีปุ่มยืนยัน และ เลือกช่วงอื่น',
      actual: 'Popup แสดงนาทีที่เหลือตามเวลาของระบบจริงถูกต้อง',
      status: 'Pass'
    },
    {
      tcId: 'ST-BOOK-003',
      title: 'ปุ่ม "เลือกช่วงอื่น" ใน Popup ห้ามพาไปชำระเงิน',
      preconditions: 'Popup ของสล็อต Ongoing กำลังแสดงอยู่บนจอ',
      steps: '1. กดปุ่ม "เลือกช่วงอื่น" ใน Popup Modal',
      testData: 'คลิก: ปุ่ม "เลือกช่วงอื่น"',
      expected: 'Popup ปิดลง สล็อตไม่ถูกเลือก และไม่นำทางไปหน้าชำระเงิน',
      actual: 'Popup ปิดลง หน้าเว็บอยู่ที่เดิม ไม่มีการส่งต่อไปหน้า /payment',
      status: 'Pass'
    },
    {
      tcId: 'ST-BOOK-004',
      title: 'ไม่มีปุ่ม "จองไว้ก่อน ยังไม่ชำระ" บนหน้าเว็บ',
      preconditions: 'อยู่ที่หน้า /booking เลือกสล็อตเวลาว่าง 1 ช่วง',
      steps: '1. ตรวจสอบการ์ดสรุปราคาและปุ่ม Action ทั้งหมด',
      testData: 'ตรวจสอบ: ปุ่มหรือข้อความ "จองไว้ก่อน", "พักการชำระ"',
      expected: 'ไม่มีปุ่มจองไว้ก่อน มีเฉพาะปุ่มยืนยันชำระเงินเท่านั้น',
      actual: 'ไม่พบปุ่มจองค้างชำระ มีเฉพาะปุ่มยืนยันชำระเงิน',
      status: 'Pass'
    },
    {
      tcId: 'ST-MULTI-001',
      title: 'วันที่มีการจองทั้งวันแล้ว ขึ้นป้าย "เต็มหมดแล้ว"',
      preconditions: 'สลับแท็บไปที่ "จองทั้งวัน"',
      steps: '1. เลือกวันที่ที่มีการจองแบบทั้งวันหรือหลายวันไว้แล้ว',
      testData: 'วันที่: วันที่ติดการจองเต็ม (เช่น 18–21 ต.ค.)',
      expected: 'แสดงป้าย Badge สีแดง "เต็มหมดแล้ว" และปุ่มกดจองถูกปิดใช้งาน',
      actual: 'แสดงป้าย "เต็มหมดแล้ว" ชัดเจน ไม่สามารถกดยืนยันการจองได้',
      status: 'Pass'
    },
    {
      tcId: 'ST-MULTI-002',
      title: 'การจองหลายวัน ตัดจบตัวเลือกวันที่สิ้นสุดไม่ให้ข้ามวันเต็ม',
      preconditions: 'สลับแท็บไปที่ "จองหลายวัน"',
      steps: '1. เลือก Start Date ก่อนวันเต็ม\n2. เปิดดูตัวเลือก End Date',
      testData: 'Start Date: วันที่ N\nวันเต็ม: วันที่ N+2',
      expected: 'ตัวเลือก End Date จะเลือกได้สูงสุดแค่วันที่ N+1 โดยไม่แสดงวันที่ข้ามวันเต็ม',
      actual: 'ตัวเลือกวันที่สิ้นสุดถูกจำกัดอัตโนมัติ ไม่สามารถเลือกข้ามวันเต็มได้',
      status: 'Pass'
    },
    {
      tcId: 'ST-PAY-001',
      title: 'หน้าชำระเงินแสดง PromptPay QR และเวลานับถอยหลัง',
      preconditions: 'สร้างการจองและเข้ามาที่หน้า /payment',
      steps: '1. ตรวจสอบการแสดงผล QR Code และยอดเงิน\n2. สังเกตตัวจับเวลา 15 นาที',
      testData: 'ยอดเงิน: 50 บาท, เวลาล็อก: 15 นาที',
      expected: 'QR Code แสดงผลชัดเจน ยอดเงินตรง และเวลานับถอยหลังถูกต้อง',
      actual: 'แสดงผล QR Code ชัดเจน พร้อมเวลานับถอยหลังถูกต้อง',
      status: 'Pass'
    },
    {
      tcId: 'ST-MYBK-001',
      title: 'ยกเลิกการจองสถานะ Pending ในหน้าประวัติการจอง',
      preconditions: 'มีการจองที่ยังไม่ชำระเงิน (pending) ในหน้า /my-bookings',
      steps: '1. กดปุ่ม "ยกเลิกการจอง" ของรายการ pending\n2. กดยืนยันในกล่องแจ้งเตือน',
      testData: 'Booking ID สถานะ: pending',
      expected: 'รายการเปลี่ยนสถานะเป็น "ยกเลิกแล้ว" และสล็อตเวลากลับคืนสู่ระบบ',
      actual: 'ยกเลิกสำเร็จ และสล็อตเวลากลับมาว่างให้คนอื่นจองได้ทันที',
      status: 'Pass'
    },
    {
      tcId: 'ST-MYBK-002',
      title: 'การจองที่ชำระแล้ว ต้องไม่มีปุ่มยกเลิก',
      preconditions: 'มีการจองที่ชำระเงินสำเร็จแล้ว (status = confirmed / paid)',
      steps: '1. ไปที่หน้า /my-bookings\n2. ตรวจสอบการ์ดการจองที่ชำระเงินแล้ว',
      testData: 'Booking ID สถานะ: confirmed',
      expected: 'ไม่มีปุ่มยกเลิกการจองแสดงอยู่ และแสดงสถานะยืนยันชำระเงินเรียบร้อย',
      actual: 'ไม่มีปุ่มยกเลิก และแสดงสถานะยืนยันถูกต้อง',
      status: 'Pass'
    },
    {
      tcId: 'ST-UI-001',
      title: 'ขนาดจอมือถือ 390×844 แสดงผลสมบูรณ์ ไม่ล้นจอ',
      preconditions: 'ปรับขนาดหน้าจอเบราว์เซอร์เป็น 390×844 (Mobile Viewport)',
      steps: '1. เข้าตรวจสอบหน้า /, /booking, /my-bookings, /payment\n2. ตรวจสอบการเลื่อนแนวนอน',
      testData: 'Viewport: 390px × 844px',
      expected: 'เนื้อหาทั้งหมดจัดวางกึ่งกลางพอดี ไม่เกิดแถบเลื่อนแนวนอน (scrollWidth <= 390)',
      actual: 'ทุกหน้าแสดงผลสมบูรณ์สวยงาม ไม่ล้นจอตามแนวนอน 100%',
      status: 'Pass'
    }
  ];

  systemCases.forEach((tc) => {
    const row = sysSheet.addRow(tc);
    row.height = 42;
    row.alignment = { vertical: 'middle', wrapText: true };
    row.getCell('tcId').alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell('tcId').font = { bold: true };

    const statusCell = row.getCell('status');
    statusCell.alignment = { horizontal: 'center', vertical: 'middle' };
    statusCell.font = { bold: true, color: { argb: 'FF065F46' } };
    statusCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD1FAE5' }
    };
    setBorders(row);
  });

  // =========================================================================
  // 2. ชีต UAT-Scenario (User Acceptance Testing แบบ Given-When-Then สำหรับลูกค้า / อาจารย์)
  // =========================================================================
  const uatSheet = workbook.addWorksheet('UAT-Scenario');
  uatSheet.columns = [
    { header: 'UAT Scenario ID', key: 'uatId', width: 18 },
    { header: 'สถานการณ์ทางธุรกิจ (Business Scenario)', key: 'scenario', width: 35 },
    { header: 'Given (กำหนดให้ / สถานะผู้ใช้)', key: 'given', width: 40 },
    { header: 'When (เมื่อ / การกระทำของผู้ใช้)', key: 'when', width: 45 },
    { header: 'Then (ดังนั้น / ผลลัพธ์ทางธุรกิจ)', key: 'then', width: 45 },
    { header: 'เกณฑ์การยอมรับ (Acceptance Criteria)', key: 'criteria', width: 40 },
    { header: 'ผลการตรวจรับ (Acceptance Result)', key: 'result', width: 22 }
  ];
  setHeaderStyle(uatSheet.getRow(1), 'FF047857'); // เขียวเข้มมรกต Emerald-700 (ธีม UAT)

  const uatScenarios = [
    {
      uatId: 'UAT-SCN-001',
      scenario: 'ลูกค้าต้องการเข้าเล่นเกมทันทีในสล็อตปัจจุบันที่เริ่มไปแล้ว',
      given: 'ฉันเป็นผู้เล่นที่เปิดเว็บเข้ามาตอน 11:20 น. และสล็อต 11:00–13:00 น. เริ่มเล่นไปแล้ว 20 นาที (ยังเหลือเวลาอีก 1 ชม. 40 นาที ซึ่งเกิน 15 นาที)',
      when: 'ฉันกดเลือกสล็อต 11:00–13:00 น. เพื่อต้องการเล่นต่อทันที',
      then: 'ระบบต้องแสดง Popup แจ้งเตือนฉันว่า "สล็อตนี้เริ่มไปแล้ว เหลืออีก 100 นาที" เพื่อให้ฉันตัดสินใจก่อนจ่ายเงิน',
      criteria: 'ลูกค้าทราบเวลาที่เหลือจริงอย่างโปร่งใส และสามารถกดยืนยันเพื่อไปจ่ายเงินหรือเปลี่ยนใจเลือกช่วงอื่นได้',
      result: 'ยอมรับ (Accepted)'
    },
    {
      uatId: 'UAT-SCN-002',
      scenario: 'ลูกค้าเปลี่ยนใจไม่จองสล็อตที่เริ่มไปแล้ว',
      given: 'ฉันกำลังดู Popup สล็อตที่เริ่มไปแล้ว แต่เห็นว่าเวลาเหลือน้อยและอยากรอเล่นช่วงถัดไป',
      when: 'ฉันกดปุ่ม "เลือกช่วงอื่น" บนหน้าจอ Popup',
      then: 'ระบบต้องยกเลิกการเลือกสล็อตนั้นทันที และต้องไม่นำฉันไปหน้าชำระเงิน',
      criteria: 'ไม่มีการบังคับเก็บเงินหรือสร้างคำสั่งซื้อที่ลูกค้าไม่ได้ตั้งใจ',
      result: 'ยอมรับ (Accepted)'
    },
    {
      uatId: 'UAT-SCN-003',
      scenario: 'กลุ่มเพื่อนต้องการเช่าเซิร์ฟเวอร์เล่นยาวตลอดทั้งวันหยุดสุดสัปดาห์',
      given: 'ฉันต้องการจัดปาร์ตี้เล่น Minecraft กับเพื่อนวันเสาร์ทั้งวันตั้งแต่เช้าจรดค่ำ',
      when: 'ฉันเลือกแท็บ "จองทั้งวัน" แล้วเลือกวันเสาร์ที่ยังไม่มีใครจอง',
      then: 'ระบบคิดราคาโปรโมชันเหมาทั้งวัน และเมื่อจ่ายเงินสำเร็จ เซิร์ฟเวอร์ทุกเครื่องในระบบจะถูกล็อกให้กลุ่มฉันเล่นได้ตลอด 24 ชั่วโมง',
      criteria: 'ไม่มีผู้เล่นอื่นสามารถเข้ามาแทรกจองในวันนั้นได้ และได้รับสิทธิ์ใช้งานเต็มวัน',
      result: 'ยอมรับ (Accepted)'
    },
    {
      uatId: 'UAT-SCN-004',
      scenario: 'ระบบป้องกันการจองแบบหลายวันข้ามช่วงเวลาที่มีคนอื่นเหมาไว้แล้ว',
      given: 'มีลูกค้าท่านอื่นจองเซิร์ฟเวอร์ทั้งวันในวันพุธไว้ล่วงหน้าแล้ว',
      when: 'ฉันพยายามจะจองแบบหลายวัน ตั้งแต่วันจันทร์ไปจนถึงวันศุกร์ (5 วัน)',
      then: 'ระบบต้องไม่อนุญาตให้ฉันเลือกวันสิ้นสุดข้ามวันพุธ และจำกัดให้จองได้สูงสุดถึงแค่วันอังคารเท่านั้น',
      criteria: 'ป้องกันการชนกันของตารางเวลา ลูกค้าไม่สามารถจองทับคิวของผู้อื่นได้',
      result: 'ยอมรับ (Accepted)'
    },
    {
      uatId: 'UAT-SCN-005',
      scenario: 'มาตรการแข่งขันการชำระเงิน (First-Paid-First-Served)',
      given: 'ฉันและผู้เล่นอีกคนหนึ่งกดเลือกสล็อตเวลาเดียวกันพร้อมกันในสถานะรอชำระเงิน (Pending)',
      when: 'ผู้เล่นอีกคนสแกนจ่ายเงินสำเร็จก่อนฉัน 5 วินาที แล้วฉันจึงสแกนจ่ายเงินตามมาทีหลัง',
      then: 'ระบบต้องมอบสิทธิ์สล็อตนั้นให้ผู้เล่นคนแรกที่เงินเข้าก่อน ส่วนฉันระบบต้องปฏิเสธและแจ้งเตือนอย่างสุภาพว่าช่วงเวลานี้มีผู้ชำระเงินไปแล้ว',
      criteria: 'ระบบมีความซื่อตรง ใครจ่ายเงินก่อนได้สิทธิ์ก่อน (First-Paid-First-Served) ไม่มีการซ้อนทับของคิว',
      result: 'ยอมรับ (Accepted)'
    },
    {
      uatId: 'UAT-SCN-006',
      scenario: 'ความง่ายในการเข้าเล่นเกมหลังชำระเงินสำเร็จ',
      given: 'ฉันชำระเงินค่าจองเซิร์ฟเวอร์เรียบร้อยแล้ว และรอเวลาเซิร์ฟเวอร์เปิด',
      when: 'ถึงเวลาที่ฉันจองไว้ และฉันเข้าไปดูที่หน้า "ประวัติการจองของฉัน" (My Bookings)',
      then: 'ระบบแสดงที่อยู่ IP ของเซิร์ฟเวอร์เกมอย่างชัดเจน โดยฉันสามารถก๊อปปี้ไปวางในเกม Minecraft แล้วเข้าเล่นได้ทันทีโดยไม่ต้องจำเลขพอร์ต',
      criteria: 'ลูกค้าเข้าเล่นเกมได้สะดวกรวดเร็ว ไม่ต้องพิมพ์พอร์ตเชื่อมต่อให้ยุ่งยาก (MC1 ทำ DNAT อัตโนมัติ)',
      result: 'ยอมรับ (Accepted)'
    }
  ];

  uatScenarios.forEach((uat) => {
    const row = uatSheet.addRow(uat);
    row.height = 55;
    row.alignment = { vertical: 'middle', wrapText: true };
    row.getCell('uatId').alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell('uatId').font = { bold: true };

    const resCell = row.getCell('result');
    resCell.alignment = { horizontal: 'center', vertical: 'middle' };
    resCell.font = { bold: true, color: { argb: 'FF065F46' } };
    resCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD1FAE5' } // เขียวอ่อน
    };
    setBorders(row);
  });

  try {
    await workbook.xlsx.writeFile(MANUAL_FILE);
    console.log(`✅ สร้างไฟล์ ${MANUAL_FILE} พร้อมชีต System-Test และ UAT-Scenario สำเร็จสมบูรณ์!`);
  } catch (err) {
    if (err.code === 'EBUSY') {
      const fallbackFile = path.join(rootDir, 'tests/TEST-MANUAL-V2.xlsx');
      await workbook.xlsx.writeFile(fallbackFile);
      console.log(`⚠️ ไฟล์ TEST-MANUAL.xlsx กำลังถูกเปิดใช้งานอยู่ ระบบได้บันทึกลงใน: ${fallbackFile} ให้เรียบร้อยแล้ว`);
    } else {
      throw err;
    }
  }
}

createManualSheets();
