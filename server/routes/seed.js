/**
 * Demo seed endpoint — populates the database with two businesses,
 * workers, customers, and appointments in various statuses for manual QA.
 *
 * GET /api/seed-demo?key=seed-demo-2024   → seed
 * GET /api/reset-demo?key=seed-demo-2024  → wipe demo data
 */
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDb } = require('../db/database');

const SEED_KEY = process.env.SEED_KEY || 'seed-demo-2024';

const WORKING_HOURS = JSON.stringify({
  0: null,
  1: { start: '09:00', end: '18:00' },
  2: { start: '09:00', end: '18:00' },
  3: { start: '09:00', end: '18:00' },
  4: { start: '09:00', end: '18:00' },
  5: { start: '09:00', end: '14:00' },
  6: null,
});

// ─── Seed ──────────────────────────────────────────────────────────────────────

router.get('/seed-demo', (req, res) => {
  if (req.query.key !== SEED_KEY) {
    return res.status(403).json({ success: false, message: 'Invalid key' });
  }

  const db = getDb();

  const already = db.prepare("SELECT id FROM businesses WHERE slug = 'salon-anat'").get();
  if (already) {
    return res.json({
      success: false,
      message: 'Already seeded. Visit /api/reset-demo?key=seed-demo-2024 first if you want to reseed.',
    });
  }

  const pw = bcrypt.hashSync('demo1234', 10);

  const run = db.transaction(() => {
    // ── Business 1: סלון ענת ───────────────────────────────────────────
    const b1 = db.prepare(`
      INSERT INTO businesses (name, slug, address, phone, working_hours_json, onboarding_complete)
      VALUES ('סלון ענת', 'salon-anat', 'רחוב הרצל 12, תל אביב', '050-1111111', ?, 1)
    `).run(WORKING_HOURS).lastInsertRowid;

    const a1 = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, business_id, is_worker, email_verified)
      VALUES ('ענת כהן', 'anat@demo.com', ?, 'admin', ?, 1, 1)
    `).run(pw, b1).lastInsertRowid;

    const w1 = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, business_id, email_verified)
      VALUES ('משה לוי', 'moshe@demo.com', ?, 'worker', ?, 1)
    `).run(pw, b1).lastInsertRowid;

    const w2 = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, business_id, email_verified)
      VALUES ('יעל ברק', 'yael@demo.com', ?, 'worker', ?, 1)
    `).run(pw, b1).lastInsertRowid;

    const s1a = db.prepare(`INSERT INTO services (business_id, name, duration_minutes, price) VALUES (?, 'תספורת גברים', 30, 80)`).run(b1).lastInsertRowid;
    const s1b = db.prepare(`INSERT INTO services (business_id, name, duration_minutes, price) VALUES (?, 'תספורת נשים', 60, 150)`).run(b1).lastInsertRowid;
    const s1c = db.prepare(`INSERT INTO services (business_id, name, duration_minutes, price) VALUES (?, 'צביעת שיער', 90, 250)`).run(b1).lastInsertRowid;
    const s1d = db.prepare(`INSERT INTO services (business_id, name, duration_minutes, price) VALUES (?, 'תסרוקת ערב', 45, 120)`).run(b1).lastInsertRowid;

    const c1a = db.prepare(`INSERT INTO users (name, email, password_hash, role, business_id, phone, email_verified) VALUES ('דנה אברהם', 'dana@demo.com', ?, 'user', ?, '052-1111111', 1)`).run(pw, b1).lastInsertRowid;
    const c1b = db.prepare(`INSERT INTO users (name, email, password_hash, role, business_id, phone, email_verified) VALUES ('רון שמש', 'ron@demo.com', ?, 'user', ?, '054-2222222', 1)`).run(pw, b1).lastInsertRowid;
    const c1c = db.prepare(`INSERT INTO users (name, email, password_hash, role, business_id, phone, email_verified) VALUES ('נועה גבאי', 'noa@demo.com', ?, 'user', ?, '050-3333333', 1)`).run(pw, b1).lastInsertRowid;
    const c1d = db.prepare(`INSERT INTO users (name, email, password_hash, role, business_id, phone, email_verified) VALUES ('אלי כץ', 'eli@demo.com', ?, 'user', ?, '053-4444444', 1)`).run(pw, b1).lastInsertRowid;
    const c1e = db.prepare(`INSERT INTO users (name, email, password_hash, role, business_id, phone, email_verified) VALUES ('מיכל דוד', 'michal@demo.com', ?, 'user', ?, '058-5555555', 1)`).run(pw, b1).lastInsertRowid;

    // Future – confirmed (Mon 06-Apr, Tue 07-Apr)
    db.prepare(`INSERT INTO appointments (business_id, customer_id, worker_id, service_id, start_time, end_time, status) VALUES (?,?,?,?,'2026-04-06 09:00:00','2026-04-06 09:30:00','confirmed')`).run(b1, c1a, w1, s1a);
    db.prepare(`INSERT INTO appointments (business_id, customer_id, worker_id, service_id, start_time, end_time, status) VALUES (?,?,?,?,'2026-04-06 10:00:00','2026-04-06 11:00:00','confirmed')`).run(b1, c1b, w2, s1b);
    db.prepare(`INSERT INTO appointments (business_id, customer_id, worker_id, service_id, start_time, end_time, status) VALUES (?,?,?,?,'2026-04-07 09:00:00','2026-04-07 10:30:00','confirmed')`).run(b1, c1c, w1, s1c);

    // Future – pending (Wed 08-Apr, Mon 13-Apr)
    db.prepare(`INSERT INTO appointments (business_id, customer_id, worker_id, service_id, start_time, end_time, status, notes) VALUES (?,?,?,?,'2026-04-08 11:00:00','2026-04-08 11:30:00','pending','להשאיר ארוך בצדדים')`).run(b1, c1d, w1, s1a);
    db.prepare(`INSERT INTO appointments (business_id, customer_id, worker_id, service_id, start_time, end_time, status) VALUES (?,?,?,?,'2026-04-13 14:00:00','2026-04-13 14:45:00','pending')`).run(b1, c1e, w2, s1d);

    // Future – reschedule_requested (Tue 14-Apr, suggested Wed 15-Apr)
    db.prepare(`
      INSERT INTO appointments (business_id, customer_id, worker_id, service_id, start_time, end_time, status, suggested_time, reschedule_note)
      VALUES (?,?,?,?,'2026-04-14 10:00:00','2026-04-14 11:00:00','reschedule_requested','2026-04-15 10:00:00','יעל לא זמינה ב-14, מציעה להעביר ל-15')
    `).run(b1, c1a, w2, s1b);

    // Past – completed (Mon 05-Jan, Tue 06-Jan, Mon 02-Feb)
    db.prepare(`INSERT INTO appointments (business_id, customer_id, worker_id, service_id, start_time, end_time, status) VALUES (?,?,?,?,'2026-01-05 09:00:00','2026-01-05 09:30:00','completed')`).run(b1, c1b, w1, s1a);
    db.prepare(`INSERT INTO appointments (business_id, customer_id, worker_id, service_id, start_time, end_time, status) VALUES (?,?,?,?,'2026-01-06 10:00:00','2026-01-06 11:00:00','completed')`).run(b1, c1c, w2, s1b);
    db.prepare(`INSERT INTO appointments (business_id, customer_id, worker_id, service_id, start_time, end_time, status) VALUES (?,?,?,?,'2026-02-02 09:00:00','2026-02-02 10:30:00','completed')`).run(b1, c1d, w1, s1c);

    // Past – cancelled (Mon 09-Feb, Mon 02-Mar)
    db.prepare(`INSERT INTO appointments (business_id, customer_id, worker_id, service_id, start_time, end_time, status) VALUES (?,?,?,?,'2026-02-09 11:00:00','2026-02-09 11:30:00','cancelled')`).run(b1, c1e, w1, s1a);
    db.prepare(`INSERT INTO appointments (business_id, customer_id, worker_id, service_id, start_time, end_time, status) VALUES (?,?,?,?,'2026-03-02 13:00:00','2026-03-02 13:45:00','cancelled')`).run(b1, c1a, w2, s1d);

    // Waitlist entry
    db.prepare(`INSERT INTO waiting_list (business_id, customer_id, service_id, worker_id, slot_time, status) VALUES (?,?,?,?,'2026-04-06 12:00:00','waiting')`).run(b1, c1b, s1b, w2);

    // ── Business 2: ברבר דני ───────────────────────────────────────────
    const b2 = db.prepare(`
      INSERT INTO businesses (name, slug, address, phone, working_hours_json, onboarding_complete)
      VALUES ('ברבר דני', 'barber-danny', 'שדרות בן גוריון 5, חיפה', '052-9999999', ?, 1)
    `).run(WORKING_HOURS).lastInsertRowid;

    const a2 = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, business_id, is_worker, email_verified)
      VALUES ('דני מזרחי', 'danny@demo.com', ?, 'admin', ?, 1, 1)
    `).run(pw, b2).lastInsertRowid;

    const w3 = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, business_id, email_verified)
      VALUES ('קובי שלום', 'kobi@demo.com', ?, 'worker', ?, 1)
    `).run(pw, b2).lastInsertRowid;

    const w4 = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, business_id, email_verified)
      VALUES ('אורי פרץ', 'uri@demo.com', ?, 'worker', ?, 1)
    `).run(pw, b2).lastInsertRowid;

    const s2a = db.prepare(`INSERT INTO services (business_id, name, duration_minutes, price) VALUES (?, 'תספורת', 30, 60)`).run(b2).lastInsertRowid;
    const s2b = db.prepare(`INSERT INTO services (business_id, name, duration_minutes, price) VALUES (?, 'גילוח', 20, 40)`).run(b2).lastInsertRowid;
    const s2c = db.prepare(`INSERT INTO services (business_id, name, duration_minutes, price) VALUES (?, 'תספורת + גילוח', 50, 90)`).run(b2).lastInsertRowid;

    const c2a = db.prepare(`INSERT INTO users (name, email, password_hash, role, business_id, email_verified) VALUES ('יוסי בן דוד', 'yossi@demo.com', ?, 'user', ?, 1)`).run(pw, b2).lastInsertRowid;
    const c2b = db.prepare(`INSERT INTO users (name, email, password_hash, role, business_id, email_verified) VALUES ('ג׳קי חיון', 'jacky@demo.com', ?, 'user', ?, 1)`).run(pw, b2).lastInsertRowid;
    const c2c = db.prepare(`INSERT INTO users (name, email, password_hash, role, business_id, email_verified) VALUES ('אבי גולן', 'avi@demo.com', ?, 'user', ?, 1)`).run(pw, b2).lastInsertRowid;

    // Future – confirmed + pending
    db.prepare(`INSERT INTO appointments (business_id, customer_id, worker_id, service_id, start_time, end_time, status) VALUES (?,?,?,?,'2026-04-06 09:00:00','2026-04-06 09:30:00','confirmed')`).run(b2, c2a, w3, s2a);
    db.prepare(`INSERT INTO appointments (business_id, customer_id, worker_id, service_id, start_time, end_time, status) VALUES (?,?,?,?,'2026-04-06 10:00:00','2026-04-06 10:50:00','pending')`).run(b2, c2b, w4, s2c);
    db.prepare(`INSERT INTO appointments (business_id, customer_id, worker_id, service_id, start_time, end_time, status) VALUES (?,?,?,?,'2026-04-07 11:00:00','2026-04-07 11:20:00','pending')`).run(b2, c2c, w3, s2b);

    // Past – completed + cancelled
    db.prepare(`INSERT INTO appointments (business_id, customer_id, worker_id, service_id, start_time, end_time, status) VALUES (?,?,?,?,'2026-01-05 09:00:00','2026-01-05 09:30:00','completed')`).run(b2, c2a, w3, s2a);
    db.prepare(`INSERT INTO appointments (business_id, customer_id, worker_id, service_id, start_time, end_time, status) VALUES (?,?,?,?,'2026-01-06 11:00:00','2026-01-06 11:20:00','completed')`).run(b2, c2b, w4, s2b);
    db.prepare(`INSERT INTO appointments (business_id, customer_id, worker_id, service_id, start_time, end_time, status) VALUES (?,?,?,?,'2026-02-02 09:00:00','2026-02-02 09:30:00','cancelled')`).run(b2, c2c, w3, s2a);
  });

  try {
    run();
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }

  res.json({
    success: true,
    message: '✅ Demo data seeded!',
    note: 'All passwords: demo1234',
    business1: {
      name: 'סלון ענת',
      slug: 'salon-anat',
      admin: 'anat@demo.com',
      workers: ['moshe@demo.com (משה)', 'yael@demo.com (יעל)'],
      customers: ['dana@demo.com', 'ron@demo.com', 'noa@demo.com', 'eli@demo.com', 'michal@demo.com'],
      appointments: '3 confirmed, 2 pending, 1 reschedule_requested, 3 completed, 2 cancelled, 1 waitlist',
    },
    business2: {
      name: 'ברבר דני',
      slug: 'barber-danny',
      admin: 'danny@demo.com',
      workers: ['kobi@demo.com (קובי)', 'uri@demo.com (אורי)'],
      customers: ['yossi@demo.com', 'jacky@demo.com', 'avi@demo.com'],
      appointments: '1 confirmed, 2 pending, 2 completed, 1 cancelled',
    },
    reset_url: '/api/reset-demo?key=seed-demo-2024',
  });
});

