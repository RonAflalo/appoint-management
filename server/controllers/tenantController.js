const bcrypt = require('bcryptjs');
const { getDb } = require('../db/database');
const { createToken, COOKIE_OPTIONS } = require('../utils/jwt');

const DEFAULT_WORKING_HOURS = JSON.stringify({
  "0": null,
  "1": { "start": "09:00", "end": "18:00" },
  "2": { "start": "09:00", "end": "18:00" },
  "3": { "start": "09:00", "end": "18:00" },
  "4": { "start": "09:00", "end": "18:00" },
  "5": { "start": "09:00", "end": "14:00" },
  "6": null
});

const SERVICES_BY_TYPE = {
  barber: [
    { name: 'תספורת', duration: 30, price: 50 },
    { name: 'גילוח', duration: 20, price: 30 },
    { name: 'עיצוב זקן', duration: 25, price: 40 },
  ],
  clinic: [
    { name: 'ייעוץ ראשוני', duration: 60, price: 200 },
    { name: 'ביקורת שגרתית', duration: 30, price: 120 },
    { name: 'טיפול', duration: 45, price: 150 },
  ],
  tutor: [
    { name: 'שיעור פרטי', duration: 60, price: 150 },
    { name: 'שיעור קבוצתי', duration: 90, price: 80 },
    { name: 'הכנה לבחינה', duration: 120, price: 200 },
  ],
  default: [
    { name: 'שירות בסיסי', duration: 30, price: 100 },
    { name: 'שירות מורחב', duration: 60, price: 180 },
    { name: 'ייעוץ', duration: 45, price: 150 },
  ],
};

const checkSlug = (req, res) => {
  const { slug } = req.query;
  if (!slug) return res.status(400).json({ available: false, message: 'חסר slug' });
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) || slug.length < 3) {
    return res.json({ available: false, message: 'הכתובת אינה תקינה — רק אותיות אנגליות קטנות, מספרים ומקפים (לפחות 3 תווים)' });
  }
  const db = getDb();
  const existing = db.prepare('SELECT id FROM businesses WHERE slug = ?').get(slug);
  return res.json({ available: !existing, message: existing ? 'כתובת זו תפוסה' : 'הכתובת פנויה!' });
};

const registerBusiness = (req, res) => {
  const { businessName, businessType, ownerName, email, password, slug } = req.body;

  if (!businessName || !businessType || !ownerName || !email || !password || !slug) {
    return res.status(400).json({ success: false, message: 'יש למלא את כל השדות' });
  }

  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) || slug.length < 3) {
    return res.status(400).json({ success: false, message: 'הכתובת אינה תקינה — רק אותיות אנגליות קטנות, מספרים ומקפים (לפחות 3 תווים)' });
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'הסיסמה חייבת להכיל לפחות 6 תווים' });
  }

  const db = getDb();

  const existingSlug = db.prepare('SELECT id FROM businesses WHERE slug = ?').get(slug);
  if (existingSlug) {
    return res.status(409).json({ success: false, message: 'כתובת זו כבר תפוסה' });
  }

  const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existingEmail) {
    return res.status(409).json({ success: false, message: 'כתובת אימייל זו כבר רשומה במערכת' });
  }

  const services = SERVICES_BY_TYPE[businessType] || SERVICES_BY_TYPE.default;

  const transaction = db.transaction(() => {
    const businessResult = db.prepare(`
      INSERT INTO businesses (name, slug, working_hours_json, onboarding_complete)
      VALUES (?, ?, ?, 0)
    `).run(businessName, slug, DEFAULT_WORKING_HOURS);
    const businessId = businessResult.lastInsertRowid;

    const passwordHash = bcrypt.hashSync(password, 10);
    const userResult = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, business_id, is_worker)
      VALUES (?, ?, ?, 'admin', ?, 1)
    `).run(ownerName, email, passwordHash, businessId);
    const userId = userResult.lastInsertRowid;

    for (const svc of services) {
      db.prepare(`
        INSERT INTO services (business_id, name, duration_minutes, price)
        VALUES (?, ?, ?, ?)
      `).run(businessId, svc.name, svc.duration, svc.price);
    }

    return { businessId, userId };
  });

  const { businessId, userId } = transaction();

  const user = db.prepare('SELECT id, name, email, role, business_id FROM users WHERE id = ?').get(userId);
  const token = createToken(user);
  res.cookie('token', token, COOKIE_OPTIONS);

  return res.status(201).json({
    success: true,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, business_id: user.business_id },
    slug,
    businessId,
  });
};

module.exports = { checkSlug, registerBusiness };
