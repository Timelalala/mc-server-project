// Endpoints used only by MC1 (the Raspberry Pi that opens/closes slots).
// Protected by middleware/mcKey.js (header X-MC-Key), not by user JWT.
const db = require('../models/db');

const NAME = /^[A-Za-z0-9_]{1,16}$/;              // Java Edition player names
const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

// GET /api/mc/bookings
// Confirmed bookings that have not ended yet and start within the next 24 hours.
// Times are returned as local "YYYY-MM-DDTHH:MM" strings, the same format mcslot-tick reads.
exports.listBookings = async (req, res) => {
  try {
    // Record heartbeat from host machine (MC1)
    global.lastMcHeartbeat = Date.now();

    const [rows] = await db.query(`
      SELECT id, server_id, user_id,
             DATE_FORMAT(start_time, '%Y-%m-%dT%H:%i') AS start,
             DATE_FORMAT(end_time,   '%Y-%m-%dT%H:%i') AS end,
             slot_status
        FROM bookings
       WHERE status = 'confirmed'
         AND start_time IS NOT NULL
         AND end_time IS NOT NULL
         AND end_time > NOW()
         AND start_time < NOW() + INTERVAL 1 DAY
       ORDER BY start_time`);
    res.json(rows.map(r => ({
      id: String(r.id),
      server_id: r.server_id,
      user_id: r.user_id,   // MC1 opens world "w-user-<user_id>" and merges back-to-back slots of the same owner
      start: r.start,
      end: r.end,
      slot_status: r.slot_status,
    })));
  } catch (err) {
    console.error('mc listBookings error:', err);
    res.status(500).json({ message: 'Error listing bookings.' });
  }
};

// POST /api/mc/bookings/:id/status
// Body: { status: "started" | "online" | "ended", ip?: "1.2.3.4", players?: ["Name", ...] }
//  - started: slot opened, ip is the new Reserved IP for this booking
//  - online:  sent every minute during the slot with who is online right now
//  - ended:   slot closed, ip returned
exports.updateStatus = async (req, res) => {
  // Record heartbeat from host machine (MC1)
  global.lastMcHeartbeat = Date.now();

  const id = Number(req.params.id);
  const { status, ip, players } = req.body || {};

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: 'Invalid booking id.' });
  }
  if (!['started', 'online', 'ended'].includes(status)) {
    return res.status(400).json({ message: 'status must be started, online or ended.' });
  }
  if (ip !== undefined && (typeof ip !== 'string' || !IPV4.test(ip))) {
    return res.status(400).json({ message: 'ip must be an IPv4 address.' });
  }
  const online = Array.isArray(players)
    ? [...new Set(players.filter(p => typeof p === 'string' && NAME.test(p)))].slice(0, 50)
    : [];

  try {
    const [rows] = await db.query('SELECT seen_players FROM bookings WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    let seen = [];
    try { seen = JSON.parse(rows[0].seen_players || '[]'); } catch (e) { seen = []; }
    for (const p of online) if (!seen.includes(p)) seen.push(p);

    const slotStatus = status === 'ended' ? 'ended' : 'started';
    const fields = ['slot_status = ?', 'online_players = ?', 'seen_players = ?', 'slot_updated_at = NOW()'];
    const params = [slotStatus, JSON.stringify(slotStatus === 'ended' ? [] : online), JSON.stringify(seen)];
    if (ip) { fields.push('ip = ?'); params.push(ip); }
    params.push(id);

    await db.query(`UPDATE bookings SET ${fields.join(', ')} WHERE id = ?`, params);

    // Tell open browser tabs to refresh. Deliberately no IP here: the IP is the key
    // to the server, so it is only sent to the booking owner through /api/bookings/my.
    const io = req.app.get('io');
    if (io) io.emit('booking-slot-update', { id, slot_status: slotStatus });

    res.json({ ok: true, slot_status: slotStatus, online: online.length, seen: seen.length });
  } catch (err) {
    console.error('mc updateStatus error:', err);
    res.status(500).json({ message: 'Error updating slot status.' });
  }
};

