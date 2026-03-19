const { getDb } = require('../db/database');
const { getAvailableSlots, getPossibleSlots } = require('../utils/slots');
const { notifyNextInQueue } = require('../utils/waitlist');
const { sendNewBookingToWorker, sendAppointmentConfirmed, sendRescheduleAcceptedToWorker, sendAppointmentCancelledByCustomer } = require('../services/emailService');
const { formatDateTime } = require('../utils/dateFormat');

const getServices = (req, res) => {
  const db = getDb();
  const businessId = req.user ? req.user.business_id : 1;
  const services = db.prepare(`
    SELECT id, name, duration_minutes, price
    FROM services
    WHERE business_id = ? AND is_active = 1
    ORDER BY name
  `).all(businessId);
  res.json({ success: true, services });
};

const getWorkers = (req, res) => {
  const db = getDb();
  const businessId = req.user ? req.user.business_id : 1;
  const workers = db.prepare(`
    SELECT id, name
    FROM users
    WHERE (role = 'worker' OR (role = 'admin' AND is_worker = 1)) AND business_id = ? AND is_active = 1
    ORDER BY name
  `).all(businessId);
  res.json({ success: true, workers });
};

const getSlots = (req, res) => {
  const { workerId, serviceId, date } = req.query;
  if (!serviceId || !date) {
    return res.status(400).json({ success: false, message: 'יש לציין שירות ותאריך' });
  }

  const db = getDb();
  const businessId = req.user ? req.user.business_id : 1;

  if (workerId) {
    const slots = getAvailableSlots({ workerId: Number(workerId), serviceId: Number(serviceId), date, businessId });
    const possible = getPossibleSlots({ workerId: Number(workerId), serviceId: Number(serviceId), date, businessId });
    const bookedSlots = possible.filter(s => !slots.includes(s));
    return res.json({ success: true, slots, bookedSlots });
  }

  // No specific worker - get all active workers and merge slots
  const workers = db.prepare(`
    SELECT id FROM users WHERE (role = 'worker' OR (role = 'admin' AND is_worker = 1)) AND business_id = ? AND is_active = 1
  `).all(businessId);

  const allSlots = {};
  const possibleSet = {};
  for (const worker of workers) {
    const workerSlots = getAvailableSlots({ workerId: worker.id, serviceId: Number(serviceId), date, businessId });
    const workerPossible = getPossibleSlots({ workerId: worker.id, serviceId: Number(serviceId), date, businessId });
    for (const slot of workerSlots) {
      if (!allSlots[slot]) allSlots[slot] = [];
      allSlots[slot].push(worker.id);
    }
    for (const slot of workerPossible) {
      possibleSet[slot] = true;
    }
  }

  const slots = Object.keys(allSlots).sort();
  const bookedSlots = Object.keys(possibleSet).filter(s => !allSlots[s]).sort();
  return res.json({ success: true, slots, slotWorkers: allSlots, bookedSlots });
};

