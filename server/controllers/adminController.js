const bcrypt = require('bcryptjs');
const { getDb } = require('../db/database');

// ---- Workers ----

const getWorkers = (req, res) => {
  const db = getDb();
  const workers = db.prepare(`
    SELECT id, name, email, is_active, created_at
    FROM users
    WHERE role = 'worker' AND business_id = ?
    ORDER BY created_at DESC
  `).all(req.user.business_id);
  res.json({ success: true, workers });
};

const createWorker = (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'יש למלא את כל השדות' });
  }
  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ success: false, message: 'כתובת אימייל זו כבר קיימת' });
  }
  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, business_id)
    VALUES (?, ?, ?, 'worker', ?)
  `).run(name, email, passwordHash, req.user.business_id);
  const worker = db.prepare('SELECT id, name, email, is_active, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ success: true, worker });
};

const updateWorker = (req, res) => {
  const { id } = req.params;
  const { name, email, is_active } = req.body;
  const db = getDb();
  const worker = db.prepare('SELECT id FROM users WHERE id = ? AND role = ? AND business_id = ?').get(id, 'worker', req.user.business_id);
  if (!worker) return res.status(404).json({ success: false, message: 'עובד לא נמצא' });

  db.prepare(`
    UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email), is_active = COALESCE(?, is_active)
    WHERE id = ?
  `).run(name ?? null, email ?? null, is_active !== undefined ? is_active : null, id);

  const updated = db.prepare('SELECT id, name, email, is_active, created_at FROM users WHERE id = ?').get(id);
  res.json({ success: true, worker: updated });
};

const deleteWorker = (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const worker = db.prepare('SELECT id FROM users WHERE id = ? AND role = ? AND business_id = ?').get(id, 'worker', req.user.business_id);
  if (!worker) return res.status(404).json({ success: false, message: 'עובד לא נמצא' });
  db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(id);
  res.json({ success: true, message: 'העובד הושבת' });
};

// ---- Services ----

const getServices = (req, res) => {
  const db = getDb();
  const services = db.prepare(`
    SELECT id, name, duration_minutes, price, is_active
    FROM services
    WHERE business_id = ? AND is_active = 1
    ORDER BY name
  `).all(req.user.business_id);
  res.json({ success: true, services });
};

const createService = (req, res) => {
  const { name, duration_minutes, price } = req.body;
  if (!name || !duration_minutes || price === undefined) {
    return res.status(400).json({ success: false, message: 'יש למלא את כל השדות' });
  }
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO services (business_id, name, duration_minutes, price)
    VALUES (?, ?, ?, ?)
  `).run(req.user.business_id, name, duration_minutes, price);
  const service = db.prepare('SELECT * FROM services WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ success: true, service });
};

const updateService = (req, res) => {
  const { id } = req.params;
  const { name, duration_minutes, price } = req.body;
  const db = getDb();
  const service = db.prepare('SELECT id FROM services WHERE id = ? AND business_id = ?').get(id, req.user.business_id);
  if (!service) return res.status(404).json({ success: false, message: 'שירות לא נמצא' });

  db.prepare(`
    UPDATE services SET
      name = COALESCE(?, name),
      duration_minutes = COALESCE(?, duration_minutes),
      price = COALESCE(?, price)
    WHERE id = ?
  `).run(name ?? null, duration_minutes ?? null, price !== undefined ? price : null, id);

  const updated = db.prepare('SELECT * FROM services WHERE id = ?').get(id);
  res.json({ success: true, service: updated });
};

const deleteService = (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const service = db.prepare('SELECT id FROM services WHERE id = ? AND business_id = ?').get(id, req.user.business_id);
  if (!service) return res.status(404).json({ success: false, message: 'שירות לא נמצא' });
  db.prepare('UPDATE services SET is_active = 0 WHERE id = ?').run(id);
  res.json({ success: true, message: 'השירות הוסר' });
};

// ---- Appointments ----

const getAppointments = (req, res) => {
  const db = getDb();
  const { workerId, date, status } = req.query;

  let query = `
    SELECT
      a.id, a.start_time, a.end_time, a.status, a.notes, a.created_at,
      c.id AS customer_id, c.name AS customer_name, c.email AS customer_email,
      w.id AS worker_id, w.name AS worker_name,
      s.id AS service_id, s.name AS service_name, s.duration_minutes, s.price
    FROM appointments a
    JOIN users c ON a.customer_id = c.id
    JOIN users w ON a.worker_id = w.id
    JOIN services s ON a.service_id = s.id
    WHERE a.business_id = ?
  `;
  const params = [req.user.business_id];

  if (workerId) {
    query += ' AND a.worker_id = ?';
    params.push(workerId);
  }
  if (date) {
    query += ' AND date(a.start_time) = ?';
    params.push(date);
  }
  if (status) {
    query += ' AND a.status = ?';
    params.push(status);
  }

  query += ' ORDER BY a.start_time DESC';

  const appointments = db.prepare(query).all(...params);
  res.json({ success: true, appointments });
};

const updateAppointmentStatus = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'סטטוס לא תקין' });
  }
  const db = getDb();
  const appt = db.prepare('SELECT id FROM appointments WHERE id = ? AND business_id = ?').get(id, req.user.business_id);
  if (!appt) return res.status(404).json({ success: false, message: 'תור לא נמצא' });
  db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(status, id);
  res.json({ success: true, message: 'הסטטוס עודכן' });
};

// ---- Worker Availability (read-only for admin) ----

const getWorkerAvailability = (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const worker = db.prepare('SELECT id, name FROM users WHERE id = ? AND role = ? AND business_id = ?').get(id, 'worker', req.user.business_id);
  if (!worker) return res.status(404).json({ success: false, message: 'עובד לא נמצא' });
  const overrides = db.prepare(`
    SELECT * FROM availability_overrides
    WHERE worker_id = ?
    ORDER BY date ASC
  `).all(id);
  res.json({ success: true, worker, overrides });
};

// ---- Settings ----

const getSettings = (req, res) => {
  const db = getDb();
  const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.user.business_id);
  if (!business) return res.status(404).json({ success: false, message: 'עסק לא נמצא' });
  business.working_hours = JSON.parse(business.working_hours_json);
  res.json({ success: true, business });
};

const updateSettings = (req, res) => {
  const { name, address, working_hours } = req.body;
  const db = getDb();
  const business = db.prepare('SELECT id FROM businesses WHERE id = ?').get(req.user.business_id);
  if (!business) return res.status(404).json({ success: false, message: 'עסק לא נמצא' });

  const workingHoursJson = working_hours ? JSON.stringify(working_hours) : null;

  db.prepare(`
    UPDATE businesses SET
      name = COALESCE(?, name),
      address = COALESCE(?, address),
      working_hours_json = COALESCE(?, working_hours_json)
    WHERE id = ?
  `).run(name ?? null, address ?? null, workingHoursJson, req.user.business_id);

  const updated = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.user.business_id);
  updated.working_hours = JSON.parse(updated.working_hours_json);
  res.json({ success: true, business: updated });
};

module.exports = {
  getWorkers, createWorker, updateWorker, deleteWorker,
  getWorkerAvailability,
  getServices, createService, updateService, deleteService,
  getAppointments, updateAppointmentStatus,
  getSettings, updateSettings,
};
