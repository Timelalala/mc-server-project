const { Rcon } = require('rcon-client');
require('dotenv').config();

/**
 * Get RCON configuration for target server ID (1-4) from environment variables
 * @param {number|string} serverId 
 * @returns {object} { host, port, password, timeout, isSimulation }
 */
const getRconConfig = (serverId) => {
  const sId = String(serverId);

  // Map server IDs to env config (RCON_HOST_1..4 or fallback SSH_HOST_A..D or localhost)
  const hostEnv = process.env[`RCON_HOST_${sId}`];
  const sshFallback = sId === '1' ? process.env.SSH_HOST_A : sId === '2' ? process.env.SSH_HOST_B : sId === '3' ? process.env.SSH_HOST_C : process.env.SSH_HOST_D;
  
  const host = hostEnv || sshFallback || '127.0.0.1';
  const port = parseInt(process.env[`RCON_PORT_${sId}`] || process.env.RCON_PORT_DEFAULT || '25575', 10);
  const password = process.env[`RCON_PASSWORD_${sId}`] || process.env.RCON_PASSWORD_DEFAULT || '';
  const timeout = parseInt(process.env.RCON_TIMEOUT || '5000', 10);

  // Simulation mode check: Enable if explicit flag set OR password unconfigured / default dummy placeholder
  const forceSimulation = process.env.RCON_SIMULATION_MODE === 'true';
  const isDummyConfig = !password || password.includes('your_') || host === '127.0.0.1';
  const isSimulation = forceSimulation || isDummyConfig;

  return { host, port, password, timeout, isSimulation };
};

/**
 * Execute an RCON command on target Minecraft server.
 * Handles TCP Connection establishment, command dispatch, timeout protection,
 * and GUARANTEES connection termination via finally block.
 * 
 * @param {number|string} serverId - Server ID (1 to 4)
 * @param {string} command - Console command string
 * @returns {Promise<{success: boolean, response?: string, error?: string, rawError?: string, simulated?: boolean, serverId: number}>}
 */
const sendRconCommand = async (serverId, command) => {
  const numericId = Number(serverId);
  const config = getRconConfig(serverId);

  console.log(`[RCON Command Request] Server ID: ${numericId} | IP: ${config.host}:${config.port} | Command: "${command}"`);

  // Simulation Mode Fallback for local testing or unconfigured environments
  if (config.isSimulation) {
    console.log(`[RCON SIMULATION] Running simulated command "${command}" on Server ${numericId}`);
    let simulatedOutput = `Simulated execution of "${command}" on Server ${numericId} successful.`;
    
    // Simulate real Minecraft responses for common queries
    const lowerCmd = command.trim().toLowerCase();
    if (lowerCmd === 'list') {
      simulatedOutput = `There are 2 of a max of 20 players online: Alex, Steve`;
    } else if (lowerCmd.startsWith('say ')) {
      simulatedOutput = `[Server] ${command.substring(4)}`;
    } else if (lowerCmd.startsWith('whitelist add')) {
      simulatedOutput = `Added player to the whitelist`;
    } else if (lowerCmd.startsWith('kick')) {
      simulatedOutput = `Kicked player from the server`;
    }

    return {
      success: true,
      response: simulatedOutput,
      simulated: true,
      serverId: numericId
    };
  }

  let rconClient = null;
  try {
    // 1. Connect to Minecraft RCON with strict timeout limit
    rconClient = await Promise.race([
      Rcon.connect({
        host: config.host,
        port: config.port,
        password: config.password,
        timeout: config.timeout
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`RCON connection timed out (${config.timeout}ms)`)), config.timeout)
      )
    ]);

    // 2. Dispatch RCON command with timeout limit
    const response = await Promise.race([
      rconClient.send(command),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`RCON command execution timed out (${config.timeout}ms)`)), config.timeout)
      )
    ]);

    console.log(`[RCON Success] Server ${numericId} Response: "${response}"`);
    return {
      success: true,
      response: response || 'Command executed successfully (no output).',
      simulated: false,
      serverId: numericId
    };
  } catch (err) {
    console.error(`[RCON Failure] Server ${numericId} (${config.host}:${config.port}): ${err.message}`);

    let userFriendlyError = 'Failed to communicate with Minecraft server.';
    if (err.message.includes('timed out')) {
      userFriendlyError = `Connection timeout (${config.timeout}ms). Server may be offline or RCON port ${config.port} is blocked.`;
    } else if (err.message.includes('Authentication failed') || err.message.toLowerCase().includes('password')) {
      userFriendlyError = `RCON authentication failed. Please check RCON_PASSWORD_${numericId} in .env.`;
    } else if (err.code === 'ECONNREFUSED') {
      userFriendlyError = `Connection refused at ${config.host}:${config.port}. Ensure 'enable-rcon=true' is set in server.properties.`;
    } else if (err.code === 'ENOTFOUND' || err.code === 'EHOSTUNREACH') {
      userFriendlyError = `Host ${config.host} is unreachable. Check Raspberry Pi network connection.`;
    }

    return {
      success: false,
      error: userFriendlyError,
      rawError: err.message,
      simulated: false,
      serverId: numericId
    };
  } finally {
    // 3. MANDATORY CLOSE CONNECTION: Always release socket connection to avoid socket leaks
    if (rconClient) {
      try {
        await rconClient.end();
        console.log(`[RCON Closed] Successfully closed socket for Server ${numericId}`);
      } catch (closeErr) {
        console.warn(`[RCON Close Warning] Socket close error for Server ${numericId}:`, closeErr.message);
      }
    }
  }
};