// ---------------------------------------------------------------------------
// Node health (sent by /usr/local/bin/mc-node-health on MC1 every minute)
// Kept in memory only: after a backend restart the panel shows "stale"
// until the next report arrives (at most ~1 minute).
// ---------------------------------------------------------------------------
const STALE_MS = 120 * 1000;
const SERVICE_STATES = new Set(['active', 'inactive', 'activating', 'deactivating', 'failed', 'reloading']);
let nodeHealth = { receivedAt: 0, checkedAt: null, nodes: [] };

const num = (v, min, max) =>
  (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max) ? v : null;
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : null);
const bool = (v) => (typeof v === 'boolean' ? v : null);

function cleanNode(n) {
  if (!n || typeof n !== 'object') return null;
  const id = Number(n.server_id);
  if (!Number.isInteger(id) || id <= 0 || id > 1000) return null;
  const reachable = n.reachable === true;
  return {
    server_id: id,
    name: str(n.name, 80),
    host: str(n.host, 64),
    service: str(n.service, 64),
    game_port: num(n.game_port, 1, 65535),
    reachable,
    error: reachable ? null : str(n.error, 200),
    cpu_pct: num(n.cpu_pct, 0, 100),
    ncpu: num(n.ncpu, 1, 256),
    load1: num(n.load1, 0, 1000),
    ram_used_mb: num(n.ram_used_mb, 0, 1e7),
    ram_total_mb: num(n.ram_total_mb, 0, 1e7),
    temp_c: num(n.temp_c, -50, 150),
    throttled: str(n.throttled, 16),
    throttled_now: bool(n.throttled_now),
    throttled_since_boot: bool(n.throttled_since_boot),
    uptime_s: num(n.uptime_s, 0, 1e10),
    service_state: n.service_state == null ? null
      : (SERVICE_STATES.has(n.service_state) ? n.service_state : 'unknown'),
  };
}

// ok | warn | hot | down  (stale is decided per request from the report age)
function levelOf(n) {
  if (!n.reachable) return 'down';
  if (n.throttled_now || (n.temp_c !== null && n.temp_c >= 80)) return 'hot';
  if ((n.temp_c !== null && n.temp_c >= 70) || n.throttled_since_boot) return 'warn';
  return 'ok';
}

// POST /api/mc/nodes/health   (X-MC-Key)
exports.updateNodeHealth = (req, res) => {
  global.lastMcHeartbeat = Date.now();
  const body = req.body || {};
  if (!Array.isArray(body.nodes) || body.nodes.length > 32) {
    return res.status(400).json({ message: 'nodes must be an array (max 32).' });
  }
  const nodes = body.nodes.map(cleanNode).filter(Boolean);
  nodeHealth = {
    receivedAt: Date.now(),
    checkedAt: typeof body.checked_at === 'string' ? body.checked_at.slice(0, 40) : null,
    nodes,
  };
  // Signal only: admin pages refetch /api/admin/nodes/health (admin JWT),
  // so internal IPs and temperatures never reach normal visitors' sockets.
  const io = req.app.get('io');
  if (io) io.emit('nodes-health-updated', { at: nodeHealth.receivedAt });
  res.json({ ok: true, nodes: nodes.length });
};

// GET /api/admin/nodes/health   (admin JWT)
exports.getNodeHealth = (req, res) => {
  const now = Date.now();
  const age = nodeHealth.receivedAt ? now - nodeHealth.receivedAt : null;
  const stale = age === null || age > STALE_MS;
  const hb = global.lastMcHeartbeat || 0;
  res.json({
    received_at: nodeHealth.receivedAt ? new Date(nodeHealth.receivedAt).toISOString() : null,
    checked_at: nodeHealth.checkedAt,
    age_s: age === null ? null : Math.round(age / 1000),
    stale,
    mc1_last_seen_s: hb ? Math.round((now - hb) / 1000) : null,
    nodes: nodeHealth.nodes.map(n => ({ ...n, level: stale ? 'stale' : levelOf(n) })),
  });
};

