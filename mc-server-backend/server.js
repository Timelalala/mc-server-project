require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { createServer } = require('http');
const { Server } = require('socket.io');
const routes = require('./routes');
const { startPolling } = require('./services/socketService');

const app = express();

const envOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const allowedOrigins = [
  'http://localhost',
  'http://127.0.0.1',
  'http://localhost:80',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  /\.vercel\.app$/,
  /\.trycloudflare\.com$/,
  ...envOrigins
];

app.use(cors({
  origin: (origin, callback) => {
    // อนุญาต requests ที่ไม่มี origin (เช่น mobile apps, curl, docker internal) หรืออยู่ใน allowedOrigins
    if (!origin) return callback(null, true);
    const isAllowed = allowedOrigins.some(pattern => {
      if (pattern instanceof RegExp) return pattern.test(origin);
      return pattern === origin;
    });
    if (isAllowed) return callback(null, true);
    return callback(null, true); // ปลอดภัยและยืดหยุ่นในสภาพแวดล้อม Container Reverse Proxy
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'bypass-tunnel-reminder', 'ngrok-skip-browser-warning']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use('/uploads', express.static(uploadsDir));
app.use('/api/uploads', express.static(uploadsDir));
app.use('/api', routes);
app.get('/', (req, res) => res.json({ status: 'MC Server API running 🎮' }));

// สร้าง HTTP Server + Socket.IO ผูกกับ Express app เดิม
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', credentials: true }
});

app.set('io', io); // เก็บไว้ให้ controller อื่นเรียกใช้ได้ถ้าต้องการ

io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  socket.on('disconnect', () => console.log(`🔌 Client disconnected: ${socket.id}`));
});

const db = require('./models/db');
const { sendRconCommand } = require('./services/rconService');

// เริ่ม Polling RCON ทุก 10 วิ ส่งผ่าน Socket.IO
startPolling(io);

// Auto-Expire Cron/Worker (รันทุก 10 วินาที) ตรวจสอบและจัดการการจองที่หมดเวลา
const checkExpiredBookings = async () => {
  try {
    // ค้นหารายการจองในตาราง bookings ที่ end_time <= NOW() และสถานะยังเป็น started หรือ confirmed
    const [expiredBookings] = await db.query(`
      SELECT b.id, b.server_id, b.slot_id, b.user_id, u.username
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      WHERE b.end_time <= NOW()
        AND (b.status = 'confirmed' OR b.slot_status = 'started')
    `);

    if (expiredBookings.length > 0) {
      console.log(`[Auto-Expire Worker] ตรวจพบการจองหมดเวลา ${expiredBookings.length} รายการ`);

      for (const booking of expiredBookings) {
        const { id, server_id, slot_id, username } = booking;

        // ส่งคำสั่ง RCON ไปยังโหนดปลายทางตาม server_id
        try {
          await sendRconCommand(server_id, 'say หมดเวลาการใช้งานเซิร์ฟเวอร์แล้ว ระบบกำลังนำคุณออกจากเกม');
          await sendRconCommand(server_id, 'kick @a หมดเวลาการจองแล้ว (Session Expired)');

          if (username) {
            await sendRconCommand(server_id, `whitelist remove ${username}`);
            await sendRconCommand(server_id, 'whitelist reload');
          }
        } catch (rconErr) {
          console.warn(`[Auto-Expire Worker] ไม่สามารถส่ง RCON ไปยัง Server ${server_id}:`, rconErr.message);
        }

        // ปรับปรุงฐานข้อมูลเมื่อหมดเวลา:
        // 1. bookings: status = 'completed', slot_status = 'stopped'
        await db.query(`
          UPDATE bookings 
          SET status = 'completed', slot_status = 'stopped' 
          WHERE id = ?
        `, [id]);

        // 2. time_slots: status = 'available', booking_id = NULL
        if (slot_id) {
          await db.query(`
            UPDATE time_slots 
            SET status = 'available', booking_id = NULL 
            WHERE id = ?
          `, [slot_id]);
        }

        // 3. servers: session_count = 0
        await db.query(`
          UPDATE servers 
          SET session_count = 0 
          WHERE id = ?
        `, [server_id]);
      }

      // ส่งอีเวนต์ผ่าน Socket.IO
      io.emit('booking_status_updated', { message: 'Booking expired' });
      console.log(`[Auto-Expire Worker] อัปเดตสถานะหมดเวลาเรียบร้อยและส่ง event booking_status_updated`);
    }
  } catch (err) {
    console.error('[Auto-Expire Worker] เกิดข้อผิดพลาดในการตรวจสอบการจองหมดเวลา:', err);
  }
};

