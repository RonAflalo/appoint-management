const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db/database');
const { sendPasswordResetEmail, sendVerificationEmail } = require('../services/emailService');

const JWT_SECRET = process.env.JWT_SECRET || 'appointment-super-secret-key-change-in-production';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      business_id: user.business_id,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

const register = (req, res) => {
  const { name, email, password, slug } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'יש למלא את כל השדות' });
  }
  if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'הסיסמה חייבת להכיל לפחות 6 תווים' });
  }

  const db = getDb();

  // Resolve business from slug
  let businessId = null;
  if (slug) {
    const business = db.prepare('SELECT id FROM businesses WHERE slug = ?').get(slug);
    if (!business) return res.status(404).json({ success: false, message: 'עסק לא נמצא' });
    businessId = business.id;
  }

  const existing = db.prepare('SELECT id, role FROM users WHERE email = ?').get(email);

  if (existing) {
    // Allow claiming a guest account (created automatically during a previous booking)
    if (existing.role !== 'user') {
      return res.status(409).json({ success: false, message: 'כתובת אימייל זו כבר רשומה במערכת' });
    }
    const passwordHash = bcrypt.hashSync(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    db.prepare(`
      UPDATE users SET name = ?, password_hash = ?, business_id = COALESCE(?, business_id),
        email_verified = 0, verification_token = ?
      WHERE id = ?
    `).run(name, passwordHash, businessId, verificationToken, existing.id);
    const user = db.prepare('SELECT id, name, email, role, business_id, email_verified FROM users WHERE id = ?').get(existing.id);
    const token = createToken(user);
    res.cookie('token', token, COOKIE_OPTIONS);

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    sendVerificationEmail({ email, name, verifyUrl: `${clientUrl}/verify-email/${verificationToken}` });

    return res.json({ success: true, message: 'נרשמת בהצלחה', user: { id: user.id, name: user.name, email: user.email, role: user.role, business_id: user.business_id, email_verified: user.email_verified } });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const result = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, business_id, email_verified, verification_token)
    VALUES (?, ?, ?, 'user', ?, 0, ?)
  `).run(name, email, passwordHash, businessId, verificationToken);

  const user = db.prepare('SELECT id, name, email, role, business_id, email_verified FROM users WHERE id = ?').get(result.lastInsertRowid);
  const token = createToken(user);

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  sendVerificationEmail({ email, name, verifyUrl: `${clientUrl}/verify-email/${verificationToken}` });

  res.cookie('token', token, COOKIE_OPTIONS);
  return res.status(201).json({
    success: true,
    message: 'נרשמת בהצלחה',
    user: { id: user.id, name: user.name, email: user.email, role: user.role, business_id: user.business_id, email_verified: user.email_verified },
  });
};

const login = (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'יש למלא אימייל וסיסמה' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    return res.status(401).json({ success: false, message: 'אימייל או סיסמה שגויים' });
  }

  if (!user.is_active) {
    return res.status(403).json({ success: false, message: 'החשבון אינו פעיל' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ success: false, message: 'אימייל או סיסמה שגויים' });
  }

  const token = createToken(user);
  res.cookie('token', token, COOKIE_OPTIONS);

  return res.json({
    success: true,
    message: 'התחברת בהצלחה',
    user: { id: user.id, name: user.name, email: user.email, role: user.role, business_id: user.business_id, email_verified: user.email_verified },
  });
};

const logout = (req, res) => {
  res.clearCookie('token');
  return res.json({ success: true, message: 'התנתקת בהצלחה' });
};

const getMe = (req, res) => {
  // Re-query DB to get fresh email_verified status
  const db = getDb();
  const user = db.prepare('SELECT id, name, email, role, business_id, email_verified FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ success: false, message: 'משתמש לא נמצא' });
  return res.json({ success: true, user });
};

const forgotPassword = (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'יש לציין אימייל' });

  const db = getDb();
  const user = db.prepare('SELECT id, name, email FROM users WHERE email = ?').get(email);

  // Always return success to avoid email enumeration
  if (!user) return res.json({ success: true, message: 'אם האימייל קיים במערכת, נשלח אליו קישור לאיפוס סיסמה' });

  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

  db.prepare('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?').run(token, expires, user.id);

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  sendPasswordResetEmail({ email: user.email, name: user.name, resetUrl: `${clientUrl}/reset-password/${token}` });

  return res.json({ success: true, message: 'אם האימייל קיים במערכת, נשלח אליו קישור לאיפוס סיסמה' });
};

const resetPassword = (req, res) => {
  const { token } = req.params;
  const { password } = req.body;
  if (!password || password.length < 6) {
    return res.status(400).json({ success: false, message: 'הסיסמה חייבת להכיל לפחות 6 תווים' });
  }

  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE reset_token = ? AND reset_token_expires > ?').get(token, new Date().toISOString());
  if (!user) return res.status(400).json({ success: false, message: 'הקישור לא תקף או פג תוקפו' });

  const passwordHash = bcrypt.hashSync(password, 10);
  db.prepare('UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?').run(passwordHash, user.id);

  return res.json({ success: true, message: 'הסיסמה אופסה בהצלחה' });
};

const verifyEmail = (req, res) => {
  const { token } = req.params;
  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE verification_token = ?').get(token);
  if (!user) return res.status(400).json({ success: false, message: 'קישור לא תקף' });

  db.prepare('UPDATE users SET email_verified = 1, verification_token = NULL WHERE id = ?').run(user.id);
  return res.json({ success: true, message: 'האימייל אומת בהצלחה' });
};

const resendVerification = (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, name, email, email_verified FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ success: false, message: 'משתמש לא נמצא' });
  if (user.email_verified) return res.status(400).json({ success: false, message: 'האימייל כבר מאומת' });

  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('UPDATE users SET verification_token = ? WHERE id = ?').run(token, user.id);

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  sendVerificationEmail({ email: user.email, name: user.name, verifyUrl: `${clientUrl}/verify-email/${token}` });

  return res.json({ success: true, message: 'אימייל אימות נשלח מחדש' });
};

module.exports = { register, login, logout, getMe, forgotPassword, resetPassword, verifyEmail, resendVerification };
