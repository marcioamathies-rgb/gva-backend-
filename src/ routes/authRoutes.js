const express = require('express');
const rateLimit = require('express-rate-limit');
const auth = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: (parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MIN || '15', 10)) * 60 * 1000,
  max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX || '10', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});

router.get('/setup/status', auth.getSetupStatus);
router.post('/setup', auth.runSetup);

router.post('/register', auth.register);
router.post('/login', loginLimiter, auth.login);

router.get('/me', authenticate, auth.me);
router.post('/change-password', authenticate, auth.changePassword);

module.exports = router;

router.post('/admin-lockout-alert', auth.adminLockoutAlert);
