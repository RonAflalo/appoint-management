/**
 * Seed script for local testing.
 * Run: node seed.js
 */
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'db', 'appointments.db');
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

const hash = (pw) => bcrypt.hashSync(pw, 10);

// ── Business ──────────────────────────────────────────────────────────────────
const existingBusiness = db.prepare('SELECT id FROM businesses WHERE slug = ?').get('demo-salon');
let businessId;

if (existingBusiness) {
  businessId = existingBusiness.id;
  console.log('Business already exists, skipping creation.');
} else {
  const biz = db.prepare(`
    INSERT INTO businesses (name, address, slug, description, onboarding_complete,
      working_hours_json, phone)
    VALUES (?, ?, ?, ?, 1, ?, ?)
  `).run(
    'סלון דמו',
    'רחוב הדמו 1, תל אביב',
    'demo-salon',
    'סלון לדוגמה לצורך בדיקות',
    JSON.stringify({
      "0": null,
      "1": { "start": "09:00", "end": "19:00" },
      "2": { "start": "09:00", "end": "19:00" },
      "3": { "start": "09:00", "end": "19:00" },
      "4": { "start": "09:00", "end": "19:00" },
      "5": { "start": "09:00", "end": "14:00" },
      "6": null
    }),
    '050-1234567'
  );
  businessId = biz.lastInsertRowid;
  console.log(`Created business: סלון דמו (id=${businessId})`);
}

// ── Helper: upsert user ───────────────────────────────────────────────────────
function upsertUser({ name, email, password, role, is_worker, phone }) {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    console.log(`  User already exists: ${email}`);
    return existing.id;
  }
  const res = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, business_id, is_active, is_worker, email_verified, phone)
    VALUES (?, ?, ?, ?, ?, 1, ?, 1, ?)
  `).run(name, email, hash(password), role, businessId, is_worker ? 1 : 0, phone || null);
  console.log(`  Created ${role}: ${name} <${email}>`);
  return res.lastInsertRowid;
}

// ── Admin ─────────────────────────────────────────────────────────────────────
console.log('\nUsers:');
const adminId = upsertUser({
  name: 'רונן מנהל',
  email: 'admin@demo.com',
  password: 'password123',
  role: 'admin',
  is_worker: 1,
  phone: '050-0000001',
});

// ── Workers ───────────────────────────────────────────────────────────────────
const worker1Id = upsertUser({
  name: 'מיכל כהן',
  email: 'michal@demo.com',
  password: 'password123',
  role: 'worker',
  is_worker: 1,
  phone: '050-1111111',
});

const worker2Id = upsertUser({
  name: 'יוסי לוי',
  email: 'yossi@demo.com',
  password: 'password123',
  role: 'worker',
  is_worker: 1,
  phone: '050-2222222',
});

// ── Customers ─────────────────────────────────────────────────────────────────
const customer1Id = upsertUser({
  name: 'דנה אברהם',
  email: 'dana@customer.com',
  password: 'password123',
  role: 'user',
  phone: '050-3333333',
});

const customer2Id = upsertUser({
  name: 'אבי שמש',
  email: 'avi@customer.com',
  password: 'password123',
  role: 'user',
  phone: '050-4444444',
});

const customer3Id = upsertUser({
  name: 'נועה גולן',
  email: 'noa@customer.com',
  password: 'password123',
  role: 'user',
  phone: '050-5555555',
});

// ── Services ──────────────────────────────────────────────────────────────────
console.log('\nServices:');
function upsertService(name, duration_minutes, price) {
  const existing = db.prepare('SELECT id FROM services WHERE business_id = ? AND name = ?').get(businessId, name);
  if (existing) {
    console.log(`  Service already exists: ${name}`);
    return existing.id;
  }
  const res = db.prepare(`
    INSERT INTO services (business_id, name, duration_minutes, price, is_active)
    VALUES (?, ?, ?, ?, 1)
  `).run(businessId, name, duration_minutes, price);
  console.log(`  Created service: ${name} (${duration_minutes} דק' | ₪${price})`);
  return res.lastInsertRowid;
}

const service1Id = upsertService('תספורת', 30, 80);
const service2Id = upsertService('צביעה', 90, 250);
const service3Id = upsertService('פן', 45, 120);
const service4Id = upsertService('טיפול שיער', 60, 180);

// ── Appointments ──────────────────────────────────────────────────────────────
console.log('\nAppointments:');
function addAppointment(customerId, workerId, serviceId, startTime, endTime, status, notes) {
  const existing = db.prepare(
    'SELECT id FROM appointments WHERE customer_id = ? AND start_time = ?'
  ).get(customerId, startTime);
  if (existing) {
    console.log(`  Appointment already exists at ${startTime}`);
    return;
  }
  db.prepare(`
    INSERT INTO appointments (business_id, customer_id, worker_id, service_id, start_time, end_time, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(businessId, customerId, workerId, serviceId, startTime, endTime, status, notes || null);
  console.log(`  Created appointment: ${startTime} [${status}]`);
}

const today = new Date();
const fmt = (d) => d.toISOString().slice(0, 10);
const t = (daysOffset, hour, min = 0) => {
  const d = new Date(today);
  d.setDate(d.getDate() + daysOffset);
  return `${fmt(d)} ${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
};

// Upcoming - confirmed
addAppointment(customer1Id, worker1Id, service1Id, t(0, 11), t(0, 11, 30), 'confirmed', 'לקוחה קבועה');
addAppointment(customer2Id, worker1Id, service3Id, t(0, 14), t(0, 14, 45), 'confirmed');
addAppointment(customer3Id, worker2Id, service2Id, t(1, 10), t(1, 11, 30), 'confirmed');
addAppointment(customer1Id, worker2Id, service4Id, t(1, 15), t(1, 16), 'confirmed');

// Pending approval
addAppointment(customer2Id, worker1Id, service2Id, t(2, 9), t(2, 10, 30), 'pending');
addAppointment(customer3Id, worker2Id, service1Id, t(2, 13), t(2, 13, 30), 'pending');

// Past - completed
addAppointment(customer1Id, worker1Id, service1Id, t(-7, 10), t(-7, 10, 30), 'completed');
addAppointment(customer2Id, worker2Id, service3Id, t(-5, 11), t(-5, 11, 45), 'completed');
addAppointment(customer3Id, worker1Id, service2Id, t(-3, 14), t(-3, 15, 30), 'completed');

// Past - cancelled
addAppointment(customer1Id, worker2Id, service1Id, t(-2, 9), t(-2, 9, 30), 'cancelled');

console.log('\n✓ Seed complete.');
console.log('\nLogin credentials:');
console.log('  Admin:      admin@demo.com      / password123');
console.log('  Worker 1:   michal@demo.com     / password123');
console.log('  Worker 2:   yossi@demo.com      / password123');
console.log('  Customer 1: dana@customer.com   / password123');
console.log('  Customer 2: avi@customer.com    / password123');
console.log('  Customer 3: noa@customer.com    / password123');
