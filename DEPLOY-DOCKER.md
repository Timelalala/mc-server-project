# 🐳 คู่มือการติดตั้งและ Deploy ระบบด้วย Docker (Docker Deployment Guide)

เอกสารนี้อธิบายสถาปัตยกรรมและการ Deploy ระบบจองและควบคุมเซิร์ฟเวอร์ Minecraft ด้วย Docker Compose พร้อมผลการตรวจสอบและปรับแต่งโค้ดจริง

---

## 🏗️ 1. สถาปัตยกรรม Docker Container (System Architecture)

ระบบถูกแยกการทำงานออกเป็น 3 คอนเทนเนอร์หลักในบริดจ์เน็ตเวิร์กเดียวกัน (`mc-network`):

```text
ผู้ใช้งาน / เบราว์เซอร์
         │
         ▼ (พอร์ต 80)
┌────────────────────────────────────────────────────────┐
│  mc-frontend (Nginx Alpine)                            │
│  - บริการไฟล์เว็บ React SPA (Vite Production Build)    │
│  - Reverse Proxy /api/    ──▶  http://backend:5000/api/│
│  - Reverse Proxy /uploads/──▶  http://backend:5000/    │
│  - Reverse Proxy /socket.io/ (WebSocket Upgrade)       │
└────────────────────────┬───────────────────────────────┘
                         │
                         ▼ (พอร์ต 5000 ภายใน)
┌────────────────────────────────────────────────────────┐
│  mc-backend (Node.js 20 Alpine)                        │
│  - Express.js API + Socket.IO                          │
│  - Bind พอร์ต "127.0.0.1:5000:5000" เพื่อให้            │
│    Reverse SSH Tunnel จาก MC1 ใช้งานได้ต่อเนื่องปกติ   │
│  - จัดเก็บไฟล์สลิปใน Docker Volume: backend_uploads    │
└────────────────────────┬───────────────────────────────┘
                         │
                         ▼ (พอร์ต 3306 ภายใน)
┌────────────────────────────────────────────────────────┐
│  mc-db (MySQL 8.0)                                     │
│  - Bind พอร์ต "127.0.0.1:3306:3306"                     │
│  - Timezone: Asia/Bangkok (+07:00)                     │
│  - ข้อมูลถาวรใน Docker Volume: mysql_data              │
│  - Auto-Init Database จาก database/init/               │
└────────────────────────────────────────────────────────┘
```

---

## 📋 2. โครงสร้างไฟล์ Docker ในระบบ

```text
mc-server-project/
├── docker-compose.yml              # กำหนดการทำงานของ service: db, backend, frontend
├── .env.example                    # แม่แบบ Environment Variables สำหรับ Docker
├── DEPLOY-DOCKER.md                # เอกสารคู่มือและรายงานการตรวจสอบนี้
├── database/
│   └── init/
│       └── 01-schema.sql           # สคริปต์สร้าง Database และตารางเริ่มต้นเมื่อรันครั้งแรก
├── mc-server-backend/
│   ├── Dockerfile                  # Node.js 20 Alpine Image สำหรับ Backend API
│   └── .dockerignore               # ละเว้น node_modules, .env, scratch, tests
└── mc-server-frontend/
    ├── Dockerfile                  # Multi-stage build (Node builder -> Nginx Alpine)
    ├── nginx.conf                  # Nginx Configuration + Reverse Proxy + WebSockets
    └── .dockerignore               # ละเว้น node_modules, dist, .env
```

---

## 🔍 3. ผลการตรวจสอบและยืนยันสมมติฐานทางเทคนิค (Verification Results)

