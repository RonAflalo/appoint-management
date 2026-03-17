const Database = require('better-sqlite3');
const path = require('path');

const DEFAULT_DB_PATH = path.join(__dirname, 'appointments.db');

let db;

function initializeDatabase(overridePath) {
  if (db) {
    try { db.close(); } catch (_) {}
  }
  const dbPath = overridePath || process.env.DB_PATH || DEFAULT_DB_PATH;
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS businesses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      working_hours_json TEXT NOT NULL DEFAULT '{"0":null,"1":{"start":"09:00","end":"18:00"},"2":{"start":"09:00","end":"18:00"},"3":{"start":"09:00","end":"18:00"},"4":{"start":"09:00","end":"18:00"},"5":{"start":"09:00","end":"14:00"},"6":null}'
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      business_id INTEGER REFERENCES businesses(id),
      is_active INTEGER NOT NULL DEFAULT 1,
      is_worker INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      name TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 30,
      price REAL NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      customer_id INTEGER NOT NULL REFERENCES users(id),
      worker_id INTEGER NOT NULL REFERENCES users(id),
      service_id INTEGER NOT NULL REFERENCES services(id),
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS availability_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id INTEGER NOT NULL REFERENCES users(id),
      date TEXT NOT NULL,
      is_blocked INTEGER NOT NULL DEFAULT 0,
      custom_start TEXT,
      custom_end TEXT
    );
  `);

  // Migrate: add is_worker flag for admin-as-worker support
  try { db.exec('ALTER TABLE users ADD COLUMN is_worker INTEGER NOT NULL DEFAULT 0'); } catch (_) {}
  // Auto-enable is_worker for admins in businesses that have no workers yet
  try {
    db.exec(`
      UPDATE users SET is_worker = 1
      WHERE role = 'admin' AND is_worker = 0
        AND NOT EXISTS (
          SELECT 1 FROM users w WHERE w.role = 'worker' AND w.business_id = users.business_id AND w.is_active = 1
        )
    `);
  } catch (_) {}

  // Migrate: add reschedule columns if they don't exist yet
  try { db.exec('ALTER TABLE appointments ADD COLUMN suggested_time TEXT'); } catch (_) {}
  try { db.exec('ALTER TABLE appointments ADD COLUMN reschedule_note TEXT'); } catch (_) {}

  // Migrate: add slug to businesses
  try { db.exec("ALTER TABLE businesses ADD COLUMN slug TEXT"); } catch (_) {}
  try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_businesses_slug ON businesses(slug)"); } catch (_) {}

  // Migrate: business customization + onboarding
  try { db.exec("ALTER TABLE businesses ADD COLUMN description TEXT"); } catch (_) {}
  try { db.exec("ALTER TABLE businesses ADD COLUMN logo_url TEXT"); } catch (_) {}
  try { db.exec("ALTER TABLE businesses ADD COLUMN onboarding_complete INTEGER NOT NULL DEFAULT 1"); } catch (_) {}

  // Migrate: email verification
  try { db.exec("ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0"); } catch (_) {}
  try { db.exec("ALTER TABLE users ADD COLUMN verification_token TEXT"); } catch (_) {}

  // Migrate: password reset
  try { db.exec("ALTER TABLE users ADD COLUMN reset_token TEXT"); } catch (_) {}
  try { db.exec("ALTER TABLE users ADD COLUMN reset_token_expires TEXT"); } catch (_) {}

  // Migrate: reminder tracking
  try { db.exec("ALTER TABLE appointments ADD COLUMN reminder_sent INTEGER NOT NULL DEFAULT 0"); } catch (_) {}

  // Migrate: phone numbers
  try { db.exec("ALTER TABLE users ADD COLUMN phone TEXT"); } catch (_) {}
  try { db.exec("ALTER TABLE businesses ADD COLUMN phone TEXT"); } catch (_) {}

  // Migrate: cover image + social links
  try { db.exec("ALTER TABLE businesses ADD COLUMN cover_url TEXT"); } catch (_) {}
  try { db.exec("ALTER TABLE businesses ADD COLUMN instagram_url TEXT"); } catch (_) {}
  try { db.exec("ALTER TABLE businesses ADD COLUMN facebook_url TEXT"); } catch (_) {}

  console.log('Database initialized');
  return db;
}

function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

function closeDatabase() {
  if (db) {
    try { db.close(); } catch (_) {}
    db = null;
  }
}

module.exports = { initializeDatabase, getDb, closeDatabase };
