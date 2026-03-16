const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db/database');

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
    db.prepare(`
      UPDATE users SET name = ?, password_hash = ?, business_id = COALESCE(?, business_id) WHERE id = ?
    `).run(name, passwordHash, businessId, existing.id);
    const user = db.prepare('SELECT id, name, email, role, business_id FROM users WHERE id = ?').get(existing.id);
    const token = createToken(user);
    res.cookie('token', token, COOKIE_OPTIONS);
    return res.json({ success: true, message: 'נרשמת בהצלחה', user: { id: user.id, name: user.name, email: user.email, role: user.role, business_id: user.business_id } });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, business_id)
    VALUES (?, ?, ?, 'user', ?)
  `).run(name, email, passwordHash, businessId);

  const user = db.prepare('SELECT id, name, email, role, business_id FROM users WHERE id = ?').get(result.lastInsertRowid);
  const token = createToken(user);

  res.cookie('token', token, COOKIE_OPTIONS);
  return res.status(201).json({
    success: true,
    message: 'נרשמת בהצלחה',
    user: { id: user.id, name: user.name, email: user.email, role: user.role, business_id: user.business_id },
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
    user: { id: user.id, name: user.name, email: user.email, role: user.role, business_id: user.business_id },
  });
};

const logout = (req, res) => {
  res.clearCookie('token');
  return res.json({ success: true, message: 'התנתקת בהצלחה' });
};

const getMe = (req, res) => {
  return res.json({ success: true, user: req.user });
};

module.exports = { register, login, logout, getMe };