// GET /api/system/health
exports.getSystemHealth = (req, res) => {
  const now = Date.now();
  const age = nodeHealth.receivedAt ? now - nodeHealth.receivedAt : null;
  const stale = age === null || age > STALE_MS;
  const hb = global.lastMcHeartbeat || 0;

  const reachableNodes = nodeHealth.nodes.filter(n => n.reachable);
  let totalCpu = 0;
  let totalRamUsedMb = 0;
  let totalRamTotalMb = 0;

  if (reachableNodes.length > 0) {
    totalCpu = reachableNodes.reduce((acc, n) => acc + (n.cpu_pct || 0), 0);
    totalRamUsedMb = reachableNodes.reduce((acc, n) => acc + (n.ram_used_mb || 0), 0);
    totalRamTotalMb = reachableNodes.reduce((acc, n) => acc + (n.ram_total_mb || 0), 0);
  }

  const avgCpu = reachableNodes.length > 0 ? Number((totalCpu / reachableNodes.length).toFixed(1)) : 0;
  const totalRamUsedGb = totalRamUsedMb ? Number((totalRamUsedMb / 1024).toFixed(1)) : 0;
  const totalRamTotalGb = totalRamTotalMb ? Number((totalRamTotalMb / 1024).toFixed(1)) : 0;
  const ramUsageText = `${totalRamUsedGb} GB / ${totalRamTotalGb} GB`;
  const ramUsagePct = totalRamTotalMb > 0 ? Math.round((totalRamUsedMb / totalRamTotalMb) * 100) : 0;

  const nodes = nodeHealth.nodes.map(n => {
    const level = stale ? 'stale' : levelOf(n);
    const nUsedGb = n.ram_used_mb ? Number((n.ram_used_mb / 1024).toFixed(1)) : 0;
    const nTotalGb = n.ram_total_mb ? Number((n.ram_total_mb / 1024).toFixed(1)) : 0;
    const nUsageText = `${nUsedGb} GB / ${nTotalGb} GB`;
    const nUsagePct = n.ram_total_mb > 0 ? Math.round((n.ram_used_mb / n.ram_total_mb) * 100) : 0;

    return {
      server_id: n.server_id,
      name: n.name,
      host: n.host,
      service: n.service,
      reachable: n.reachable,
      status: n.service_state || (n.reachable ? 'online' : 'offline'),
      level,
      cpu_pct: n.cpu_pct != null ? n.cpu_pct : 0,
      cpu_usage_text: `${(n.cpu_pct != null ? n.cpu_pct : 0).toFixed(1)}%`,
      ram_used_mb: n.ram_used_mb || 0,
      ram_total_mb: n.ram_total_mb || 0,
      ram_used_gb: nUsedGb,
      ram_total_gb: nTotalGb,
      ram_usage_text: nUsageText,
      ram_usage_pct: nUsagePct,
      temp_c: n.temp_c,
      uptime_s: n.uptime_s,
    };
  });

  res.json({
    ok: true,
    received_at: nodeHealth.receivedAt ? new Date(nodeHealth.receivedAt).toISOString() : null,
    checked_at: nodeHealth.checkedAt,
    age_s: age === null ? null : Math.round(age / 1000),
    stale,
    mc1_last_seen_s: hb ? Math.round((now - hb) / 1000) : null,
    summary: {
      avg_cpu_pct: avgCpu,
      cpu_usage_text: `${avgCpu}%`,
      ram_used_gb: totalRamUsedGb,
      ram_total_gb: totalRamTotalGb,
      ram_usage_text: ramUsageText,
      ram_usage_pct: ramUsagePct,
      active_nodes: reachableNodes.length,
      total_nodes: nodeHealth.nodes.length,
    },
    nodes,
  });
};

