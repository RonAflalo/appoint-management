const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'appointments.db');

let db;

function initializeDatabase() {
  db = new Database(DB_PATH);
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

  console.log('Database initialized');
  return db;
}

function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

module.exports = { initializeDatabase, getDb };