const getAvailableDays = (req, res) => {
  const { workerId, serviceId, year, month } = req.query;
  if (!serviceId || !year || !month) {
    return res.status(400).json({ success: false, message: 'יש לציין שירות, שנה וחודש' });
  }

  const db = getDb();
  const businessId = req.user ? req.user.business_id : 1;
  const workers = workerId
    ? [{ id: Number(workerId) }]
    : db.prepare("SELECT id FROM users WHERE (role = 'worker' OR (role = 'admin' AND is_worker = 1)) AND business_id = ? AND is_active = 1").all(businessId);

  const yearNum = parseInt(year);
  const monthNum = parseInt(month); // 1-12
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

const bookAppointment = (req, res) => {
  const { workerId, serviceId, start_time, notes } = req.body;
  if (!workerId || !serviceId || !start_time) {
    return res.status(400).json({ success: false, message: 'יש למלא את כל השדות הנדרשים' });
  }

  const db = getDb();

  const service = db.prepare('SELECT * FROM services WHERE id = ? AND is_active = 1').get(serviceId);
  if (!service) return res.status(404).json({ success: false, message: 'שירות לא נמצא' });

  const worker = db.prepare("SELECT id FROM users WHERE id = ? AND (role = 'worker' OR (role = 'admin' AND is_worker = 1)) AND is_active = 1").get(workerId);
  if (!worker) return res.status(404).json({ success: false, message: 'עובד לא נמצא' });

  const startDate = new Date(start_time);
  const endDate = new Date(startDate.getTime() + service.duration_minutes * 60 * 1000);
  const endTime = endDate.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
  const startTimeFormatted = new Date(start_time).toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');

  // Check for conflicts
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
  `).run(req.user.business_id || 1, req.user.id, workerId, serviceId, startTimeFormatted, endTime, notes || null);

  const appointment = db.prepare(`
    SELECT a.*, s.name AS service_name, w.name AS worker_name, w.email AS worker_email
    FROM appointments a
    JOIN services s ON a.service_id = s.id
    JOIN users w ON a.worker_id = w.id
    WHERE a.id = ?
  `).get(result.lastInsertRowid);

  // Notify the worker about the new booking
  sendNewBookingToWorker({
    workerEmail: appointment.worker_email,
    workerName: appointment.worker_name,
    customerName: req.user.name,
    serviceName: appointment.service_name,
    dateTime: formatDateTime(appointment.start_time),
  });

  res.status(201).json({ success: true, appointment });
};

const getMyAppointments = (req, res) => {
  const db = getDb();
  const appointments = db.prepare(`
    SELECT
      a.id, a.start_time, a.end_time, a.status, a.notes, a.created_at,
      a.suggested_time, a.reschedule_note,
      w.id AS worker_id, w.name AS worker_name, w.email AS worker_email,
      s.id AS service_id, s.name AS service_name, s.duration_minutes, s.price
    FROM appointments a
    JOIN users w ON a.worker_id = w.id
    JOIN services s ON a.service_id = s.id
    WHERE a.customer_id = ?
    ORDER BY a.start_time DESC
  `).all(req.user.id);
  res.json({ success: true, appointments });
};

const cancelAppointment = (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const appt = db.prepare(`
    SELECT a.id, a.status, a.start_time, a.business_id,
           c.name AS customer_name,
           w.name AS worker_name, w.email AS worker_email,
           s.name AS service_name
    FROM appointments a
    JOIN users c ON a.customer_id = c.id
    JOIN users w ON a.worker_id = w.id
    JOIN services s ON a.service_id = s.id
    WHERE a.id = ? AND a.customer_id = ?
  `).get(id, req.user.id);

  if (!appt) return res.status(404).json({ success: false, message: 'תור לא נמצא' });
  if (!['pending', 'confirmed', 'reschedule_requested'].includes(appt.status)) {
    return res.status(400).json({ success: false, message: 'לא ניתן לבטל תור זה' });
  }

  // Enforce cancellation policy
  const business = db.prepare('SELECT cancellation_hours FROM businesses WHERE id = ?').get(appt.business_id);
  const cancelHours = business?.cancellation_hours || 0;
  if (cancelHours > 0) {
    const hoursUntil = (new Date(appt.start_time.replace(' ', 'T') + 'Z') - new Date()) / (1000 * 60 * 60);
    if (hoursUntil < cancelHours) {
      return res.status(403).json({
        success: false,
        message: `לא ניתן לבטל תור פחות מ-${cancelHours} שעות לפני המועד`,
        cancellation_hours: cancelHours,
      });
    }
  }

  const fullAppt = db.prepare('SELECT business_id, service_id, worker_id, start_time FROM appointments WHERE id = ?').get(id);
  db.prepare("UPDATE appointments SET status = 'cancelled' WHERE id = ?").run(id);

  sendAppointmentCancelledByCustomer({
    workerEmail: appt.worker_email,
    workerName: appt.worker_name,
    customerName: appt.customer_name,
    serviceName: appt.service_name,
    dateTime: formatDateTime(appt.start_time),
  });

  notifyNextInQueue({ businessId: fullAppt.business_id, serviceId: fullAppt.service_id, slotTime: fullAppt.start_time, workerId: fullAppt.worker_id })
    .catch(err => console.error('[Waitlist] notifyNextInQueue failed after customer cancel:', err));

  res.json({ success: true, message: 'התור בוטל בהצלחה' });
};

const acceptReschedule = (req, res) => {
  const { id } = req.params;
  const db = getDb();

  const appt = db.prepare(`
    SELECT a.id, a.status, a.suggested_time, a.worker_id,
           s.duration_minutes, s.name AS service_name,
           c.name AS customer_name, c.email AS customer_email,
           w.name AS worker_name, w.email AS worker_email
    FROM appointments a
    JOIN services s ON a.service_id = s.id
    JOIN users c ON a.customer_id = c.id
    JOIN users w ON a.worker_id = w.id
    WHERE a.id = ? AND a.customer_id = ?
  `).get(id, req.user.id);

  if (!appt) return res.status(404).json({ success: false, message: 'תור לא נמצא' });
  if (appt.status !== 'reschedule_requested') {
    return res.status(400).json({ success: false, message: 'אין בקשת שינוי מועד פעילה לתור זה' });
  }
  if (!appt.suggested_time) {
    return res.status(400).json({ success: false, message: 'לא נמצא זמן מוצע' });
  }

  // Calculate new end_time from suggested_time + service duration
  const newStart = new Date(appt.suggested_time);
  const newEnd = new Date(newStart.getTime() + appt.duration_minutes * 60 * 1000);
  const newStartStr = newStart.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
  const newEndStr = newEnd.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');

  // Verify the suggested time is still available (no new conflicts)
  const conflict = db.prepare(`
    SELECT id FROM appointments
    WHERE worker_id = ?
      AND id != ?
      AND status IN ('pending', 'confirmed')
      AND start_time < ?
      AND end_time > ?
  `).get(appt.worker_id, appt.id, newEndStr, newStartStr);

  if (conflict) {
    return res.status(409).json({ success: false, message: 'הזמן המוצע כבר תפוס, צור קשר עם העסק' });
  }

  db.prepare(`
    UPDATE appointments
    SET status = 'confirmed', start_time = ?, end_time = ?, suggested_time = NULL, reschedule_note = NULL
    WHERE id = ?
  `).run(newStartStr, newEndStr, id);

  const newDateTimeLabel = formatDateTime(newStartStr);

  // Confirm new time to customer
  sendAppointmentConfirmed({
    customerEmail: appt.customer_email,
    customerName: appt.customer_name,
    workerName: appt.worker_name,
    serviceName: appt.service_name,
    dateTime: newDateTimeLabel,
  });

  // Notify worker that customer accepted the reschedule
  sendRescheduleAcceptedToWorker({
    workerEmail: appt.worker_email,
    workerName: appt.worker_name,
    customerName: appt.customer_name,
    serviceName: appt.service_name,
    dateTime: newDateTimeLabel,
  });

  res.json({ success: true, message: 'המועד החדש אושר בהצלחה' });
};

const normalizeSlotTime = (t) =>
  new Date(t).toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');

const addToWaitlist = (req, res) => {
  const { serviceId, workerId, slotTime, slug } = req.body;
  if (!serviceId || !slotTime) {
    return res.status(400).json({ success: false, message: 'חסרים פרטים' });
  }
  const db = getDb();

  // Resolve business: prefer business_id from auth token, fall back to slug
  let businessId = req.user.business_id;
  if (!businessId && slug) {
    const business = db.prepare('SELECT id FROM businesses WHERE slug = ?').get(slug);
    if (!business) return res.status(404).json({ success: false, message: 'עסק לא נמצא' });
    businessId = business.id;
  }
  if (!businessId) return res.status(400).json({ success: false, message: 'עסק לא זוהה' });

  // Normalize to the same format used by appointments (e.g. "2024-03-18 10:00:00")
  const normalizedSlot = normalizeSlotTime(slotTime);

  const existing = db.prepare(`
    SELECT id FROM waiting_list
    WHERE business_id = ? AND customer_id = ? AND service_id = ? AND slot_time = ? AND status IN ('waiting', 'notified')
  `).get(businessId, req.user.id, serviceId, normalizedSlot);
  if (existing) return res.status(409).json({ success: false, message: 'כבר רשום לרשימת המתנה לשעה זו' });

  db.prepare(`
    INSERT INTO waiting_list (business_id, customer_id, service_id, worker_id, slot_time)
    VALUES (?, ?, ?, ?, ?)
  `).run(businessId, req.user.id, serviceId, workerId || null, normalizedSlot);

  return res.json({ success: true, message: 'נוספת לרשימת המתנה' });
};

const getMyWaitlist = (req, res) => {
  const db = getDb();
  const entries = db.prepare(`
    SELECT wl.id, wl.slot_time, wl.status, wl.created_at, wl.expires_at,
           s.name AS service_name, s.duration_minutes, s.price,
           b.name AS business_name, b.slug,
           u.name AS worker_name
    FROM waiting_list wl
    JOIN services s ON wl.service_id = s.id
    JOIN businesses b ON wl.business_id = b.id
    LEFT JOIN users u ON wl.worker_id = u.id
    WHERE wl.customer_id = ? AND wl.status IN ('waiting', 'notified')
    ORDER BY wl.slot_time ASC
  `).all(req.user.id);
  res.json({ success: true, waitlist: entries });
};

const cancelWaitlistEntry = (req, res) => {
  const db = getDb();
  const entry = db.prepare('SELECT id FROM waiting_list WHERE id = ? AND customer_id = ?').get(req.params.id, req.user.id);
  if (!entry) return res.status(404).json({ success: false, message: 'לא נמצא' });
  db.prepare("UPDATE waiting_list SET status = 'cancelled' WHERE id = ?").run(req.params.id);
  res.json({ success: true });
};

const confirmWaitlistEntry = (req, res) => {
  const { token } = req.params;
  const db = getDb();

  const entry = db.prepare(`
    SELECT wl.*, u.name AS customer_name, u.email AS customer_email,
           s.name AS service_name, s.duration_minutes,
           w.name AS worker_name, w.email AS worker_email
    FROM waiting_list wl
    JOIN users u ON wl.customer_id = u.id
    JOIN services s ON wl.service_id = s.id
    LEFT JOIN users w ON wl.worker_id = w.id
    WHERE wl.notify_token = ? AND wl.status = 'notified'
  `).get(token);

  if (!entry) {
    return res.status(400).json({ success: false, message: 'קישור לא תקף' });
  }
  if (new Date(entry.expires_at.replace(' ', 'T') + 'Z') < new Date()) {
    return res.status(400).json({ success: false, message: 'הזמן לאישור פג — ניתן לחזור לרשימת המתנה' });
  }

  // Check the slot is still actually available
  const conflict = db.prepare(`
    SELECT id FROM appointments
    WHERE worker_id = ? AND start_time = ? AND status IN ('pending', 'confirmed')
  `).get(entry.worker_id, entry.slot_time);
  if (conflict) {
    return res.status(409).json({ success: false, message: 'השעה כבר נתפסה מחדש' });
  }

  // Create the appointment (normalize endTime to match appointment format)
  const endTime = new Date(new Date(entry.slot_time).getTime() + entry.duration_minutes * 60000)
    .toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
  const result = db.prepare(`
    INSERT INTO appointments (business_id, customer_id, worker_id, service_id, start_time, end_time, status)
    VALUES (?, ?, ?, ?, ?, ?, 'confirmed')
  `).run(entry.business_id, entry.customer_id, entry.worker_id, entry.service_id, entry.slot_time, endTime);

  db.prepare("UPDATE waiting_list SET status = 'confirmed' WHERE id = ?").run(entry.id);

  sendAppointmentConfirmed({
    customerEmail: entry.customer_email,
    customerName: entry.customer_name,
    workerName: entry.worker_name || '',
    serviceName: entry.service_name,
    dateTime: formatDateTime(entry.slot_time),
  });

  const appointment = db.prepare(`
    SELECT a.id, a.start_time, s.name AS service_name, u.name AS worker_name
    FROM appointments a
    JOIN services s ON a.service_id = s.id
    LEFT JOIN users u ON a.worker_id = u.id
    WHERE a.id = ?
  `).get(result.lastInsertRowid);

  return res.json({ success: true, message: 'התור אושר בהצלחה!', appointment });
};

// In-app confirmation: authenticated user confirms their own notified waitlist entry (no token needed)
const confirmWaitlistEntryInApp = (req, res) => {
  const { id } = req.params;
  const db = getDb();

  const entry = db.prepare(`
    SELECT wl.*, u.name AS customer_name, u.email AS customer_email,
           s.name AS service_name, s.duration_minutes,
           w.name AS worker_name, w.email AS worker_email
    FROM waiting_list wl
    JOIN users u ON wl.customer_id = u.id
    JOIN services s ON wl.service_id = s.id
    LEFT JOIN users w ON wl.worker_id = w.id
    WHERE wl.id = ? AND wl.customer_id = ? AND wl.status = 'notified'
  `).get(id, req.user.id);

  if (!entry) return res.status(404).json({ success: false, message: 'לא נמצאה הזמנה ממתינה' });

  if (new Date(entry.expires_at.replace(' ', 'T') + 'Z') < new Date()) {
    return res.status(400).json({ success: false, message: 'הזמן לאישור פג — ניתן לחזור לרשימת המתנה' });
  }

  const conflict = db.prepare(`
    SELECT id FROM appointments
    WHERE worker_id = ? AND start_time = ? AND status IN ('pending', 'confirmed')
  `).get(entry.worker_id, entry.slot_time);
  if (conflict) return res.status(409).json({ success: false, message: 'השעה כבר נתפסה מחדש' });

  const endTime = new Date(new Date(entry.slot_time).getTime() + entry.duration_minutes * 60000)
    .toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
  const result = db.prepare(`
    INSERT INTO appointments (business_id, customer_id, worker_id, service_id, start_time, end_time, status)
    VALUES (?, ?, ?, ?, ?, ?, 'confirmed')
  `).run(entry.business_id, entry.customer_id, entry.worker_id, entry.service_id, entry.slot_time, endTime);

  db.prepare("UPDATE waiting_list SET status = 'confirmed' WHERE id = ?").run(id);

  sendAppointmentConfirmed({
    customerEmail: entry.customer_email,
    customerName: entry.customer_name,
    workerName: entry.worker_name || '',
    serviceName: entry.service_name,
    dateTime: formatDateTime(entry.slot_time),
  });

  const appointment = db.prepare(`
    SELECT a.id, a.start_time, s.name AS service_name, u.name AS worker_name
    FROM appointments a
    JOIN services s ON a.service_id = s.id
    LEFT JOIN users u ON a.worker_id = u.id
    WHERE a.id = ?
  `).get(result.lastInsertRowid);

  return res.json({ success: true, message: 'התור אושר בהצלחה!', appointment });
};

const getBusinessPolicy = (req, res) => {
  const db = getDb();
  const business = db.prepare('SELECT cancellation_hours FROM businesses WHERE id = ?').get(req.user.business_id);
  if (!business) return res.status(404).json({ success: false, message: 'עסק לא נמצא' });
  res.json({ success: true, cancellation_hours: business.cancellation_hours || 0 });
};

module.exports = { getServices, getWorkers, getSlots, getAvailableDays, bookAppointment, getMyAppointments, cancelAppointment, acceptReschedule, addToWaitlist, getMyWaitlist, cancelWaitlistEntry, confirmWaitlistEntry, confirmWaitlistEntryInApp, getBusinessPolicy };
