const { getDb } = require('../db/database');
const {
  sendAppointmentConfirmed,
  sendAppointmentCancelled,
  sendRescheduleRequest,
} = require('../services/emailService');
const { formatDateTime } = require('../utils/dateFormat');

// ─── helpers ──────────────────────────────────────────────────────────────────

function getFullAppointment(db, id) {
  return db.prepare(`
    SELECT
      a.id, a.start_time, a.end_time, a.status, a.notes,
      a.suggested_time, a.reschedule_note,
      c.id  AS customer_id,  c.name  AS customer_name,  c.email AS customer_email,
      w.id  AS worker_id,    w.name  AS worker_name,
      s.id  AS service_id,   s.name  AS service_name
    FROM appointments a
    JOIN users c ON a.customer_id = c.id
    JOIN users w ON a.worker_id   = w.id
    JOIN services s ON a.service_id = s.id
    WHERE a.id = ?
  `).get(id);
}

// ─── List appointments ────────────────────────────────────────────────────────

const getAppointments = (req, res) => {
  const db = getDb();
  const { status } = req.query;

  let query = `
    SELECT
      a.id, a.start_time, a.end_time, a.status, a.notes,
      a.suggested_time, a.reschedule_note, a.created_at,
      c.id AS customer_id, c.name AS customer_name, c.email AS customer_email,
      s.id AS service_id, s.name AS service_name, s.duration_minutes, s.price
    FROM appointments a
    JOIN users c ON a.customer_id = c.id
    JOIN services s ON a.service_id = s.id
    WHERE a.worker_id = ?
  `;
  const params = [req.user.id];

  if (status) {
    query += ' AND a.status = ?';
    params.push(status);
  }

  query += ' ORDER BY a.start_time DESC';

  const appointments = db.prepare(query).all(...params);
  res.json({ success: true, appointments });
};

// ─── Approve (pending → confirmed) ───────────────────────────────────────────

const approveAppointment = async (req, res) => {
  const { id } = req.params;
  const db = getDb();

  const appt = getFullAppointment(db, id);
  if (!appt || appt.worker_id !== req.user.id) {
    return res.status(404).json({ success: false, message: 'תור לא נמצא' });
  }
  if (appt.status !== 'pending') {
    return res.status(400).json({ success: false, message: 'ניתן לאשר רק תורים במצב ממתין' });
  }

  db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run('confirmed', id);

  sendAppointmentConfirmed({
    customerEmail: appt.customer_email,
    customerName: appt.customer_name,
    workerName: appt.worker_name,
    serviceName: appt.service_name,
    dateTime: formatDateTime(appt.start_time),
  });

  res.json({ success: true, message: 'התור אושר' });
};

// ─── Cancel (worker cancels) ──────────────────────────────────────────────────

const cancelAppointment = async (req, res) => {
  const { id } = req.params;
  const db = getDb();

  const appt = getFullAppointment(db, id);
  if (!appt || appt.worker_id !== req.user.id) {
    return res.status(404).json({ success: false, message: 'תור לא נמצא' });
  }
  if (!['pending', 'confirmed', 'reschedule_requested'].includes(appt.status)) {
    return res.status(400).json({ success: false, message: 'לא ניתן לבטל תור זה' });
  }

  db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run('cancelled', id);

  sendAppointmentCancelled({
    customerEmail: appt.customer_email,
    customerName: appt.customer_name,
    workerName: appt.worker_name,
    serviceName: appt.service_name,
    dateTime: formatDateTime(appt.start_time),
    cancelledBy: 'worker',
  });

  res.json({ success: true, message: 'התור בוטל' });
};

// ─── Request reschedule ───────────────────────────────────────────────────────

const requestReschedule = async (req, res) => {
  const { id } = req.params;
  const { suggested_time, note } = req.body;

  if (!suggested_time) {
    return res.status(400).json({ success: false, message: 'יש לציין זמן מוצע' });
  }

  const db = getDb();

  const appt = getFullAppointment(db, id);
  if (!appt || appt.worker_id !== req.user.id) {
    return res.status(404).json({ success: false, message: 'תור לא נמצא' });
  }
  if (appt.status !== 'confirmed') {
    return res.status(400).json({ success: false, message: 'ניתן לבקש שינוי מועד רק לתורים מאושרים' });
  }

  db.prepare(`
    UPDATE appointments
    SET status = 'reschedule_requested', suggested_time = ?, reschedule_note = ?
    WHERE id = ?
  `).run(suggested_time, note || null, id);

  const suggestedLabel = formatDateTime(suggested_time);

  sendRescheduleRequest({
    customerEmail: appt.customer_email,
    customerName: appt.customer_name,
    workerName: appt.worker_name,
    serviceName: appt.service_name,
    dateTime: formatDateTime(appt.start_time),
    suggestedTime: suggestedLabel,
    rescheduleNote: note || null,
  });

  res.json({ success: true, message: 'בקשת שינוי המועד נשלחה ללקוח' });
};

