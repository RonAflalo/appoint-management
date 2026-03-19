const bcrypt = require('bcryptjs');
const { getDb } = require('../db/database');
const { getAvailableSlots, getPossibleSlots } = require('../utils/slots');
const { formatDateTime } = require('../utils/dateFormat');
const { sendNewBookingToWorker } = require('../services/emailService');

const getBusinessInfo = (req, res) => {
  const business = req.business;
  const { working_hours_json, ...rest } = business;
  let working_hours = null;
  try {
    working_hours = JSON.parse(working_hours_json);
  } catch (_) {}
  res.json({ success: true, business: { ...rest, working_hours } });
};

const getPublicServices = (req, res) => {
  const db = getDb();
  const services = db.prepare(`
    SELECT id, name, duration_minutes, price
    FROM services
    WHERE business_id = ? AND is_active = 1
    ORDER BY name
  `).all(req.business.id);
  res.json({ success: true, services });
};

const getPublicWorkers = (req, res) => {
  const db = getDb();
  const workers = db.prepare(`
    SELECT id, name
    FROM users
    WHERE (role = 'worker' OR (role = 'admin' AND is_worker = 1)) AND business_id = ? AND is_active = 1
    ORDER BY name
  `).all(req.business.id);
  res.json({ success: true, workers });
};

const getPublicSlots = (req, res) => {
  const { workerId, serviceId, date } = req.query;
  if (!serviceId || !date) {
    return res.status(400).json({ success: false, message: 'יש לציין שירות ותאריך' });
  }

  const db = getDb();
  const businessId = req.business.id;

  if (workerId) {
    const wId = Number(workerId), sId = Number(serviceId);
    const slots = getAvailableSlots({ workerId: wId, serviceId: sId, date, businessId });
    const possible = getPossibleSlots({ workerId: wId, serviceId: sId, date, businessId });
    const bookedSlots = possible.filter(s => !slots.includes(s));
    return res.json({ success: true, slots, bookedSlots });
  }

  const workers = db.prepare(`
    SELECT id FROM users WHERE (role = 'worker' OR (role = 'admin' AND is_worker = 1)) AND business_id = ? AND is_active = 1
  `).all(businessId);

  const possibleSet = {};
  const availableSlots = {};
  for (const worker of workers) {
    const possible = getPossibleSlots({ workerId: worker.id, serviceId: Number(serviceId), date, businessId });
    const available = getAvailableSlots({ workerId: worker.id, serviceId: Number(serviceId), date, businessId });
    for (const slot of possible) possibleSet[slot] = true;
    for (const slot of available) {
      if (!availableSlots[slot]) availableSlots[slot] = [];
      availableSlots[slot].push(worker.id);
    }
  }

  const slots = Object.keys(availableSlots).sort();
  const bookedSlots = Object.keys(possibleSet).filter(s => !availableSlots[s]).sort();
  return res.json({ success: true, slots, slotWorkers: availableSlots, bookedSlots });
};

const getPublicAvailableDays = (req, res) => {
  const { workerId, serviceId, year, month } = req.query;
  if (!serviceId || !year || !month) {
    return res.status(400).json({ success: false, message: 'יש לציין שירות, שנה וחודש' });
  }

  const db = getDb();
  const businessId = req.business.id;
  const workers = workerId
    ? [{ id: Number(workerId) }]
    : db.prepare("SELECT id FROM users WHERE (role = 'worker' OR (role = 'admin' AND is_worker = 1)) AND business_id = ? AND is_active = 1").all(businessId);

  const yearNum = parseInt(year);
  const monthNum = parseInt(month);
  const daysInMonth = new Date(yearNum, monthNum, 0).getDate();

  const unavailableDates = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    let hasSlots = false;
    for (const worker of workers) {
      const slots = getAvailableSlots({ workerId: worker.id, serviceId: Number(serviceId), date: dateStr, businessId });
      if (slots.length > 0) { hasSlots = true; break; }
    }
    if (!hasSlots) unavailableDates.push(dateStr);
  }

  res.json({ success: true, unavailableDates });
};

const publicBook = (req, res) => {
  const { workerId, serviceId, start_time, notes, guestName, guestEmail } = req.body;

  if (!workerId || !serviceId || !start_time || !guestName || !guestEmail) {
    return res.status(400).json({ success: false, message: 'יש למלא את כל השדות הנדרשים' });
  }

  const db = getDb();
  const businessId = req.business.id;

  const service = db.prepare('SELECT * FROM services WHERE id = ? AND is_active = 1 AND business_id = ?').get(serviceId, businessId);
  if (!service) return res.status(404).json({ success: false, message: 'שירות לא נמצא' });

  const worker = db.prepare("SELECT id, name, email FROM users WHERE id = ? AND (role = 'worker' OR (role = 'admin' AND is_worker = 1)) AND is_active = 1 AND business_id = ?").get(workerId, businessId);
  if (!worker) return res.status(404).json({ success: false, message: 'עובד לא נמצא' });

  // Find or create guest user — scoped to this business
  let guestUser = db.prepare('SELECT id, name, email FROM users WHERE email = ? AND business_id = ?').get(guestEmail, businessId);
  if (!guestUser) {
    const randomPassword = bcrypt.hashSync(Math.random().toString(36), 10);
    const result = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, business_id)
      VALUES (?, ?, ?, 'user', ?)
    `).run(guestName, guestEmail, randomPassword, businessId);
    guestUser = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(result.lastInsertRowid);
  }

  const startDate = new Date(start_time);
  const endDate = new Date(startDate.getTime() + service.duration_minutes * 60 * 1000);
  const endTime = endDate.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
  const startTimeFormatted = new Date(start_time).toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');

  const conflict = db.prepare(`
    SELECT id FROM appointments
    WHERE worker_id = ?
      AND status IN ('pending', 'confirmed')
      AND start_time < ?
      AND end_time > ?
  `).get(workerId, endTime, startTimeFormatted);

  if (conflict) {
    return res.status(409).json({ success: false, message: 'השעה שנבחרה אינה זמינה' });
  }

  const result = db.prepare(`
    INSERT INTO appointments (business_id, customer_id, worker_id, service_id, start_time, end_time, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
  `).run(businessId, guestUser.id, workerId, serviceId, startTimeFormatted, endTime, notes || null);

  const appointment = db.prepare(`
    SELECT a.*, s.name AS service_name, w.name AS worker_name, w.email AS worker_email
    FROM appointments a
    JOIN services s ON a.service_id = s.id
    JOIN users w ON a.worker_id = w.id
    WHERE a.id = ?
  `).get(result.lastInsertRowid);

  sendNewBookingToWorker({
    workerEmail: appointment.worker_email,
    workerName: appointment.worker_name,
    customerName: guestUser.name,
    serviceName: appointment.service_name,
    dateTime: formatDateTime(appointment.start_time),
  });

  res.status(201).json({ success: true, appointment });
};

module.exports = { getBusinessInfo, getPublicServices, getPublicWorkers, getPublicSlots, getPublicAvailableDays, publicBook };
