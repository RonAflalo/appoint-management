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
  const { name, email, password, slug, phone } = req.body;
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
        email_verified = 0, verification_token = ?, phone = COALESCE(?, phone)
      WHERE id = ?
    `).run(name, passwordHash, businessId, verificationToken, phone || null, existing.id);
    const user = db.prepare('SELECT id, name, email, role, business_id, email_verified FROM users WHERE id = ?').get(existing.id);
    const token = createToken(user);
    res.cookie('token', token, COOKIE_OPTIONS);

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    sendVerificationEmail({ email, name, verifyUrl: `${clientUrl}/verify-email/${verificationToken}` });

    let business = null;
    if (user.business_id) {
      business = db.prepare(
        'SELECT name, slug, phone, logo_url, cover_url, description, instagram_url, facebook_url, address FROM businesses WHERE id = ?'
      ).get(user.business_id);
    }

    return res.json({ success: true, message: 'נרשמת בהצלחה', user: { id: user.id, name: user.name, email: user.email, role: user.role, business_id: user.business_id, email_verified: user.email_verified, business } });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const result = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, business_id, email_verified, verification_token, phone)
    VALUES (?, ?, ?, 'user', ?, 0, ?, ?)
  `).run(name, email, passwordHash, businessId, verificationToken, phone || null);

  const user = db.prepare('SELECT id, name, email, role, business_id, email_verified FROM users WHERE id = ?').get(result.lastInsertRowid);
  const token = createToken(user);

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  sendVerificationEmail({ email, name, verifyUrl: `${clientUrl}/verify-email/${verificationToken}` });

  let business = null;
  if (user.business_id) {
    business = db.prepare(
      'SELECT name, slug, phone, logo_url, cover_url, description, instagram_url, facebook_url, address FROM businesses WHERE id = ?'
    ).get(user.business_id);
  }

  res.cookie('token', token, COOKIE_OPTIONS);
  return res.status(201).json({
    success: true,
    message: 'נרשמת בהצלחה',
    user: { id: user.id, name: user.name, email: user.email, role: user.role, business_id: user.business_id, email_verified: user.email_verified, business },
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

  let business = null;
  if (user.business_id) {
    business = db.prepare(
      'SELECT name, slug, phone, logo_url, cover_url, description, instagram_url, facebook_url, address FROM businesses WHERE id = ?'
    ).get(user.business_id);
  }

  return res.json({
    success: true,
    message: 'התחברת בהצלחה',
    user: { id: user.id, name: user.name, email: user.email, role: user.role, business_id: user.business_id, email_verified: user.email_verified, business },
  });
};

const logout = (req, res) => {
  res.clearCookie('token');
  return res.json({ success: true, message: 'התנתקת בהצלחה' });
};

const getMe = (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, name, email, role, business_id, email_verified, phone FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ success: false, message: 'משתמש לא נמצא' });

  let business = null;
  if (user.business_id) {
    business = db.prepare(
      'SELECT name, slug, phone, logo_url, cover_url, description, instagram_url, facebook_url, address FROM businesses WHERE id = ?'
    ).get(user.business_id);
  }

  return res.json({ success: true, user: { ...user, business } });
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

// ---- Google OAuth ----

const oauthStates = new Map(); // state -> { ts, slug, redirect }

function cleanOldStates() {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [k, v] of oauthStates) {
    if (v.ts < cutoff) oauthStates.delete(k);
  }
}

const googleOAuth = (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(501).json({ success: false, message: 'Google OAuth not configured' });
  }
  cleanOldStates();
  const { slug, redirect } = req.query;
  const state = crypto.randomBytes(16).toString('hex');
  oauthStates.set(state, { ts: Date.now(), slug: slug || null, redirect: redirect || null });

  const redirectUri = process.env.GOOGLE_REDIRECT_URI ||
    `${process.env.CLIENT_URL || 'http://localhost:3001'}/api/auth/google/callback`;

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'email profile',
    state,
    access_type: 'online',
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
};

const googleOAuthCallback = async (req, res) => {
  const { code, state, error } = req.query;
  const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

  if (error || !code) {
    return res.redirect(`${CLIENT_URL}/login?error=google_cancelled`);
  }

  const stateData = oauthStates.get(state);
  if (!stateData) {
    return res.redirect(`${CLIENT_URL}/login?error=invalid_state`);
  }
  oauthStates.delete(state);

  const redirectUri = process.env.GOOGLE_REDIRECT_URI ||
    `${process.env.CLIENT_URL || 'http://localhost:3001'}/api/auth/google/callback`;

  try {
    // Exchange code for access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error('Google token exchange failed:', tokenData);
      return res.redirect(`${CLIENT_URL}/login?error=google_failed`);
    }

    // Get user info from Google
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const googleUser = await userRes.json();

    if (!googleUser.email) {
      return res.redirect(`${CLIENT_URL}/login?error=google_no_email`);
    }

    const db = getDb();
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(googleUser.email);

    if (!user) {
      // New user — create account (email already verified via Google)
      const dummyHash = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 4);
      let businessId = null;
      if (stateData.slug) {
        const biz = db.prepare('SELECT id FROM businesses WHERE slug = ?').get(stateData.slug);
        if (biz) businessId = biz.id;
      }
      const result = db.prepare(`
        INSERT INTO users (name, email, password_hash, role, business_id, email_verified)
        VALUES (?, ?, ?, 'user', ?, 1)
      `).run(googleUser.name || googleUser.email.split('@')[0], googleUser.email, dummyHash, businessId);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    } else {
      // Existing user — update if needed
      const updates = {};
      if (!user.email_verified) updates.email_verified = 1;
      if (stateData.slug && !user.business_id) {
        const biz = db.prepare('SELECT id FROM businesses WHERE slug = ?').get(stateData.slug);
        if (biz) updates.business_id = biz.id;
      }
      if (Object.keys(updates).length > 0) {
        const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
        db.prepare(`UPDATE users SET ${setClauses} WHERE id = ?`).run(...Object.values(updates), user.id);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
      }
    }

    if (!user.is_active) {
      return res.redirect(`${CLIENT_URL}/login?error=account_disabled`);
    }

    const token = createToken(user);
    res.cookie('token', token, COOKIE_OPTIONS);

    let redirectPath;
    if (stateData.redirect) {
      redirectPath = stateData.redirect;
    } else if (stateData.slug) {
      redirectPath = `/book/${stateData.slug}`;
    } else if (user.role === 'admin') {
      redirectPath = '/admin';
    } else if (user.role === 'worker') {
      redirectPath = '/worker';
    } else {
      redirectPath = '/customer';
    }

    res.redirect(`${CLIENT_URL}${redirectPath}`);
  } catch (err) {
    console.error('Google OAuth error:', err);
    res.redirect(`${CLIENT_URL}/login?error=google_failed`);
  }
};

module.exports = { register, login, logout, getMe, forgotPassword, resetPassword, verifyEmail, resendVerification, googleOAuth, googleOAuthCallback };
