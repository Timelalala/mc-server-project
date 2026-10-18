const express = require('express');
const router = express.Router();
const { verifyToken, adminOnly } = require('../middleware/auth');
const rconController = require('../controllers/rconController');

// Real-time server status and player list (Public / User authenticated)
router.get('/status/all', rconController.getAllServersStatus);
router.get('/servers/:serverId/status', rconController.getServerStatus);

// Administrative RCON Controls (Admin Token Required)
router.post('/admin/servers/:serverId/command', verifyToken, adminOnly, rconController.executeCommand);
router.post('/admin/servers/:serverId/broadcast', verifyToken, adminOnly, rconController.broadcast);
router.post('/admin/servers/:serverId/whitelist', verifyToken, adminOnly, rconController.manageWhitelist);
router.post('/admin/servers/:serverId/kick', verifyToken, adminOnly, rconController.kickPlayer);

module.exports = router;
