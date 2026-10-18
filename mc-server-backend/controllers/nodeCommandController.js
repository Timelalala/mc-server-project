// Admin -> MC1 command queue for game services (start / stop / restart).
// The admin page queues a command here. The agent on MC1 (/usr/local/bin/mc-node-agent)
// polls GET /api/mc/commands/next every few seconds, runs systemctl with the right
// service name from nodes.json, and posts the result to /api/mc/commands/:id/result.
// Kept in memory: a backend restart clears the list (pending commands are lost).
const db = require('../models/db');

const ACTIONS = new Set(['start', 'stop', 'restart', 'backup']);
const SUPPORTED = new Set(['start', 'stop', 'restart', 'backup']);
const PICKUP_TIMEOUT_MS = 2 * 60 * 1000;  // queued but MC1 never picked it up
const RUN_TIMEOUT_MS = 5 * 60 * 1000;     // picked up but no result came back
const KEEP = 50;

let seq = 0;
const commands = [];  // oldest first

function expire(now = Date.now()) {
  for (const c of commands) {
    if (c.status === 'pending' && now - c.created_at > PICKUP_TIMEOUT_MS) {
      c.status = 'failed';
      c.finished_at = now;
      c.message = 'MC1 did not pick up the command within 2 minutes (check SSH tunnel / mc-node-agent)';
    } else if (c.status === 'running' && now - c.picked_at > RUN_TIMEOUT_MS) {
      c.status = 'failed';
      c.finished_at = now;
      c.message = 'No result from MC1 within 5 minutes';
    }
  }
  while (commands.length > KEEP) commands.shift();
}

const iso = (t) => (t ? new Date(t).toISOString() : null);
const view = (c) => ({
  id: c.id, server_id: c.server_id, action: c.action, force: c.force,
  status: c.status, message: c.message, requested_by: c.requested_by,
  created_at: iso(c.created_at), picked_at: iso(c.picked_at), finished_at: iso(c.finished_at),
});

// Signal only (id/server/status). Admin pages refetch /api/admin/nodes/commands.
function signal(req, c) {
  const io = req.app.get('io');
  if (io) io.emit('node-command-updated', { id: c.id, server_id: c.server_id, status: c.status });
}

// POST /api/admin/servers/:id/:action   (admin JWT)   body: { force?: true }
// Anything other than start/stop/restart/backup falls through to the next route
// (kick, whitelist, broadcast ...).
exports.queueCommand = async (req, res, next) => {
  const action = req.params.action;
  if (!ACTIONS.has(action)) return next();

  const serverId = Number(req.params.id);
  if (!Number.isInteger(serverId) || serverId <= 0) {
    return res.status(400).json({ message: 'Invalid server id.' });
  }
  if (!SUPPORTED.has(action)) {
    return res.status(501).json({ message: 'Backup from the web panel is not supported yet.' });
  }
  const force = !!(req.body && req.body.force === true);

  expire();
  const busy = commands.find(c => c.server_id === serverId && (c.status === 'pending' || c.status === 'running'));
  if (busy) {
    return res.status(409).json({ message: 'A command for this server is still in progress.', busy: true, command: view(busy) });
  }

  // Never stop/restart under a playing customer unless the admin confirmed (force).
  if ((action === 'stop' || action === 'restart') && !force) {
    try {
      const [rows] = await db.query(`
        SELECT id, DATE_FORMAT(end_time, '%H:%i') AS end_at
          FROM bookings
         WHERE server_id = ? AND status = 'confirmed' AND slot_status = 'started'
           AND start_time <= NOW() AND end_time > NOW()
         ORDER BY start_time LIMIT 1`, [serverId]);
      if (rows.length) {
        return res.status(409).json({
          message: `Booking #${rows[0].id} is playing on this server until ${rows[0].end_at}.`,
          needs_confirm: true, booking_id: rows[0].id, end_at: rows[0].end_at,
        });
      }
    } catch (err) {
      console.error('queueCommand booking check error:', err);
      return res.status(500).json({ message: 'Could not check active bookings.' });
    }
  }

  const u = req.user || {};
  const c = {
    id: ++seq, server_id: serverId, action, force, status: 'pending', message: null,
    requested_by: u.username || u.email || (u.id != null ? String(u.id) : null),
    created_at: Date.now(), picked_at: null, finished_at: null,
  };
  commands.push(c);
  expire();
  signal(req, c);
  res.status(202).json({ ok: true, command: view(c) });
};

// GET /api/admin/nodes/commands   (admin JWT)  newest first
exports.listCommands = (req, res) => {
  expire();
  res.json({ commands: commands.slice().reverse().map(view) });
};

// GET /api/mc/commands/next   (X-MC-Key)  hands every pending command to MC1
exports.nextCommands = (req, res) => {
  global.lastMcHeartbeat = Date.now();
  expire();
  const now = Date.now();
  const out = [];
  for (const c of commands) {
    if (c.status === 'pending') {
      c.status = 'running';
      c.picked_at = now;
      out.push(c);
      signal(req, c);
    }
  }
  res.json(out.map(c => ({ id: c.id, server_id: c.server_id, action: c.action, force: c.force })));
};

// POST /api/mc/commands/:id/result   (X-MC-Key)   body: { ok: bool, message: string }
exports.commandResult = (req, res) => {
  global.lastMcHeartbeat = Date.now();
  const id = Number(req.params.id);
  const c = commands.find(x => x.id === id);
  if (!c) return res.status(404).json({ message: 'Command not found.' });
  if (c.status !== 'running') return res.status(409).json({ message: `Command is already ${c.status}.` });
  const { ok, message } = req.body || {};
  c.status = ok === true ? 'done' : 'failed';
  c.message = typeof message === 'string' ? message.slice(0, 300) : null;
  c.finished_at = Date.now();
  signal(req, c);
  res.json({ ok: true });
};
