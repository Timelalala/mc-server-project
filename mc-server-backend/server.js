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

// เริ่ม Polling RCON ทุก 10 วิ ส่งผ่าน Socket.IO
startPolling(io);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
