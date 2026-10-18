const db = require('../models/db')
const { sendRcon } = require('../controllers/rconController')

const SERVER_IDS = [1, 2, 3, 4]
const POLL_INTERVAL = 10000 // 10 วินาที

let lastStatus = {} // เก็บสถานะล่าสุดไว้เทียบ ไม่ emit ซ้ำถ้าไม่เปลี่ยน

const HEARTBEAT_WINDOW_MS = 3 * 60 * 1000 // 3 นาที

async function getServerStatus(serverId) {
  try {
    // Java Survival (serverId 1) is always online and in standby mode waiting for bookings
    const isJavaSurvival = serverId === 1;
    const isHostOnline = isJavaSurvival || Boolean(
      global.lastMcHeartbeat && (Date.now() - global.lastMcHeartbeat <= HEARTBEAT_WINDOW_MS)
    );

    if (!isHostOnline) {
      return { serverId, status: 'offline', current: 0, max: 20, isFull: false, timestamp: Date.now() };
    }

    // Host is online: Check if there is an active slot in bookings table
    const [activeBookings] = await db.query(
      "SELECT slot_status, online_players FROM bookings WHERE server_id = ? AND slot_status IN ('started', 'online') ORDER BY id DESC LIMIT 1",
      [serverId]
    );

    let current = 0;
    let max = 20;

    if (activeBookings && activeBookings.length > 0) {
      const activeBooking = activeBookings[0];
      let players = [];
      try {
        players = typeof activeBooking.online_players === 'string'
          ? JSON.parse(activeBooking.online_players)
          : (Array.isArray(activeBooking.online_players) ? activeBooking.online_players : []);
      } catch (e) {
        players = [];
      }
      current = Array.isArray(players) ? players.length : 0;
    }

    return { serverId, status: 'online', current, max, isFull: current >= max, timestamp: Date.now() };
  } catch (err) {
    return { serverId, status: 'offline', current: 0, max: 20, isFull: false, timestamp: Date.now() };
  }
}

function hasChanged(a, b) {
  if (!a) return true
  return a.status !== b.status || a.current !== b.current
}

function startPolling(io) {
  console.log('📡 Starting RCON polling every', POLL_INTERVAL / 1000, 'seconds')

  const poll = async () => {
    // ดึงสถานะทุก Pi พร้อมกัน ด้วย Promise.allSettled (ไม่ให้ตัวนึงพังแล้วทั้งหมดพัง)
    const results = await Promise.allSettled(SERVER_IDS.map(id => getServerStatus(id)))
    const statuses = results.map(r => r.status === 'fulfilled' ? r.value : null).filter(Boolean)

    // Emit รวมทุก Server (สำหรับหน้า Home)
    io.emit('servers-status', statuses)

    // Emit แยกทีละ Server เฉพาะตอนมีการเปลี่ยนแปลง (สำหรับหน้า ServerStatus)
    statuses.forEach(s => {
      if (hasChanged(lastStatus[s.serverId], s)) {
        io.emit(`server-${s.serverId}-status`, s)
        lastStatus[s.serverId] = s
      }
    })
  }

  poll() // รันทันทีครั้งแรก
  setInterval(poll, POLL_INTERVAL)
}

module.exports = { startPolling, getServerStatus }