// ─── Reset ─────────────────────────────────────────────────────────────────────

router.get('/reset-demo', (req, res) => {
  if (req.query.key !== SEED_KEY) {
    return res.status(403).json({ success: false, message: 'Invalid key' });
  }

  const db = getDb();
  const b1 = db.prepare("SELECT id FROM businesses WHERE slug = 'salon-anat'").get();
  const b2 = db.prepare("SELECT id FROM businesses WHERE slug = 'barber-danny'").get();

  if (!b1 && !b2) {
    return res.json({ success: false, message: 'No demo data found.' });
  }

  db.transaction(() => {
    for (const biz of [b1, b2].filter(Boolean)) {
      const id = biz.id;
      db.prepare('DELETE FROM waiting_list WHERE business_id = ?').run(id);
      db.prepare('DELETE FROM appointment_photos WHERE appointment_id IN (SELECT id FROM appointments WHERE business_id = ?)').run(id);
      db.prepare('DELETE FROM appointments WHERE business_id = ?').run(id);
      db.prepare('DELETE FROM worker_services WHERE worker_id IN (SELECT id FROM users WHERE business_id = ?)').run(id);
      db.prepare('DELETE FROM services WHERE business_id = ?').run(id);
      db.prepare('DELETE FROM users WHERE business_id = ?').run(id);
      db.prepare('DELETE FROM businesses WHERE id = ?').run(id);
    }
  })();

  res.json({ success: true, message: '🗑️ Demo data removed. Visit /api/seed-demo?key=seed-demo-2024 to reseed.' });
});

module.exports = router;