// ─── Mark completed / generic status (kept for backward compat) ───────────────

const updateAppointmentStatus = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (status !== 'completed') {
    return res.status(400).json({ success: false, message: 'השתמש בנתיבים הייעודיים לאישור / ביטול / שינוי מועד' });
  }
  const db = getDb();
  const appt = db.prepare('SELECT id FROM appointments WHERE id = ? AND worker_id = ?').get(id, req.user.id);
  if (!appt) return res.status(404).json({ success: false, message: 'תור לא נמצא' });
  db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run('completed', id);
  res.json({ success: true, message: 'התור סומן כהושלם' });
};

// ─── Availability ─────────────────────────────────────────────────────────────

const getAvailability = (req, res) => {
  const db = getDb();
  const overrides = db.prepare(`
    SELECT * FROM availability_overrides
    WHERE worker_id = ?
    ORDER BY date ASC
  `).all(req.user.id);
  res.json({ success: true, overrides });
};

const setAvailability = (req, res) => {
  const { date, is_blocked, custom_start, custom_end } = req.body;
  if (!date) {
    return res.status(400).json({ success: false, message: 'יש לציין תאריך' });
  }

  const db = getDb();
  const existing = db.prepare(
    'SELECT id FROM availability_overrides WHERE worker_id = ? AND date = ?'
  ).get(req.user.id, date);

  if (existing) {
    db.prepare(`
      UPDATE availability_overrides
      SET is_blocked = ?, custom_start = ?, custom_end = ?
      WHERE id = ?
    `).run(is_blocked ? 1 : 0, custom_start || null, custom_end || null, existing.id);
  } else {
    db.prepare(`
      INSERT INTO availability_overrides (worker_id, date, is_blocked, custom_start, custom_end)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.user.id, date, is_blocked ? 1 : 0, custom_start || null, custom_end || null);
  }

  const override = db.prepare(
    'SELECT * FROM availability_overrides WHERE worker_id = ? AND date = ?'
  ).get(req.user.id, date);

  res.json({ success: true, override });
};

// ─── Appointment Photos ───────────────────────────────────────────────────────

const getAppointmentPhotos = (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const appt = db.prepare('SELECT id FROM appointments WHERE id = ? AND worker_id = ?').get(id, req.user.id);
  if (!appt) return res.status(404).json({ success: false, message: 'תור לא נמצא' });
  const photos = db.prepare('SELECT id, url, created_at FROM appointment_photos WHERE appointment_id = ? ORDER BY created_at ASC').all(id);
  res.json({ success: true, photos });
};

const addAppointmentPhoto = (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const appt = db.prepare('SELECT id FROM appointments WHERE id = ? AND worker_id = ?').get(id, req.user.id);
  if (!appt) return res.status(404).json({ success: false, message: 'תור לא נמצא' });
  if (!req.file) return res.status(400).json({ success: false, message: 'לא נמצאה תמונה' });
  const url = `/uploads/${req.file.filename}`;
  const result = db.prepare('INSERT INTO appointment_photos (appointment_id, url, uploaded_by) VALUES (?, ?, ?)').run(id, url, req.user.id);
  const photo = db.prepare('SELECT id, url, created_at FROM appointment_photos WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ success: true, photo });
};

const deleteAppointmentPhoto = (req, res) => {
  const { id, photoId } = req.params;
  const db = getDb();
  const appt = db.prepare('SELECT id FROM appointments WHERE id = ? AND worker_id = ?').get(id, req.user.id);
  if (!appt) return res.status(404).json({ success: false, message: 'תור לא נמצא' });
  const photo = db.prepare('SELECT id, url FROM appointment_photos WHERE id = ? AND appointment_id = ?').get(photoId, id);
  if (!photo) return res.status(404).json({ success: false, message: 'תמונה לא נמצאה' });
  db.prepare('DELETE FROM appointment_photos WHERE id = ?').run(photoId);
  try {
    const fs = require('fs');
    const pathMod = require('path');
    const filePath = pathMod.join(__dirname, '..', photo.url);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (_) {}
  res.json({ success: true });
};

module.exports = {
  getAppointments,
  approveAppointment,
  cancelAppointment,
  requestReschedule,
  updateAppointmentStatus,
  getAvailability,
  setAvailability,
  getAppointmentPhotos,
  addAppointmentPhoto,
  deleteAppointmentPhoto,
};