// เริ่มรัน Auto-Expire Worker ทุก 10 วินาที
setInterval(checkExpiredBookings, 10000);
checkExpiredBookings();

// Multi-Node Player Polling Worker (รันทุกๆ 8 วินาที) ตรวจสอบจำนวนผู้เล่นออนไลน์จริงจากคลัสเตอร์ MC1 - MC4
const pollOnlinePlayers = async () => {
  try {
    // 1. ค้นหารายการเซิร์ฟเวอร์ที่มีสถานะ online จากตาราง servers (id: 1, 2, 3, 4)
    const [servers] = await db.query(
      "SELECT id, name, ip, pi_host, rcon_port, status FROM servers WHERE status = 'online' AND id IN (1, 2, 3, 4)"
    );

    let totalOnlinePlayers = 0;
    const nodePlayerDetails = [];

    // 2. Query ทุกโหนดพร้อมกันแบบ Concurrent (ไม่บล็อกเวลารอ timeout ของโหนดอื่น)
    const results = await Promise.allSettled(
      servers.map(async (server) => {
        let currentPlayers = 0;
        let isNodeOnline = false;

        try {
          const result = await sendRconCommand(server.id, 'list', {
            pi_host: server.pi_host,
            rcon_port: server.rcon_port
          });

          if (result && result.success) {
            const rconRes = result.response || '';
            // 3. Parse ข้อความผลลัพธ์ (รองรับทั้ง Vanilla/Paper และ Forge)
            const match = rconRes.match(/There are (\d+)(?:\s+of\s+a\s+max\s+of|\/)/i);
            if (match) {
              currentPlayers = parseInt(match[1], 10) || 0;
            }
            isNodeOnline = true;
          } else {
            currentPlayers = 0;
            isNodeOnline = false;
          }
        } catch (nodeErr) {
          // หากโหนดใดโหนดหนึ่งออฟไลน์หรือไม่ตอบสนอง ให้ปรับ current_players = 0 ของโหนดนั้น โดยไม่ทำให้ระบบล่ม
          console.warn(`[Player Polling Worker] Node ${server.id} (${server.name}) is unreachable:`, nodeErr.message);
          currentPlayers = 0;
          isNodeOnline = false;
        }

        // 4. อัปเดตฟิลด์ current_players ในตาราง servers แยกตามรายเซิร์ฟเวอร์
        await db.query(
          'UPDATE servers SET current_players = ? WHERE id = ?',
          [currentPlayers, server.id]
        );

        return {
          id: server.id,
          name: server.name,
          online: isNodeOnline,
          current_players: currentPlayers
        };
      })
    );

    // 5. นำจำนวนผู้เล่นมาบวกสะสมเป็นยอดรวมทั้งคลัสเตอร์
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        totalOnlinePlayers += r.value.current_players;
        nodePlayerDetails.push(r.value);
      }
    }

    nodePlayerDetails.sort((a, b) => a.id - b.id);

    // 6. ส่งข้อมูลยอดรวมและรายโหนดผ่าน Socket.IO
    io.emit('online_players_summary', {
      total: totalOnlinePlayers,
      nodes: nodePlayerDetails
    });
  } catch (err) {
    console.error('[Player Polling Worker] Error polling online players:', err.message);
  }
};

// เริ่มรัน Multi-Node Player Polling Worker ทุก 8 วินาที
setInterval(pollOnlinePlayers, 8000);
pollOnlinePlayers();

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error'
  });
});

process.on('uncaughtException', (err) => {
  if (err.code === 'ECONNRESET' || err.message?.includes('ECONNRESET')) {
    console.warn('[Process Warning] Handled ECONNRESET socket disconnect:', err.message);
    return;
  }
  console.error('[Process UncaughtException]:', err);
});

process.on('unhandledRejection', (reason) => {
  console.warn('[Process UnhandledRejection]:', reason?.message || reason);
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));

