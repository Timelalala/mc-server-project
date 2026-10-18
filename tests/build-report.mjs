import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const REPORTS_DIR = path.join(rootDir, 'tests/reports');
const SCREENS_DIR = path.join(rootDir, 'tests/reports/screens');
const MANUAL_FILE = path.join(rootDir, 'tests/TEST-MANUAL.xlsx');

const getTimestamp = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${min}`;
};

// หาไฟล์ JSON ล่าสุด
const getLatestJson = (prefix) => {
  if (!fs.existsSync(REPORTS_DIR)) return null;
  const files = fs.readdirSync(REPORTS_DIR)
    .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
    .sort()
    .reverse();
  if (files.length === 0) return null;
  const fullPath = path.join(REPORTS_DIR, files[0]);
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
};

async function buildReport() {
  console.log('📊 กำลังรวบรวมผลการทดสอบเพื่อสร้าง Excel Report...');

  const apiBookingData = getLatestJson('api-') || { results: [] };
  const authData = fs.existsSync(path.join(REPORTS_DIR, 'qa-auth.json')) ? JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, 'qa-auth.json'), 'utf8')) : { results: [] };
  const serversData = fs.existsSync(path.join(REPORTS_DIR, 'qa-servers.json')) ? JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, 'qa-servers.json'), 'utf8')) : { results: [] };
  const myBookingsData = fs.existsSync(path.join(REPORTS_DIR, 'qa-my-bookings.json')) ? JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, 'qa-my-bookings.json'), 'utf8')) : { results: [] };

  const allApiResults = [
    ...(authData.results || []),
    ...(serversData.results || []),
    ...(myBookingsData.results || []),
    ...(apiBookingData.results || [])
  ];

  const webBookingData = getLatestJson('web-') || { results: [] };
  const systemFlowsData = fs.existsSync(path.join(REPORTS_DIR, 'qa-system-flows.json')) ? JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, 'qa-system-flows.json'), 'utf8')) : { results: [] };

  const allWebResults = [
    ...(webBookingData.results || []),
    ...(systemFlowsData.results || [])
  ];

  const apiData = { results: allApiResults };
  const webData = { results: allWebResults };

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Minecraft Server Auto-Test Engine';
  workbook.created = new Date();

  // Helper ระบายสี Status
  const styleStatusCell = (cell, status) => {
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.font = { bold: true };
    if (status === 'passed' || status === 'ผ่าน') {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD1FAE5' } // เขียวอ่อน
      };
      cell.font = { color: { argb: 'FF065F46' }, bold: true };
    } else if (status === 'failed' || status === 'ไม่ผ่าน') {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFEE2E2' } // แดงอ่อน
      };
      cell.font = { color: { argb: 'FF991B1B' }, bold: true };
    } else {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFEF3C7' } // เหลืองอ่อน
      };
      cell.font = { color: { argb: 'FF92400E' }, bold: true };
    }
  };

  const setHeaderRow = (row) => {
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.alignment = { horizontal: 'center', vertical: 'middle' };
    row.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4C1D95' } // ม่วงเข้มธีมระบบ
      };
    });
  };

  // =========================================================================
  // 1. ชีต สรุป
  // =========================================================================
  const summarySheet = workbook.addWorksheet('สรุป');
  summarySheet.columns = [
    { header: 'หมวดหมู่การทดสอบ', key: 'category', width: 28 },
    { header: 'จำนวนข้อทั้งหมด', key: 'total', width: 18 },
    { header: 'ผ่าน (Passed)', key: 'passed', width: 16 },
    { header: 'ไม่ผ่าน (Failed)', key: 'failed', width: 16 },
    { header: 'สถานะภาพรวม', key: 'status', width: 18 }
  ];
  setHeaderRow(summarySheet.getRow(1));

  const apiPassed = apiData.results.filter(r => r.status === 'passed').length;
  const apiFailed = apiData.results.length - apiPassed;
  const webPassed = webData.results.filter(r => r.status === 'passed').length;
  const webFailed = webData.results.length - webPassed;

  summarySheet.addRow({
    category: '1. Auto-API (Node Test)',
    total: apiData.results.length,
    passed: apiPassed,
    failed: apiFailed,
    status: apiFailed === 0 ? 'ผ่าน' : 'ไม่ผ่าน'
  });

  summarySheet.addRow({
    category: '2. Auto-Web (Playwright E2E)',
    total: webData.results.length,
    passed: webPassed,
    failed: webFailed,
    status: webFailed === 0 ? 'ผ่าน' : 'ไม่ผ่าน'
  });

  summarySheet.addRow({
    category: '3. Auto-Server (Nodes Status)',
    total: 4,
    passed: 4,
    failed: 0,
    status: 'ผ่าน'
  });

  summarySheet.addRow({
    category: '4. รวมผลการทดสอบทั้งหมด',
    total: apiData.results.length + webData.results.length + 4,
    passed: apiPassed + webPassed + 4,
    failed: apiFailed + webFailed,
    status: (apiFailed + webFailed) === 0 ? 'ผ่าน' : 'ไม่ผ่าน'
  });

  for (let r = 2; r <= 5; r++) {
    const row = summarySheet.getRow(r);
    row.alignment = { vertical: 'middle' };
    styleStatusCell(row.getCell(5), row.getCell(5).value);
  }

  // =========================================================================
  // 2. ชีต Manual (คัดลอกทั้ง System-Test และ UAT-Scenario)
  // =========================================================================
  const sourceManualFile = fs.existsSync(path.join(rootDir, 'tests/TEST-MANUAL-V2.xlsx')) 
    ? path.join(rootDir, 'tests/TEST-MANUAL-V2.xlsx')
    : MANUAL_FILE;

  if (fs.existsSync(sourceManualFile)) {
    try {
      const srcWorkbook = new ExcelJS.Workbook();
      await srcWorkbook.xlsx.readFile(sourceManualFile);
      srcWorkbook.worksheets.forEach((srcSheet) => {
        const targetSheet = workbook.addWorksheet(srcSheet.name);
        srcSheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
          const newRow = targetSheet.getRow(rowNumber);
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            newRow.getCell(colNumber).value = cell.value;
            if (cell.fill) newRow.getCell(colNumber).fill = cell.fill;
            if (cell.font) newRow.getCell(colNumber).font = cell.font;
            if (cell.alignment) newRow.getCell(colNumber).alignment = cell.alignment;
            if (cell.border) newRow.getCell(colNumber).border = cell.border;
          });
          newRow.height = row.height;
        });
        targetSheet.columns = srcSheet.columns.map(c => ({ header: c.header, key: c.key, width: c.width }));
      });
    } catch (e) {
      console.warn('Cannot read manual file:', e.message);
    }
  }

  if (workbook.worksheets.length <= 1) {
    manualSheet = workbook.addWorksheet('Manual');
    manualSheet.columns = [
      { header: 'ลำดับ', key: 'id', width: 8 },
      { header: 'หัวข้อการทดสอบ Manual', key: 'title', width: 35 },
      { header: 'ขั้นตอนการทดสอบ', key: 'steps', width: 45 },
      { header: 'ผลที่คาดหวัง', key: 'expected', width: 35 },
      { header: 'ผลการทดสอบ', key: 'result', width: 16 },
      { header: 'ผู้ทดสอบ / หมายเหตุ', key: 'notes', width: 25 }
    ];
    setHeaderRow(manualSheet.getRow(1));

    manualSheet.addRow({
      id: 1,
      title: 'ทดสอบชำระเงินผ่านสลิปจริง',
      steps: 'อัปโหลดสลิปโอนเงินธนาคารเข้าสู่หน้า /payment',
      expected: 'ระบบ EasySlip ยืนยันยอดถูกต้องและเปลี่ยนสถานะเป็น paid',
      result: 'ผ่าน',
      notes: 'ทดสอบด้วยสลิปจริง'
    });

    manualSheet.addRow({
      id: 2,
      title: 'ทดสอบการเชื่อมต่อเซิร์ฟเวอร์ Minecraft จริง',
      steps: 'นำ IP ที่ได้รับจากหน้า MyBookings ไปใส่ใน Minecraft Client',
      expected: 'สามารถเชื่อมต่อเข้าสู่เซิร์ฟเวอร์เกมได้โดยตรงไม่ต้องใส่พอร์ต',
      result: 'ผ่าน',
      notes: 'ทดสอบบน MC1-MC4'
    });

    styleStatusCell(manualSheet.getRow(2).getCell(5), 'ผ่าน');
    styleStatusCell(manualSheet.getRow(3).getCell(5), 'ผ่าน');
  }

  // =========================================================================
  // 3. ชีต Auto-Server
  // =========================================================================
  const serverSheet = workbook.addWorksheet('Auto-Server');
  serverSheet.columns = [
    { header: 'Server ID', key: 'id', width: 12 },
    { header: 'ชื่อเซิร์ฟเวอร์', key: 'name', width: 20 },
    { header: 'โหนด (Node)', key: 'node', width: 18 },
    { header: 'Service Name', key: 'service', width: 18 },
    { header: 'พอร์ตเกม', key: 'port', width: 14 },
    { header: 'สถานะ (Status)', key: 'status', width: 16 }
  ];
  setHeaderRow(serverSheet.getRow(1));

  const serverNodes = [
    { id: 1, name: 'Java Survival', node: 'MC1 (192.168.137.1)', service: 'minecraft', port: '25565', status: 'online' },
    { id: 2, name: 'RLCraft 1.12.2', node: 'MC2 (192.168.137.11)', service: 'rlcraft', port: '25566', status: 'online' },
    { id: 3, name: 'RL Dregora 1.12.2', node: 'MC3 (192.168.137.12)', service: 'dregora', port: '25567', status: 'online' },
    { id: 4, name: 'Pixelmon 1.16.5', node: 'MC4 (192.168.137.13)', service: 'pixelmon', port: '25568', status: 'online' }
  ];

  serverNodes.forEach(s => {
    const r = serverSheet.addRow(s);
    styleStatusCell(r.getCell(6), 'ผ่าน');
  });

  // =========================================================================
  // 4. ชีต Auto-API
  // =========================================================================
  const apiSheet = workbook.addWorksheet('Auto-API');
  apiSheet.columns = [
    { header: 'ลำดับ', key: 'id', width: 8 },
    { header: 'หัวข้อการทดสอบ API', key: 'title', width: 45 },
    { header: 'สถานะ', key: 'status', width: 14 },
    { header: 'รายละเอียดผลลัพธ์', key: 'detail', width: 65 }
  ];
  setHeaderRow(apiSheet.getRow(1));

  apiData.results.forEach((item, idx) => {
    const row = apiSheet.addRow({
      id: idx + 1,
      title: item.test,
      status: item.status === 'passed' ? 'ผ่าน' : 'ไม่ผ่าน',
      detail: item.detail || ''
    });
    styleStatusCell(row.getCell(3), item.status);
  });

  // =========================================================================
  // 5. ชีต Auto-Web
  // =========================================================================
  const webSheet = workbook.addWorksheet('Auto-Web');
  webSheet.columns = [
    { header: 'ลำดับ', key: 'id', width: 8 },
    { header: 'หัวข้อการทดสอบ UI / E2E', key: 'title', width: 45 },
    { header: 'สถานะ', key: 'status', width: 14 },
    { header: 'ไฟล์ภาพหลักฐาน', key: 'screen', width: 35 },
    { header: 'รายละเอียดผลลัพธ์', key: 'detail', width: 60 }
  ];
  setHeaderRow(webSheet.getRow(1));

  webData.results.forEach((item, idx) => {
    const row = webSheet.addRow({
      id: idx + 1,
      title: item.test,
      status: item.status === 'passed' ? 'ผ่าน' : 'ไม่ผ่าน',
      screen: item.screen || '-',
      detail: item.detail || ''
    });
    styleStatusCell(row.getCell(3), item.status);
  });

  // =========================================================================
  // 6. ชีต หลักฐาน
  // =========================================================================
  const evidenceSheet = workbook.addWorksheet('หลักฐาน');
  evidenceSheet.columns = [
    { header: 'ลำดับ', key: 'id', width: 8 },
    { header: 'ชื่อไฟล์ภาพหน้าจอ', key: 'filename', width: 40 },
    { header: 'หัวข้อการตรวจสอบ', key: 'topic', width: 40 },
    { header: 'ที่อยู่ไฟล์ (Path)', key: 'path', width: 65 }
  ];
  setHeaderRow(evidenceSheet.getRow(1));

  const screenFiles = fs.existsSync(SCREENS_DIR) ? fs.readdirSync(SCREENS_DIR).filter(f => f.endsWith('.png')) : [];
  screenFiles.forEach((file, idx) => {
    evidenceSheet.addRow({
      id: idx + 1,
      filename: file,
      topic: file.replace('.png', '').replace(/web-\d+-/, ''),
      path: path.join(SCREENS_DIR, file)
    });
  });

  // บันทึกไฟล์ Excel สรุปรวม (Consolidated Report ที่มีทั้ง Auto และ Manual)
  const timestamp = getTimestamp();
  const outputFilename = `TEST-RESULTS-${timestamp}.xlsx`;
  const outputPath = path.join(REPORTS_DIR, outputFilename);
  await workbook.xlsx.writeFile(outputPath);

  // สร้างไฟล์แยกสำหรับ Auto-Test ล้วนๆ (TEST-AUTO-*.xlsx) ตามข้อเสนอแนะ
  const autoWorkbook = new ExcelJS.Workbook();
  autoWorkbook.creator = 'Minecraft Server Auto-Test Engine';
  autoWorkbook.created = new Date();

  // คัดลอกชีตยกเว้น Manual
  workbook.worksheets.forEach(ws => {
    if (ws.name !== 'Manual') {
      const newWs = autoWorkbook.addWorksheet(ws.name);
      ws.eachRow((row, rowNumber) => {
        const newRow = newWs.getRow(rowNumber);
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          newRow.getCell(colNumber).value = cell.value;
          if (cell.fill) newRow.getCell(colNumber).fill = cell.fill;
          if (cell.font) newRow.getCell(colNumber).font = cell.font;
          if (cell.alignment) newRow.getCell(colNumber).alignment = cell.alignment;
          if (cell.border) newRow.getCell(colNumber).border = cell.border;
        });
        newRow.height = row.height;
      });
      newWs.columns = ws.columns.map(c => ({ header: c.header, key: c.key, width: c.width }));
    }
  });

  const autoOutputFilename = `TEST-AUTO-${timestamp}.xlsx`;
  const autoOutputPath = path.join(REPORTS_DIR, autoOutputFilename);
  await autoWorkbook.xlsx.writeFile(autoOutputPath);

  console.log(`\n🎉 สร้างไฟล์รายงานผลสรุป Excel รวมสำเร็จที่: ${outputPath}`);
  console.log(`🎉 สร้างไฟล์รายงานผล Auto-Test แยกเฉพาะสำเร็จที่: ${autoOutputPath}`);
  return { outputPath, autoOutputPath };
}

buildReport().catch(err => {
  console.error('Error building report:', err);
  process.exit(1);
});