| หัวข้อตรวจสอบ | สิ่งที่ตรวจพบในโค้ดจริง | การดำเนินการแก้ไข / ผลลัพธ์ |
|---|---|---|
| **1. ตัวแปรชื่อ Database (`models/db.js`)** | โค้ดใช้ตัวแปร `DB_HOST`, `DB_USER`, **`DB_PASS`**, `DB_NAME` (ไม่ได้ใช้ `DB_PASSWORD`) | ปรับใน `docker-compose.yml` ให้ส่ง `DB_PASS: ${DB_PASS}` เพื่อให้เชื่อมต่อ DB สำเร็จ 100% |
| **2. Base URL ของ Frontend (`utils/api.js`)** | โค้ดเขียน `baseURL: import.meta.env.VITE_API_URL \|\| 'http://localhost:5000/api'` และเรียก `api.get('/servers')` | กำหนดค่า `VITE_API_URL=/api` ใน `docker-compose.yml` เพื่อให้ Nginx รับคำขอที่ `/api/servers` พอดี (ไม่เกิดปัญหาซ้ำซ้อน `/api/api/`) |
| **3. Socket.IO Connection (`useServerStatus.js`)** | เดิมฮาร์ดโค้ดเป็น `const SOCKET_URL = 'http://localhost:5000'` | ปรับเป็น dynamic ให้ใช้ `window.location.origin` เชื่อมต่อผ่าน Nginx WebSocket Proxy ได้อัตโนมัติ |
| **4. CORS Configuration (`server.js`)** | เดิมฮาร์ดโค้ดเฉพาะ localhost:5173 | ปรับให้อ่านจาก `process.env.CORS_ORIGIN` และเปิดรับ origin ของ container ได้ยืดหยุ่น |
| **5. Port Binding (`server.js`)** | โค้ดใช้ `httpServer.listen(PORT)` โดยไม่ผูก 127.0.0.1 (Bind `0.0.0.0` อัตโนมัติ) | **ถูกต้องอยู่แล้ว** คอนเทนเนอร์สามารถรับทราฟฟิกจาก Nginx และ Tunnel ได้ |
| **6. ที่เก็บไฟล์สลิป (`uploads/`)** | โค้ดเก็บที่โฟลเดอร์ root ของ backend (`path.join(__dirname, 'uploads')`) | แมป Volume `backend_uploads:/app/uploads` ใน `docker-compose.yml` และทำ proxy `/uploads/` ใน `nginx.conf` |
| **7. การคำนวณ Timezone (UTC vs +07:00)** | โค้ดใช้ `new Date()` ใน JS และ `NOW()` ใน SQL หลายจุด | บังคับตั้ง `TZ=Asia/Bangkok` ใน Dockerfile และ `--default-time-zone='+07:00'` ใน MySQL คอนเทนเนอร์ คำนวณเวลาสล็อตไม่คลาดเคลื่อน |
| **8. พอร์ต Reverse SSH Tunnel จาก MC1** | สคริปต์ `mc-tunnel.ps1` ทำพอร์ตฟอร์เวิร์ดมาที่ `127.0.0.1:5000` | ใน `docker-compose.yml` เปิดพอร์ตแบบ `"127.0.0.1:5000:5000"` ทำให้ Tunnel จาก MC1 ยังต่อเข้ามาได้ปกติ ไม่กระทบระบบเดิม |

---

## 🚀 4. ขั้นตอนการรันและการ Deploy (Step-by-Step)

### ขั้นที่ 1: เตรียมไฟล์ Environment
คัดลอกไฟล์แม่แบบ `.env.example` มาเป็น `.env`:
```bash
cp .env.example .env
```
*(ตรวจสอบรหัสผ่าน `DB_PASS` และค่า `JWT_SECRET` ให้ตรงตามต้องการ)*

### ขั้นที่ 2: ตรวจสอบความถูกต้องของคอนฟิก
```bash
docker compose config
```

### ขั้นที่ 3: สั่ง Build Image ทั้งหมด
```bash
docker compose build
```

### ขั้นที่ 4: สั่งรันระบบทั้งหมดในโหมด Background
```bash
docker compose up -d
```

### ขั้นที่ 5: ตรวจสอบสถานะและ Log การทำงาน
```bash
# ตรวจสอบสถานะคอนเทนเนอร์
docker compose ps

# ดู Log แบบ Real-time
docker compose logs -f backend
```

---

## 📌 5. สิ่งที่ผู้ดูแลระบบต้องทำเองต่อ (Action Items)

1. **Dump ข้อมูลจริงลง Database เริ่มต้น (ถ้าต้องการนำข้อมูลเดิมมาใช้งาน):**
   - หากมีข้อมูลการจองหรือผู้ใช้จริงใน MySQL เดิม ให้ทำการ Export (mysqldump) มาเซฟทับไว้ที่:
     `database/init/01-schema.sql`
2. **การรัน Reverse SSH Tunnel:**
   - เมื่อรัน Docker แล้ว พอร์ต 5000 จะถูกเปิดรอรับการเชื่อมต่อที่ `127.0.0.1:5000` บนเครื่อง Windows
   - คุณสามารถสั่งรัน `automation/mc-tunnel.ps1` ตามปกติได้ทันที เครื่อง MC1 จะเชื่อมต่อเข้ามายัง Express ภายในคอนเทนเนอร์ได้ราบรื่น
3. **การเข้าใช้งาน:**
   - หน้าเว็บ Frontend: เข้าผ่านเบราว์เซอร์ที่ `http://localhost` หรือ `http://<IP-เครื่อง>` (พอร์ต 80)
   - หน้า Backend API: ทดสอบผ่าน `http://localhost:5000/api/servers`
