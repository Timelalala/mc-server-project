# สรุปรายการอัปเกรดระบบ: Server Booking System V2 (ระบบจองเครื่องเซิร์ฟเวอร์)

เอกสารนี้สรุปรายการเปลี่ยนแปลงและฟีเจอร์ที่ได้รับการปรับปรุงในโปรเจกต์ **Server Booking System** เพื่อรองรับข้อกำหนดทางธุรกิจ (Business Requirements) อย่างสมบูรณ์ ป้องกันปัญหา Race Condition จัดการราคาอย่างเป็นธรรม และเพิ่มประสิทธิภาพการใช้งานเครื่องเซิร์ฟเวอร์

---

## สารบัญการอัปเกรด

1. [ภาพรวมการปรับปรุง (Key Highlights)](#1-ภาพรวมการปรับปรุง-key-highlights)
2. [การเปลี่ยนแปลงระดับฐานข้อมูล (Database Schema)](#2-การเปลี่ยนแปลงระดับฐานข้อมูล-database-schema)
3. [การเปลี่ยนแปลงฝั่ง Backend (Node.js & Express)](#3-การเปลี่ยนแปลงฝั่ง-backend-nodejs--express)
4. [การเปลี่ยนแปลงฝั่ง Frontend (React & Tailwind)](#4-การเปลี่ยนแปลงฝั่ง-frontend-react--tailwind)
5. [ผลการทดสอบระบบ (Test Results)](#5-ผลการทดสอบระบบ-test-results)
6. [คำสั่งสำหรับการรัน Migration และทดสอบระบบ](#6-คำสั่งสำหรับการรัน-migration-และทดสอบระบบ)
7. [ระบบ Network Traffic Monitoring (Prometheus + Grafana Live Embed)](#7-ระบบ-network-traffic-monitoring-prometheus--grafana-live-embed)

---

## 1. ภาพรวมการปรับปรุง (Key Highlights)

| ข้อกำหนดทางธุรกิจ | สถานะเดิม | สิ่งที่ได้รับการแก้ไข/อัปเกรด |
| :--- | :--- | :--- |
| **1. Time Overlap & Conflict Check** | เช็คเฉพาะตาราง `time_slots` แต่การจองแบบ `fullday`/`multiday` ไม่ได้เช็คการชนกับ slot | เช็คการชนกันด้วยช่วงเวลาต่อเนื่อง (`start_time < new_end AND end_time > new_start`) ข้ามทุกประเภทการจอง และ validate ซ้ำทั้ง UI และ Backend |
| **2. Concurrency & Payment Locking** | Check-then-act ทั่วไป เสี่ยงต่อการแย่งจ่ายเงินแล้วชนกัน | ใช้ Database Transaction + Row-Level Locking (`FOR UPDATE`) บังคับใช้สิทธิ์ **First-Paid-First-Served** คนจ่ายสำเร็จคนแรกได้สิทธิ์ คนอื่นที่ชนกันจะถูก **Auto-Cancel** ทันที |
| **3. Pricing Model & Consistency** | ราคากำหนดตายตัว (Hardcoded) ในโค้ด | ย้ายกฎราคาลงตาราง `pricing_rules` พร้อมเขียนฟังก์ชัน **Pricing Consistency Validation** บังคับให้ราคาเฉลี่ยต่อชั่วโมงของ Daily ($\ge 8$ ชม.) ต้อง $\le$ Slot เสมอ |
| **4. Idle Time Optimization** | ล็อกบล็อกเวลาแบบกว้าง | ปรับให้ล็อกเฉพาะช่วงเวลาจริงที่ใช้งาน ช่วงเวลาก่อนหน้าและหลังจากนั้นเปิดว่างให้ผู้ใช้อื่นจองได้ 100% |
| **5. Multi-Server Independence** | - | ผู้ใช้คนเดียวกันสามารถจองเครื่อง Server A และ Server B ในช่วงเวลาเดียวกันได้โดยไม่มีข้อจำกัด |

---

## 2. การเปลี่ยนแปลงระดับฐานข้อมูล (Database Schema)

### 2.1 ตารางใหม่: `pricing_rules`
ตารางสำหรับเก็บอัตราค่าบริการแบบ Dynamic (ไม่ Hardcode)
```sql
CREATE TABLE IF NOT EXISTS pricing_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  server_id INT NULL COMMENT 'NULL สำหรับกฎราคากลาง',
  booking_type VARCHAR(20) NOT NULL,
  duration_hours INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_pricing_rules_active (is_active, booking_type)
);
```

### 2.2 ปรับปรุงตาราง `bookings`
- เพิ่มคอลัมน์ `start_time` (DATETIME) และ `end_time` (DATETIME) สำหรับบันทึกช่วงเวลาจริงที่ต่อเนื่อง
- เพิ่มคอลัมน์ `lock_expires_at` (DATETIME) สำหรับจำกัดเวลา hold สิทธิ์ชั่วคราว (15 นาที) ระหว่างรอชำระเงิน
- เพิ่มสถานะ `'cancelled'` ใน ENUM `payment_status`
- เพิ่ม Composite Index สำคัญ:
  ```sql
  INDEX idx_server_availability (server_id, payment_status, start_time, end_time)
  ```

### 2.3 สคริปต์ Migration อัตโนมัติ
- เพิ่มไฟล์ `models/migrate-v2-booking.js` สำหรับตรวจเช็คและ Alter ตารางฐานข้อมูลเดิมให้เป็นเวอร์ชันใหม่อย่างปลอดภัยโดยข้อมูลเดิมไม่สูญหาย พร้อม Backfill ค่า `start_time` และ `end_time` ย้อนหลัง

---

## 3. การเปลี่ยนแปลงฝั่ง Backend (Node.js & Express)

### 3.1 เพิ่มโมดูลตรวจสอบและคำนวณราคา (`services/pricingService.js`)
- **`validatePricingConsistency(slotConfig, dailyConfig)`**:
  - ตรวจสอบว่า `dailyConfig.durationHours` ต้อง $\ge 8$ ชั่วโมง
  - คำนวณ Hourly Rate: $\frac{\text{Daily Price}}{\text{Daily Hours}} \le \frac{\text{Slot Price}}{\text{Slot Hours}}$
  - หาก Daily เฉลี่ยต่อชั่วโมงแพงกว่า Slot จะ Reject ด้วย Error ทันที
- **`calculateBookingPrice(bookingType, options)`**: คำนวณราคาแบบไดนามิกตามกฎที่ดึงมาจากฐานข้อมูล

### 3.2 ปรับปรุง Endpoint สร้างการจอง (`controllers/bookingController.js`)
- ใน `createBooking`:
  - ตรวจสอบสถานะ Server ว่าไม่ติดสถานะ `maintenance` หรือ `retired`
  - ตรวจจับ Time Overlap ข้ามทุกโหมดการจอง (`timeslot`, `fullday`, `multiday`, `daily`)
  - กำหนดเวลาชำระเงิน `lock_expires_at = NOW() + 15 นาที`
  - ล็อก Row ข้อมูลด้วย `FOR UPDATE` ระดับ Transaction ป้องกันการแย่งจองพร้อมกัน

### 3.3 ปรับปรุงระบบชำระเงิน First-Paid-First-Served (`controllers/paymentController.js`)
- เพิ่มฟังก์ชัน `processPaymentSuccess(connection, bookingId, chargeId)` ที่รันภายใต้ Transaction:
  1. ตรวจสอบว่าในระหว่างที่รอจ่ายเงิน มีผู้ใช้อื่นชำระเงิน (`paid`) ทับช่วงเวลานี้ไปแล้วหรือไม่
  2. **ถ้ามีคนตัดหน้าไปก่อน**: ยกเลิกรายการของตนเอง (`cancelled`) และตอบกลับ HTTP 409 Conflict พร้อมแจ้งเตือนเรื่องการคืนเงิน
  3. **ถ้าจ่ายสำเร็จคนแรก**: เปลี่ยนสถานะเป็น `paid` และสั่ง **Auto-Cancel รายการ pending อื่นๆ ทั้งหมดที่ทับซ้อนกับช่วงเวลานี้ทันที**
  4. อัปเดต `time_slots` ให้เป็น `booked` ถาวร

### 3.4 ปรับปรุงการตรวจสอบความว่างและ Idle Time Optimization (`controllers/serverController.js`)
- ใน `getSlots`:
  - ดึงข้อมูลจาก `bookings` ทั้งหมดที่สถานะ `paid` หรือ `pending` ที่ยังไม่หมดอายุ lock
  - นำช่วงเวลามา cross-check กับ Time Slot ของวันนั้น เพื่อ Disable เฉพาะช่องที่ไม่ว่าง
  - ช่วงเวลาก่อนหน้าและหลังจากนั้นจะยังคงเปิดให้จองได้ตามปกติ (Idle Time Optimization)

### 3.5 เพิ่ม Admin & Pricing Routes (`routes/index.js`)
- `GET /api/pricing-rules` — ดึงกฎราคาปัจจุบัน
- `POST /api/admin/pricing-rules/validate` — ทดสอบและตรวจสอบความสอดคล้องของราคาก่อนบันทึก

---

## 4. การเปลี่ยนแปลงฝั่ง Frontend (React & Tailwind)

### 4.1 หน้าจองเซิร์ฟเวอร์ (`Booking.jsx`)
- **Date-First Workflow**: ผู้ใช้เลือกวันที่ก่อน จากนั้นระบบจะโหลดและแสดงเฉพาะสถานะความว่างของเซิร์ฟเวอร์ในวันนั้น
- **Disable Overlapped Slots**: ช่องเวลาที่ถูกจองแล้ว หรือติดคิวชำระเงิน จะถูกปิดการคลิก (Disable) พร้อมเปลี่ยนสีเป็นสถานะไม่ว่างทันที
- **Conflict Handling**: แก้ไขข้อผิดพลาดเดิมที่เคย bypass ไปหน้า Payment เมื่อ backend คืน error โดยเปลี่ยนเป็นแจ้งเตือนข้อความขัดแย้งที่ชัดเจน และรีเฟรชตารางเวลาว่างให้อัตโนมัติ

### 4.2 หน้าชำระเงิน (`Payment.jsx`)
- แสดงข้อความเตือนเมื่อเกิดกรณี **First-Paid-First-Served Conflict** (เช่น มีผู้อื่นชำระเงินตัดหน้าไปก่อน)
- รองรับปุ่มจำลองการชำระเงิน (Test Mode) ที่ปลอดภัยต่อการทดสอบ Concurrency

---

## 5. ผลการทดสอบระบบ (Test Results)

รันชุดทดสอบครอบคลุมทั้ง 4 เคสผ่านไฟล์ `tests/booking_system.test.js`:

```text
▶ === 1. Pricing Consistency & Hourly Rate Tests ===
  ✔ ควรผ่าน: ราคาต่อชั่วโมงของ Daily (8 ชม.) ต่ำกว่า Slot (2 ชม.) (0.85ms)
  ✔ ควรผ่าน: ราคาต่อชั่วโมงของ Daily เท่ากับ Slot พอดี (0.24ms)
  ✔ ต้องปฏิเสธ: ราคาเฉลี่ยต่อชั่วโมงของ Daily แพงกว่า Slot (0.51ms)
  ✔ ต้องปฏิเสธ: แพ็กเกจ Daily มีระยะเวลาน้อยกว่า 8 ชั่วโมง (0.21ms)
  ✔ คำนวณราคาประเภทต่างๆ จาก Pricing Rules ได้ถูกต้อง (48.60ms)
✔ === 1. Pricing Consistency & Hourly Rate Tests === (52.27ms)

▶ === 2. Time Overlap & Conflict Detection Tests ===
  ✔ ตรวจพบการจองทับซ้อน (Overlap) กับรายการที่จ่ายเงินแล้ว (Paid) (4.07ms)
  ✔ Idle Time Optimization: ช่วงเวลาติดกัน (Adjacent) 14:00 - 18:00 ต้องไม่ชนและจองได้ (1.61ms)
✔ === 2. Time Overlap & Conflict Detection Tests === (25.29ms)

▶ === 3. Multi-Server Booking Independence Tests ===
  ✔ ผู้ใช้คนเดียวกันสามารถจอง Server Alpha และ Server Beta ในเวลาเดียวกันได้ (3.74ms)
✔ === 3. Multi-Server Booking Independence Tests === (13.95ms)

▶ === 4. First-Paid-First-Served Concurrency Locking Tests ===
  ✔ User B จ่ายเงินสำเร็จก่อน -> ได้รับสิทธิ์ล็อคสมบูรณ์ (paid) (12.37ms)
  ✔ User A ที่จ่ายทีหลัง ต้องถูกปฏิเสธ (409 Conflict) และสถานะถูก Cancel อัตโนมัติ (5.46ms)
✔ === 4. First-Paid-First-Served Concurrency Locking Tests === (32.23ms)

ทั้งหมด: 4 ผ่านสมบูรณ์ (100% Passed)
```

---

## 6. คำสั่งสำหรับการรัน Migration และทดสอบระบบ

### รัน Migration อัปเดตฐานข้อมูล
```powershell
cd mc-server-backend
node models/migrate-v2-booking.js
```

### รันชุดทดสอบความถูกต้อง (Automated Tests)
```powershell
cd mc-server-backend
node tests/booking_system.test.js
```

### เริ่มต้นเซิร์ฟเวอร์ Backend
```powershell
cd mc-server-backend
npm run dev
```

### เริ่มต้นเซิร์ฟเวอร์ Frontend
```powershell
cd mc-server-frontend
npm run dev
```

---

## 7. ระบบ Network Traffic Monitoring (Prometheus + Grafana Live Embed)

ระบบติดตามการใช้งานแบนด์วิดท์เครือข่ายของคลัสเตอร์ Raspberry Pi (MC1–MC4) แบบ Real-time และฝังกราฟแบบ Live Embed บนหน้าจอ Admin ของ React Frontend

```
[ Raspberry Pi Cluster (192.168.137.x) ]
  ├── MC1 (Master): 192.168.137.1:9100   (interface bond0 / eth0)
  ├── MC2 (RLCraft): 192.168.137.11:9100 (interface eth0)
  ├── MC3 (Dregora): 192.168.137.12:9100 (interface eth0)
  └── MC4 (Pixelmon): 192.168.137.13:9100 (interface eth0)
                      ▲
                      │ (SOCKS5 Proxy ผ่าน SSH Tunnel พอร์ต 1080)
                      │
[ Windows โน้ตบุ๊ก (Standalone Binaries) ]
  ├── Prometheus (Port 9090) ── ดึง Metrics ทุก 2 วินาที
  ├── Grafana (Port 3000) ──── Provisioning Datasource & Dashboard อัตโนมัติ
  └── React Frontend ───────── <iframe> ฝังกราฟสดใน Dashboard และ Servers
```

### 7.1 โครงสร้างไฟล์ในโฟลเดอร์ `monitoring/`
- `monitoring/start-monitoring.ps1` — สคริปต์ PowerShell สำหรับเริ่มระบบทั้งหมดในคลิกเดียว (Proxy 1080 + Prometheus 9090 + Grafana 3000)
- `monitoring/stop-monitoring.ps1` — สคริปต์ PowerShell สำหรับปิดระบบ monitoring ทั้งหมด
- `monitoring/prometheus/`
  - `prometheus.exe` — ไบนารี Prometheus v3.x สำหรับ Windows
  - `prometheus.yml` — กำหนด `scrape_interval: 2s` และระบุ Targets ทั้ง 4 โหนดผ่าน `proxy_url: socks5://127.0.0.1:1080`
  - `data/` — โฟลเดอร์จัดเก็บข้อมูล Time-series (TSDB) ซึ่งถูกเพิ่มใน `.gitignore`
- `monitoring/grafana/`
  - `bin/grafana-server.exe` — ไบนารี Grafana v11.x Standalone สำหรับ Windows
  - `conf/custom.ini` — ตั้งค่า `[security] allow_embedding = true` และเปิด `[auth.anonymous]` สิทธิ์ Viewer
  - `conf/provisioning/datasources/datasources.yaml` — กำหนด Prometheus เป็น Default Datasource อัตโนมัติ
  - `conf/provisioning/dashboards/` — คอนฟิกโหลด Dashboard อัตโนมัติ พร้อมไฟล์ `network-traffic.json`
  - `data/` — ฐานข้อมูลภายในและ log ของ Grafana ซึ่งถูกเพิ่มใน `.gitignore`

### 7.2 สูตร PromQL สำหรับคำนวณ Traffic แยกรายเครื่อง (Per-node Breakdown)
- **Download / Inbound (RX แยกเครื่อง):**
  ```promql
  sum by (node) (rate(node_network_receive_bytes_total{device=~"bond0|eth0"}[10s])) * 8
  ```
  *Legend format:* `{{node}} - RX (Download)`
- **Upload / Outbound (TX แยกเครื่อง):**
  ```promql
  sum by (node) (rate(node_network_transmit_bytes_total{device=~"bond0|eth0"}[10s])) * 8
  ```
  *Legend format:* `{{node}} - TX (Upload)`
*(แสดงผลในหน่วย Data rate > Bits/sec (bps) พร้อมตารางสรุปค่า Last และ Max ด้านล่างของกราฟ)*

### 7.3 การฝังเข้าสู่หน้าเว็บ React Frontend
- สร้างคอมโพเนนต์ `mc-server-frontend/src/components/admin/NetworkTrafficGraph.jsx`
- ดึง Embed ผ่าน URL:
  ```
  http://localhost:3000/d-solo/mc-cluster-traffic/mc-cluster-network-traffic?orgId=1&panelId=1&refresh=2s&theme=dark&kiosk
  ```
- แสดงผลในหน้า **Dashboard** (`src/pages/admin/Dashboard.jsx`) และหน้า **จัดการเซิร์ฟเวอร์** (`src/pages/admin/Servers.jsx`) พร้อมปุ่มรีเฟรชและปุ่มเปิดดูกราฟเต็มจอบน Grafana โดยมีพารามิเตอร์ `&kiosk` ซ่อนเมนูของ Grafana ให้ดูกลมกลืนกับหน้าเว็บ

### 7.4 คำสั่งการใช้งาน
- **เริ่มระบบ Monitoring:**
  ```powershell
  .\monitoring\start-monitoring.ps1
  ```
- **หยุดการทำงาน:**
  ```powershell
  .\monitoring\stop-monitoring.ps1
  ```
- **เข้าดูหน้าเว็บ Grafana โดยตรง:** [http://localhost:3000](http://localhost:3000)
- **เข้าดูสถานะเป้าหมาย Prometheus:** [http://localhost:9090/targets](http://localhost:9090/targets)
