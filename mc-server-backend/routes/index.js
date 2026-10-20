const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { verifyToken, adminOnly } = require('../middleware/auth');
const auth = verifyToken;
const authController = require('../controllers/authController');
const serverController = require('../controllers/serverController');
const bookingController = require('../controllers/bookingController');
const adminController = require('../controllers/adminController');
const payCtrl = require('../controllers/paymentController');
const rconCtrl = require('../controllers/rconController');
const rconRoutes = require('./rconRoutes');

// Multer storage configuration for payment slips
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const filetypes = /jpeg|jpg|png/;
  const mimetype = filetypes.test(file.mimetype);
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error('Only JPEG, JPG, and PNG files under 5MB are allowed!'));
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter
});

// --- Auth Routes ---
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.get('/auth/me', verifyToken, authController.me);
router.post('/auth/verify-reset-email', authController.verifyResetEmail);
router.post('/auth/reset-password', authController.resetPassword);

// --- Server & Time Slot Routes (User and Admin accessible) ---
router.get('/servers', serverController.getServers);
router.get('/servers/summary', serverController.getServerSummary);
router.get('/servers/busy-dates', serverController.getBusyDates);
router.get('/servers/:id/slots', serverController.getSlots);
router.get('/servers/:id/session-count', verifyToken, bookingController.getSessionCount);
router.post('/servers/:id/join', verifyToken, bookingController.joinServer);
router.post('/servers/:id/leave', verifyToken, bookingController.leaveServer);

// --- Booking Routes ---
router.get('/bookings/recent', bookingController.getRecentBookings);
router.post('/bookings', verifyToken, bookingController.createBooking);
router.post('/bookings/:id/cancel', verifyToken, bookingController.cancelBooking);
router.get('/bookings/my', verifyToken, bookingController.getMyBookings);

// --- Payment Routes (Omise PromptPay & EasySlip) ---
router.post('/payment/create-charge', verifyToken, payCtrl.createCharge);
router.get('/payment/status/:chargeId', verifyToken, payCtrl.getChargeStatus);
router.post('/payment/webhook', payCtrl.webhook);
router.post('/payment/simulate-success', verifyToken, adminOnly, payCtrl.simulateSuccess);
router.post('/payment/verify-slip', verifyToken, upload.single('slip'), payCtrl.verifySlip);

// --- Admin Control Panel Routes (Admin authenticated only) ---
router.get('/admin/stats', verifyToken, adminOnly, adminController.getStats);
router.get('/admin/users', verifyToken, adminOnly, adminController.getUsers);
router.delete('/admin/users/:id', verifyToken, adminOnly, adminController.deleteUser);
router.patch('/admin/users/:id/suspend', verifyToken, adminOnly, adminController.suspendUser);
router.get('/admin/servers', verifyToken, adminOnly, serverController.getServers);

// SSH commands to systemctl
const nodeCmd = require('../controllers/nodeCommandController');
router.post('/admin/servers/:id/:action', verifyToken, adminOnly, nodeCmd.queueCommand);
router.post('/servers/:id/backup', verifyToken, adminOnly, (req, res, next) => {
  req.params.action = 'backup';
  nodeCmd.queueCommand(req, res, next);
});
router.get('/admin/nodes/commands', verifyToken, adminOnly, nodeCmd.listCommands);

// Bookings lists and payment approvals
router.get('/admin/bookings', verifyToken, adminOnly, adminController.getAllBookings);
router.get('/admin/payments', verifyToken, adminOnly, adminController.getPayments);
router.patch('/admin/payments/:id', verifyToken, adminOnly, adminController.verifyPayment);

// Time slot CRUD (Admin only)
router.get('/admin/timeslots', verifyToken, adminOnly, adminController.getAllTimeSlots);
router.post('/admin/timeslots', verifyToken, adminOnly, adminController.createTimeSlot);
router.post('/admin/timeslots/bulk', verifyToken, adminOnly, adminController.createBulkTimeSlots);
router.delete('/admin/timeslots/:id', verifyToken, adminOnly, adminController.deleteTimeSlot);
router.post('/admin/slots', verifyToken, adminOnly, adminController.addSlot);
router.delete('/admin/slots/:id', verifyToken, adminOnly, adminController.deleteSlot);

// --- RCON Protocol Routes (Minecraft Server Management) ---
// User routes
router.get('/servers/:id/players',           auth, rconCtrl.getPlayers);
router.get('/servers/status-all',            auth, rconCtrl.getAllServersStatus);

// Admin routes
router.get('/admin/servers/:id/status',      auth, adminOnly, rconCtrl.getServerStatus);
router.post('/admin/servers/:id/kick',       auth, adminOnly, rconCtrl.kickPlayer);
router.post('/admin/servers/:id/whitelist',  auth, adminOnly, rconCtrl.addWhitelist);
router.delete('/admin/servers/:id/whitelist',auth, adminOnly, rconCtrl.removeWhitelist);
router.post('/admin/servers/:id/broadcast',  auth, adminOnly, rconCtrl.broadcastMessage);

const { validatePricingConsistency, getPricingRules } = require('../services/pricingService');

// --- Pricing Rules Routes ---
router.get('/pricing-rules', async (req, res) => {
  try {
    const rules = await getPricingRules(req.query.serverId);
    res.json(rules);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/admin/pricing-rules/validate', verifyToken, adminOnly, (req, res) => {
  try {
    const { slotConfig, dailyConfig } = req.body;
    validatePricingConsistency(slotConfig, dailyConfig);
    res.json({ valid: true, message: 'Pricing consistency validation passed.' });
  } catch (err) {
    res.status(400).json({ valid: false, error: err.message });
  }
});

router.put('/admin/pricing-rules/:id', verifyToken, adminOnly, adminController.updatePricingRule);

const mcController = require('../controllers/mcController');
const mcKey = require('../middleware/mcKey');
router.get('/mc/bookings', mcKey, mcController.listBookings);
router.post('/mc/bookings/:id/status', mcKey, mcController.updateStatus);
router.get('/mc/commands/next', mcKey, nodeCmd.nextCommands);
router.post('/mc/commands/:id/result', mcKey, nodeCmd.commandResult);
router.use('/rcon', rconRoutes);
router.post('/mc/nodes/health', mcKey, mcController.updateNodeHealth);
router.get('/admin/nodes/health', verifyToken, adminOnly, mcController.getNodeHealth);
router.get('/system/health', mcController.getSystemHealth);
router.get('/admin/system/health', verifyToken, adminOnly, mcController.getSystemHealth);
module.exports = router;

