require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const workerRoutes = require('./routes/worker');
const userRoutes = require('./routes/user');
const tenantRoutes = require('./routes/tenant');
const publicRoutes = require('./routes/public');

const fs = require('fs');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.set('trust proxy', 1);

app.use('/uploads', express.static(UPLOAD_DIR));

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Rate limiting (skipped in test environment)
if (process.env.NODE_ENV !== 'test') {
  const rateLimit = require('express-rate-limit');
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: { success: false, message: 'יותר מדי ניסיונות, נסה שוב מאוחר יותר' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: { success: false, message: 'יותר מדי בקשות, נסה שוב מאוחר יותר' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
  app.use('/api/auth/forgot-password', authLimiter);
  app.use('/api/auth/reset-password', authLimiter);
  app.use('/api', apiLimiter);
}

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/worker', workerRoutes);
app.use('/api', userRoutes);
app.use('/api/public', publicRoutes);
app.use('/api', tenantRoutes);
// ─── Demo seed (inline) ────────────────────────────────────────────────────────
{
  const bcrypt = require('bcryptjs');
  const { getDb } = require('./db/database');
  const SEED_KEY = process.env.SEED_KEY || 'seed-demo-2024';
  const WORKING_HOURS = JSON.stringify({ 0:null,1:{start:'09:00',end:'18:00'},2:{start:'09:00',end:'18:00'},3:{start:'09:00',end:'18:00'},4:{start:'09:00',end:'18:00'},5:{start:'09:00',end:'14:00'},6:null });

  app.get('/api/seed-demo', (req, res) => {
    if (req.query.key !== SEED_KEY) return res.status(403).json({ success: false, message: 'Invalid key' });
    const db = getDb();
    if (db.prepare("SELECT id FROM businesses WHERE slug='salon-anat'").get()) {
      return res.json({ success: false, message: 'Already seeded. Hit /api/reset-demo?key=seed-demo-2024 first.' });
    }
    const pw = bcrypt.hashSync('demo1234', 10);
    try {
      db.transaction(() => {
        const b1 = db.prepare(`INSERT INTO businesses (name,slug,address,phone,working_hours_json,onboarding_complete) VALUES ('סלון ענת','salon-anat','רחוב הרצל 12, תל אביב','050-1111111',?,1)`).run(WORKING_HOURS).lastInsertRowid;
        db.prepare(`INSERT INTO users (name,email,password_hash,role,business_id,is_worker,email_verified) VALUES ('ענת כהן','anat@demo.com',?,'admin',?,1,1)`).run(pw,b1);
        const w1=db.prepare(`INSERT INTO users (name,email,password_hash,role,business_id,email_verified) VALUES ('משה לוי','moshe@demo.com',?,'worker',?,1)`).run(pw,b1).lastInsertRowid;
        const w2=db.prepare(`INSERT INTO users (name,email,password_hash,role,business_id,email_verified) VALUES ('יעל ברק','yael@demo.com',?,'worker',?,1)`).run(pw,b1).lastInsertRowid;
        const s1a=db.prepare(`INSERT INTO services (business_id,name,duration_minutes,price) VALUES (?,'תספורת גברים',30,80)`).run(b1).lastInsertRowid;
        const s1b=db.prepare(`INSERT INTO services (business_id,name,duration_minutes,price) VALUES (?,'תספורת נשים',60,150)`).run(b1).lastInsertRowid;
        const s1c=db.prepare(`INSERT INTO services (business_id,name,duration_minutes,price) VALUES (?,'צביעת שיער',90,250)`).run(b1).lastInsertRowid;
        const s1d=db.prepare(`INSERT INTO services (business_id,name,duration_minutes,price) VALUES (?,'תסרוקת ערב',45,120)`).run(b1).lastInsertRowid;
        const c1a=db.prepare(`INSERT INTO users (name,email,password_hash,role,business_id,phone,email_verified) VALUES ('דנה אברהם','dana@demo.com',?,'user',?,'052-1111111',1)`).run(pw,b1).lastInsertRowid;
        const c1b=db.prepare(`INSERT INTO users (name,email,password_hash,role,business_id,phone,email_verified) VALUES ('רון שמש','ron@demo.com',?,'user',?,'054-2222222',1)`).run(pw,b1).lastInsertRowid;
        const c1c=db.prepare(`INSERT INTO users (name,email,password_hash,role,business_id,phone,email_verified) VALUES ('נועה גבאי','noa@demo.com',?,'user',?,'050-3333333',1)`).run(pw,b1).lastInsertRowid;
        const c1d=db.prepare(`INSERT INTO users (name,email,password_hash,role,business_id,phone,email_verified) VALUES ('אלי כץ','eli@demo.com',?,'user',?,'053-4444444',1)`).run(pw,b1).lastInsertRowid;
        const c1e=db.prepare(`INSERT INTO users (name,email,password_hash,role,business_id,phone,email_verified) VALUES ('מיכל דוד','michal@demo.com',?,'user',?,'058-5555555',1)`).run(pw,b1).lastInsertRowid;
        db.prepare(`INSERT INTO appointments (business_id,customer_id,worker_id,service_id,start_time,end_time,status) VALUES (?,?,?,?,'2026-04-06 09:00:00','2026-04-06 09:30:00','confirmed')`).run(b1,c1a,w1,s1a);
        db.prepare(`INSERT INTO appointments (business_id,customer_id,worker_id,service_id,start_time,end_time,status) VALUES (?,?,?,?,'2026-04-06 10:00:00','2026-04-06 11:00:00','confirmed')`).run(b1,c1b,w2,s1b);
        db.prepare(`INSERT INTO appointments (business_id,customer_id,worker_id,service_id,start_time,end_time,status) VALUES (?,?,?,?,'2026-04-07 09:00:00','2026-04-07 10:30:00','confirmed')`).run(b1,c1c,w1,s1c);
        db.prepare(`INSERT INTO appointments (business_id,customer_id,worker_id,service_id,start_time,end_time,status,notes) VALUES (?,?,?,?,'2026-04-08 11:00:00','2026-04-08 11:30:00','pending','להשאיר ארוך בצדדים')`).run(b1,c1d,w1,s1a);
        db.prepare(`INSERT INTO appointments (business_id,customer_id,worker_id,service_id,start_time,end_time,status) VALUES (?,?,?,?,'2026-04-13 14:00:00','2026-04-13 14:45:00','pending')`).run(b1,c1e,w2,s1d);
        db.prepare(`INSERT INTO appointments (business_id,customer_id,worker_id,service_id,start_time,end_time,status,suggested_time,reschedule_note) VALUES (?,?,?,?,'2026-04-14 10:00:00','2026-04-14 11:00:00','reschedule_requested','2026-04-15 10:00:00','יעל לא זמינה ב-14, מציעה להעביר ל-15')`).run(b1,c1a,w2,s1b);
        db.prepare(`INSERT INTO appointments (business_id,customer_id,worker_id,service_id,start_time,end_time,status) VALUES (?,?,?,?,'2026-01-05 09:00:00','2026-01-05 09:30:00','completed')`).run(b1,c1b,w1,s1a);
        db.prepare(`INSERT INTO appointments (business_id,customer_id,worker_id,service_id,start_time,end_time,status) VALUES (?,?,?,?,'2026-01-06 10:00:00','2026-01-06 11:00:00','completed')`).run(b1,c1c,w2,s1b);
        db.prepare(`INSERT INTO appointments (business_id,customer_id,worker_id,service_id,start_time,end_time,status) VALUES (?,?,?,?,'2026-02-02 09:00:00','2026-02-02 10:30:00','completed')`).run(b1,c1d,w1,s1c);
        db.prepare(`INSERT INTO appointments (business_id,customer_id,worker_id,service_id,start_time,end_time,status) VALUES (?,?,?,?,'2026-02-09 11:00:00','2026-02-09 11:30:00','cancelled')`).run(b1,c1e,w1,s1a);
        db.prepare(`INSERT INTO appointments (business_id,customer_id,worker_id,service_id,start_time,end_time,status) VALUES (?,?,?,?,'2026-03-02 13:00:00','2026-03-02 13:45:00','cancelled')`).run(b1,c1a,w2,s1d);
        db.prepare(`INSERT INTO waiting_list (business_id,customer_id,service_id,worker_id,slot_time,status) VALUES (?,?,?,?,'2026-04-06 12:00:00','waiting')`).run(b1,c1b,s1b,w2);

        const b2=db.prepare(`INSERT INTO businesses (name,slug,address,phone,working_hours_json,onboarding_complete) VALUES ('ברבר דני','barber-danny','שדרות בן גוריון 5, חיפה','052-9999999',?,1)`).run(WORKING_HOURS).lastInsertRowid;
        db.prepare(`INSERT INTO users (name,email,password_hash,role,business_id,is_worker,email_verified) VALUES ('דני מזרחי','danny@demo.com',?,'admin',?,1,1)`).run(pw,b2);
        const w3=db.prepare(`INSERT INTO users (name,email,password_hash,role,business_id,email_verified) VALUES ('קובי שלום','kobi@demo.com',?,'worker',?,1)`).run(pw,b2).lastInsertRowid;
        const w4=db.prepare(`INSERT INTO users (name,email,password_hash,role,business_id,email_verified) VALUES ('אורי פרץ','uri@demo.com',?,'worker',?,1)`).run(pw,b2).lastInsertRowid;
        const s2a=db.prepare(`INSERT INTO services (business_id,name,duration_minutes,price) VALUES (?,'תספורת',30,60)`).run(b2).lastInsertRowid;
        const s2b=db.prepare(`INSERT INTO services (business_id,name,duration_minutes,price) VALUES (?,'גילוח',20,40)`).run(b2).lastInsertRowid;
        const s2c=db.prepare(`INSERT INTO services (business_id,name,duration_minutes,price) VALUES (?,'תספורת + גילוח',50,90)`).run(b2).lastInsertRowid;
        const c2a=db.prepare(`INSERT INTO users (name,email,password_hash,role,business_id,email_verified) VALUES ('יוסי בן דוד','yossi@demo.com',?,'user',?,1)`).run(pw,b2).lastInsertRowid;
        const c2b=db.prepare(`INSERT INTO users (name,email,password_hash,role,business_id,email_verified) VALUES ('ג׳קי חיון','jacky@demo.com',?,'user',?,1)`).run(pw,b2).lastInsertRowid;
        const c2c=db.prepare(`INSERT INTO users (name,email,password_hash,role,business_id,email_verified) VALUES ('אבי גולן','avi@demo.com',?,'user',?,1)`).run(pw,b2).lastInsertRowid;
        db.prepare(`INSERT INTO appointments (business_id,customer_id,worker_id,service_id,start_time,end_time,status) VALUES (?,?,?,?,'2026-04-06 09:00:00','2026-04-06 09:30:00','confirmed')`).run(b2,c2a,w3,s2a);
        db.prepare(`INSERT INTO appointments (business_id,customer_id,worker_id,service_id,start_time,end_time,status) VALUES (?,?,?,?,'2026-04-06 10:00:00','2026-04-06 10:50:00','pending')`).run(b2,c2b,w4,s2c);
        db.prepare(`INSERT INTO appointments (business_id,customer_id,worker_id,service_id,start_time,end_time,status) VALUES (?,?,?,?,'2026-04-07 11:00:00','2026-04-07 11:20:00','pending')`).run(b2,c2c,w3,s2b);
        db.prepare(`INSERT INTO appointments (business_id,customer_id,worker_id,service_id,start_time,end_time,status) VALUES (?,?,?,?,'2026-01-05 09:00:00','2026-01-05 09:30:00','completed')`).run(b2,c2a,w3,s2a);
        db.prepare(`INSERT INTO appointments (business_id,customer_id,worker_id,service_id,start_time,end_time,status) VALUES (?,?,?,?,'2026-01-06 11:00:00','2026-01-06 11:20:00','completed')`).run(b2,c2b,w4,s2b);
        db.prepare(`INSERT INTO appointments (business_id,customer_id,worker_id,service_id,start_time,end_time,status) VALUES (?,?,?,?,'2026-02-02 09:00:00','2026-02-02 09:30:00','cancelled')`).run(b2,c2c,w3,s2a);
      })();
      res.json({ success:true, message:'✅ Demo data seeded!', note:'All passwords: demo1234', business1:{name:'סלון ענת',slug:'salon-anat',admin:'anat@demo.com',workers:['moshe@demo.com','yael@demo.com'],customers:['dana@demo.com','ron@demo.com','noa@demo.com','eli@demo.com','michal@demo.com']}, business2:{name:'ברבר דני',slug:'barber-danny',admin:'danny@demo.com',workers:['kobi@demo.com','uri@demo.com'],customers:['yossi@demo.com','jacky@demo.com','avi@demo.com']}, reset_url:'/api/reset-demo?key=seed-demo-2024' });
    } catch(err) { res.status(500).json({ success:false, message:err.message }); }
  });

  app.get('/api/reset-demo', (req, res) => {
    if (req.query.key !== SEED_KEY) return res.status(403).json({ success: false, message: 'Invalid key' });
    const db = getDb();
    const b1 = db.prepare("SELECT id FROM businesses WHERE slug='salon-anat'").get();
    const b2 = db.prepare("SELECT id FROM businesses WHERE slug='barber-danny'").get();
    if (!b1 && !b2) return res.json({ success:false, message:'No demo data found.' });
    db.transaction(() => {
      for (const biz of [b1,b2].filter(Boolean)) {
        const id = biz.id;
        db.prepare('DELETE FROM waiting_list WHERE business_id=?').run(id);
        db.prepare('DELETE FROM appointment_photos WHERE appointment_id IN (SELECT id FROM appointments WHERE business_id=?)').run(id);
        db.prepare('DELETE FROM appointments WHERE business_id=?').run(id);
        db.prepare('DELETE FROM worker_services WHERE worker_id IN (SELECT id FROM users WHERE business_id=?)').run(id);
        db.prepare('DELETE FROM services WHERE business_id=?').run(id);
        db.prepare('DELETE FROM users WHERE business_id=?').run(id);
        db.prepare('DELETE FROM businesses WHERE id=?').run(id);
      }
    })();
    res.json({ success:true, message:'🗑️ Demo data removed. Visit /api/seed-demo?key=seed-demo-2024 to reseed.' });
  });
}

// Serve React in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, message: 'שגיאת שרת פנימית' });
});

module.exports = app;
