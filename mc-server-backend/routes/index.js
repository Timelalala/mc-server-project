const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { verifyToken, adminOnly } = require('../middleware/auth');
const authController = require('../controllers/authController');
const serverController = require('../controllers/serverController');
const bookingController = require('../controllers/bookingController');
const adminController = require('../controllers/adminController');

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

// --- Server & Time Slot Routes (User and Admin accessible) ---
router.get('/servers', serverController.getServers);
router.get('/servers/:id/slots', serverController.getSlots);

// --- Booking Routes (User authenticated) ---
router.post('/bookings', verifyToken, upload.single('slip_file'), bookingController.createBooking);
router.get('/bookings/my', verifyToken, bookingController.getMyBookings);

// --- Admin Control Panel Routes (Admin authenticated only) ---
router.get('/admin/stats', verifyToken, adminOnly, adminController.getStats);
router.get('/admin/users', verifyToken, adminOnly, adminController.getUsers);
router.delete('/admin/users/:id', verifyToken, adminOnly, adminController.deleteUser);
router.get('/admin/servers', verifyToken, adminOnly, serverController.getServers);

// SSH commands to systemctl
router.post('/admin/servers/:id/start', verifyToken, adminOnly, serverController.startServer);
router.post('/admin/servers/:id/stop', verifyToken, adminOnly, serverController.stopServer);
router.post('/admin/servers/:id/restart', verifyToken, adminOnly, serverController.restartServer);

// Bookings lists and payment approvals
router.get('/admin/bookings', verifyToken, adminOnly, adminController.getAllBookings);
router.get('/admin/payments', verifyToken, adminOnly, adminController.getPayments);
router.patch('/admin/payments/:id', verifyToken, adminOnly, adminController.verifyPayment);

// Time slot CRUD (Admin only)
router.post('/admin/slots', verifyToken, adminOnly, adminController.addSlot);
router.delete('/admin/slots/:id', verifyToken, adminOnly, adminController.deleteSlot);

module.exports = router;