/**
 * Query real-time server status, current online player count, and player list
 * @param {number|string} serverId 
 * @returns {Promise<object>}
 */
const getServerStatus = async (serverId) => {
  const numericId = Number(serverId);
  const result = await sendRconCommand(serverId, 'list');

  if (!result.success) {
    return {
      online: false,
      serverId: numericId,
      currentPlayers: 0,
      maxPlayers: 20,
      players: [],
      error: result.error,
      simulated: result.simulated
    };
  }

  // Parse Minecraft 'list' command output format:
  // Standard format: "There are 3 of a max of 20 players online: Alex, Steve, CraftMaster"
  const rawText = result.response;
  let currentPlayers = 0;
  let maxPlayers = 20;
  let players = [];

  const countMatch = rawText.match(/There are (\d+) of a max of (\d+) players online/i);
  if (countMatch) {
    currentPlayers = parseInt(countMatch[1], 10);
    maxPlayers = parseInt(countMatch[2], 10);
  }

  if (rawText.includes(':')) {
    const listPart = rawText.substring(rawText.indexOf(':') + 1).trim();
    if (listPart.length > 0) {
      players = listPart.split(',').map((p) => p.trim()).filter(Boolean);
    }
  }

  return {
    online: true,
    serverId: numericId,
    currentPlayers,
    maxPlayers,
    players,
    rawOutput: rawText,
    simulated: result.simulated
  };
};

/**
 * Send in-game broadcast message via 'say' command
 * @param {number|string} serverId 
 * @param {string} message 
 */
const broadcastMessage = async (serverId, message) => {
  const safeMessage = message.replace(/"/g, '\\"');
  return await sendRconCommand(serverId, `say ${safeMessage}`);
};

/**
 * Manage Whitelist (add / remove player)
 * @param {number|string} serverId 
 * @param {string} username 
 * @param {'add'|'remove'} action 
 */
const manageWhitelist = async (serverId, username, action = 'add') => {
  const command = action.toLowerCase() === 'remove' ? `whitelist remove ${username}` : `whitelist add ${username}`;
  const result = await sendRconCommand(serverId, command);
  if (result.success) {
    await sendRconCommand(serverId, 'whitelist reload');
  }
  return result;
};

/**
 * Kick player from server
 * @param {number|string} serverId 
 * @param {string} username 
 * @param {string} reason 
 */
const kickPlayer = async (serverId, username, reason = 'Kicked by administrator') => {
  const safeReason = reason.replace(/"/g, '\\"');
  return await sendRconCommand(serverId, `kick ${username} ${safeReason}`);
};

module.exports = {
  getRconConfig,
  sendRconCommand,
  getServerStatus,
  broadcastMessage,
  manageWhitelist,
  kickPlayer
};
