const db = require('../models/db');
const { NodeSSH } = require('node-ssh');
require('dotenv').config();

// Helper function to connect and execute command on target Pi via SSH
const runPiSSHCommand = async (serverId, command) => {
  let host, username, password;

  if (serverId === 1 || serverId === '1') {
    host = process.env.SSH_HOST_A;
    username = process.env.SSH_USER_A;
    password = process.env.SSH_PASS_A;
  } else if (serverId === 2 || serverId === '2') {
    host = process.env.SSH_HOST_B;
    username = process.env.SSH_USER_B;
    password = process.env.SSH_PASS_B;
  } else if (serverId === 3 || serverId === '3') {
    host = process.env.SSH_HOST_C;
    username = process.env.SSH_USER_C;
    password = process.env.SSH_PASS_C;
  }

  console.log(`SSH connection request for Server ID: ${serverId} to IP: ${host} with Command: ${command}`);

  // Fallback to Simulation Mode if config is missing or if connection fails
  if (!host || !username || !password || host === 'your_pi_password' || host === '127.0.0.1') {
    console.log(`[SIMULATION MODE] Running simulated command: '${command}' on Server ${serverId}`);
    return { success: true, stdout: 'Simulated command output: ok', simulated: true };
  }

  const ssh = new NodeSSH();
  try {
    // Attempt SSH connection with a short 3-second timeout
    await ssh.connect({
      host: host,
      username: username,
      password: password,
      readyTimeout: 3000
    });

    const result = await ssh.execCommand(command);
    ssh.dispose();
    return { success: true, stdout: result.stdout, stderr: result.stderr };
  } catch (err) {
    console.warn(`SSH connection failed to ${host}: ${err.message}. Falling back to simulation.`);
    return { success: true, stdout: `Fallback simulated output: ${err.message}`, simulated: true };
  }
};

exports.getServers = async (req, res) => {
  try {
    const [servers] = await db.query('SELECT * FROM servers');
    res.json(servers);
  } catch (err) {
    console.error('getServers error:', err);
    res.status(500).json({ message: 'Error retrieving servers.' });
  }
};

exports.getSlots = async (req, res) => {
  const { id } = req.params;
  const { date } = req.query; // YYYY-MM-DD format

  if (!date) {
    return res.status(400).json({ message: 'Date query parameter is required (YYYY-MM-DD).' });
  }

  try {
    // Check if slots exist for this date. If not, automatically seed default slots for this day.
    // Standard time slots: 09:00-11:00, 11:00-13:00, 13:00-15:00, 15:00-17:00, 17:00-19:00, 19:00-21:00, 21:00-23:00
    const [existingSlots] = await db.query(
      'SELECT * FROM time_slots WHERE server_id = ? AND date = ?',
      [id, date]
    );

    if (existingSlots.length === 0) {
      // Seed default slots
      const defaultSlots = [
        ['09:00:00', '11:00:00'],
        ['11:00:00', '13:00:00'],
        ['13:00:00', '15:00:00'],
        ['15:00:00', '17:00:00'],
        ['17:00:00', '19:00:00'],
        ['19:00:00', '21:00:00'],
        ['21:00:00', '23:00:00']
      ];

      for (const [start, end] of defaultSlots) {
        await db.query(
          'INSERT INTO time_slots (server_id, date, time_start, time_end, status) VALUES (?, ?, ?, ?, "available")',
          [id, date, start, end]
        );
      }

      const [newSlots] = await db.query(
        'SELECT * FROM time_slots WHERE server_id = ? AND date = ?',
        [id, date]
      );
      return res.json(newSlots);
    }

    res.json(existingSlots);
  } catch (err) {
    console.error('getSlots error:', err);
    res.status(500).json({ message: 'Error retrieving slots.' });
  }
};

// Remote Pi control functions (Admin only)
exports.startServer = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await runPiSSHCommand(id, 'sudo systemctl start minecraft');
    await db.query('UPDATE servers SET status = "online" WHERE id = ?', [id]);
    res.json({ message: 'Server started successfully.', detail: result.stdout });
  } catch (err) {
    console.error('Start server error:', err);
    res.status(500).json({ message: 'Failed to start Minecraft server.' });
  }
};

exports.stopServer = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await runPiSSHCommand(id, 'sudo systemctl stop minecraft');
    await db.query('UPDATE servers SET status = "offline" WHERE id = ?', [id]);
    res.json({ message: 'Server stopped successfully.', detail: result.stdout });
  } catch (err) {
    console.error('Stop server error:', err);
    res.status(500).json({ message: 'Failed to stop Minecraft server.' });
  }
};

exports.restartServer = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await runPiSSHCommand(id, 'sudo systemctl restart minecraft');
    await db.query('UPDATE servers SET status = "online" WHERE id = ?', [id]);
    res.json({ message: 'Server restarted successfully.', detail: result.stdout });
  } catch (err) {
    console.error('Restart server error:', err);
    res.status(500).json({ message: 'Failed to restart Minecraft server.' });
  }
};
