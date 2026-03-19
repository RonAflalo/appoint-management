const express = require('express');
const router = express.Router();
const { register, login, logout, getMe, forgotPassword, resetPassword, verifyEmail, resendVerification, googleOAuth, googleOAuthCallback, googleCalendarOAuth, googleCalendarOAuthCallback } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', authenticate, getMe);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', authenticate, resendVerification);

router.get('/google', googleOAuth);
router.get('/google/callback', googleOAuthCallback);

router.get('/google/calendar', authenticate, googleCalendarOAuth);
router.get('/google/calendar/callback', googleCalendarOAuthCallback);

module.exports = router;
