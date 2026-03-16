const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'appointment-super-secret-key-change-in-production';
const COOKIE_OPTIONS = { httpOnly: true, secure: false, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 };

function createToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role, business_id: user.business_id },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

module.exports = { createToken, COOKIE_OPTIONS, JWT_SECRET };
