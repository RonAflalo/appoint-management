const { getDb } = require('../db/database');

const getAppointments = (req, res) => {
  const db = getDb();
  const { status } = req.query;

  let query = `
    SELECT
      a.id, a.start_time, a.end_time, a.status, a.notes, a.created_at,
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

const updateAppointmentStatus = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const validStatuses = ['completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'ניתן לסמן רק כהושלם או בוטל' });
  }
  const db = getDb();
  const appt = db.prepare('SELECT id FROM appointments WHERE id = ? AND worker_id = ?').get(id, req.user.id);
  if (!appt) return res.status(404).json({ success: false, message: 'תור לא נמצא' });
  db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(status, id);
  res.json({ success: true, message: 'הסטטוס עודכן' });
};

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

module.exports = { getAppointments, updateAppointmentStatus, getAvailability, setAvailability };
