const bcrypt = require('bcryptjs');
const { getDb } = require('../db/database');
const { sendAppointmentConfirmed, sendAppointmentCancelled, sendRescheduleRequest } = require('../services/emailService');
const { formatDateTime } = require('../utils/dateFormat');
const { notifyNextInQueue } = require('../utils/waitlist');

// ---- Workers ----

const getWorkers = (req, res) => {
  const db = getDb();
  const workers = db.prepare(`
    SELECT id, name, email, role, is_worker, is_active, created_at
    FROM users
    WHERE (role = 'worker' OR role = 'admin') AND business_id = ?
    ORDER BY role DESC, created_at DESC
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
  const worker = db.prepare('SELECT id FROM users WHERE id = ? AND (role = ? OR role = ?) AND business_id = ?').get(id, 'worker', 'admin', req.user.business_id);
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
  const worker = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'worker' AND business_id = ?").get(id, req.user.business_id);
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
      a.suggested_time, a.reschedule_note,
      c.id AS customer_id, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
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
  const appt = db.prepare(`
    SELECT a.id, a.start_time, a.end_time, a.status AS old_status,
           c.name AS customer_name, c.email AS customer_email,
           w.name AS worker_name, s.name AS service_name
    FROM appointments a
    JOIN users c ON a.customer_id = c.id
    JOIN users w ON a.worker_id = w.id
    JOIN services s ON a.service_id = s.id
    WHERE a.id = ? AND a.business_id = ?
  `).get(id, req.user.business_id);
  if (!appt) return res.status(404).json({ success: false, message: 'תור לא נמצא' });

  // Cannot mark a future appointment as completed
  if (status === 'completed') {
    const israelNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
    const endTime = new Date(appt.end_time.replace(' ', 'T'));
    if (endTime > israelNow) {
      return res.status(400).json({ success: false, message: 'לא ניתן לסמן תור עתידי כהושלם' });
    }
  }

  // Cannot reactivate a cancelled appointment
  if (appt.old_status === 'cancelled' && ['pending', 'confirmed'].includes(status)) {
    return res.status(400).json({ success: false, message: 'לא ניתן להפעיל מחדש תור שבוטל' });
  }

  db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(status, id);

  const emailData = {
    customerEmail: appt.customer_email,
    customerName: appt.customer_name,
    workerName: appt.worker_name,
    serviceName: appt.service_name,
    dateTime: formatDateTime(appt.start_time),
  };
  if (status === 'confirmed') sendAppointmentConfirmed(emailData);
  if (status === 'cancelled') {
    sendAppointmentCancelled({ ...emailData, cancelledBy: 'admin' });
    const fullAppt = db.prepare('SELECT business_id, service_id, worker_id, start_time FROM appointments WHERE id = ?').get(id);
    notifyNextInQueue({ businessId: fullAppt.business_id, serviceId: fullAppt.service_id, slotTime: fullAppt.start_time, workerId: fullAppt.worker_id })
      .catch(err => console.error('[Waitlist] notifyNextInQueue failed after admin cancel:', err));
  }

  res.json({ success: true, message: 'הסטטוס עודכן' });
};

const requestReschedule = (req, res) => {
  const { id } = req.params;
  const { suggested_time, note } = req.body;
  if (!suggested_time) {
    return res.status(400).json({ success: false, message: 'יש לציין זמן מוצע' });
  }

  const db = getDb();
  const appt = db.prepare(`
    SELECT a.id, a.status, a.start_time,
           c.name AS customer_name, c.email AS customer_email,
           w.name AS worker_name, s.name AS service_name
    FROM appointments a
    JOIN users c ON a.customer_id = c.id
    JOIN users w ON a.worker_id = w.id
    JOIN services s ON a.service_id = s.id
    WHERE a.id = ? AND a.business_id = ?
  `).get(id, req.user.business_id);

  if (!appt) return res.status(404).json({ success: false, message: 'תור לא נמצא' });
  if (appt.status !== 'confirmed') {
    return res.status(400).json({ success: false, message: 'ניתן לבקש שינוי מועד רק לתורים מאושרים' });
  }

  db.prepare(`
    UPDATE appointments SET status = 'reschedule_requested', suggested_time = ?, reschedule_note = ?
    WHERE id = ?
  `).run(suggested_time, note || null, id);

  sendRescheduleRequest({
    customerEmail: appt.customer_email,
    customerName: appt.customer_name,
    workerName: appt.worker_name,
    serviceName: appt.service_name,
    dateTime: formatDateTime(appt.start_time),
    suggestedTime: formatDateTime(suggested_time),
    rescheduleNote: note || null,
  });

  res.json({ success: true, message: 'בקשת שינוי המועד נשלחה ללקוח' });
};

// ---- Admin as worker toggle ----

const toggleAdminAsWorker = (req, res) => {
  const db = getDb();
  const admin = db.prepare("SELECT id, is_worker FROM users WHERE id = ? AND role = 'admin' AND business_id = ?").get(req.user.id, req.user.business_id);
  if (!admin) return res.status(404).json({ success: false, message: 'משתמש לא נמצא' });
  const newVal = admin.is_worker ? 0 : 1;
  db.prepare('UPDATE users SET is_worker = ? WHERE id = ?').run(newVal, req.user.id);
  res.json({ success: true, is_worker: newVal });
};

// ---- Worker Availability (read-only for admin) ----

const getWorkerAvailability = (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const worker = db.prepare('SELECT id, name FROM users WHERE id = ? AND (role = ? OR role = ?) AND business_id = ?').get(id, 'worker', 'admin', req.user.business_id);
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
  const { name, address, working_hours, description, logo_url, cover_url, phone, instagram_url, facebook_url, cancellation_hours } = req.body;
  const db = getDb();
  const business = db.prepare('SELECT id FROM businesses WHERE id = ?').get(req.user.business_id);
  if (!business) return res.status(404).json({ success: false, message: 'עסק לא נמצא' });

  const workingHoursJson = working_hours ? JSON.stringify(working_hours) : null;
  const cancelHours = cancellation_hours !== undefined ? Number(cancellation_hours) : null;

  db.prepare(`
    UPDATE businesses SET
      name = COALESCE(?, name),
      address = COALESCE(?, address),
      working_hours_json = COALESCE(?, working_hours_json),
      description = COALESCE(?, description),
      logo_url = COALESCE(?, logo_url),
      cover_url = COALESCE(?, cover_url),
      phone = COALESCE(?, phone),
      instagram_url = COALESCE(?, instagram_url),
      facebook_url = COALESCE(?, facebook_url),
      cancellation_hours = COALESCE(?, cancellation_hours)
    WHERE id = ?
  `).run(
    name ?? null, address ?? null, workingHoursJson,
    description ?? null, logo_url ?? null, cover_url ?? null,
    phone ?? null, instagram_url ?? null, facebook_url ?? null,
    cancelHours,
    req.user.business_id
  );

  const updated = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.user.business_id);
  updated.working_hours = JSON.parse(updated.working_hours_json);
  res.json({ success: true, business: updated });
};

const getAnalytics = (req, res) => {
  const db = getDb();
  const businessId = req.user.business_id;

  // Monthly revenue — last 6 months (completed + confirmed appointments)
  const monthlyRevenue = db.prepare(`
    SELECT
      strftime('%Y-%m', a.start_time) AS month,
      SUM(s.price) AS revenue,
      COUNT(a.id) AS count
    FROM appointments a
    JOIN services s ON a.service_id = s.id
    WHERE a.business_id = ?
      AND a.status IN ('completed', 'confirmed')
      AND a.start_time >= date('now', '-6 months')
    GROUP BY month
    ORDER BY month ASC
  `).all(businessId);

  // Busiest hours (appointments by hour of day)
  const busiestHours = db.prepare(`
    SELECT
      CAST(strftime('%H', a.start_time) AS INTEGER) AS hour,
      COUNT(*) AS count
    FROM appointments a
    WHERE a.business_id = ?
      AND a.status NOT IN ('cancelled')
    GROUP BY hour
    ORDER BY hour ASC
  `).all(businessId);

  // Top services by appointment count
  const topServices = db.prepare(`
    SELECT
      s.name,
      COUNT(a.id) AS count,
      SUM(s.price) AS revenue
    FROM appointments a
    JOIN services s ON a.service_id = s.id
    WHERE a.business_id = ?
      AND a.status NOT IN ('cancelled')
    GROUP BY s.id
    ORDER BY count DESC
    LIMIT 5
  `).all(businessId);

  // Customer retention: new vs returning (customers with >1 appointment)
  const customerStats = db.prepare(`
    SELECT
      COUNT(DISTINCT customer_id) AS total_customers,
      COUNT(DISTINCT CASE WHEN appt_count > 1 THEN customer_id END) AS returning_customers
    FROM (
      SELECT customer_id, COUNT(*) AS appt_count
      FROM appointments
      WHERE business_id = ? AND status NOT IN ('cancelled')
      GROUP BY customer_id
    )
  `).get(businessId);

  // Total revenue all time
  const totals = db.prepare(`
    SELECT
      COUNT(*) AS total_appointments,
      SUM(s.price) AS total_revenue
    FROM appointments a
    JOIN services s ON a.service_id = s.id
    WHERE a.business_id = ? AND a.status IN ('completed', 'confirmed')
  `).get(businessId);

  res.json({
    success: true,
    monthlyRevenue,
    busiestHours,
    topServices,
    customerStats,
    totals,
  });
};

const uploadImage = (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'לא נמצא קובץ' });
  res.json({ success: true, url: `/uploads/${req.file.filename}` });
};

// ---- Customers ----

const getCustomers = (req, res) => {
  const db = getDb();
  const customers = db.prepare(`
    SELECT
      u.id, u.name, u.email, u.phone, u.created_at, u.email_verified,
      COUNT(a.id) AS appointment_count,
      MAX(a.start_time) AS last_appointment
    FROM users u
    LEFT JOIN appointments a ON a.customer_id = u.id AND a.business_id = ?
    WHERE u.role = 'user' AND u.business_id = ? AND u.is_active = 1
    GROUP BY u.id
    ORDER BY u.name ASC
  `).all(req.user.business_id, req.user.business_id);
  res.json({ success: true, customers });
};

const getCustomerDetail = (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const customer = db.prepare(`
    SELECT id, name, email, phone, created_at, email_verified, admin_notes
    FROM users
    WHERE id = ? AND business_id = ? AND role = 'user' AND is_active = 1
  `).get(id, req.user.business_id);
  if (!customer) return res.status(404).json({ success: false, message: 'לקוח לא נמצא' });

  const appointments = db.prepare(`
    SELECT
      a.id, a.start_time, a.end_time, a.status, a.notes, a.created_at,
      s.name AS service_name, s.price,
      w.name AS worker_name
    FROM appointments a
    JOIN services s ON a.service_id = s.id
    JOIN users w ON a.worker_id = w.id
    WHERE a.customer_id = ? AND a.business_id = ?
    ORDER BY a.start_time DESC
  `).all(id, req.user.business_id);

  res.json({ success: true, customer, appointments });
};

const updateCustomerNotes = (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { notes } = req.body;
  const result = db.prepare(`
    UPDATE users SET admin_notes = ?
    WHERE id = ? AND business_id = ? AND role = 'user'
  `).run(notes ?? null, id, req.user.business_id);
  if (result.changes === 0) return res.status(404).json({ success: false, message: 'לקוח לא נמצא' });
  res.json({ success: true });
};

// ---- Onboarding ----

const completeOnboarding = (req, res) => {
  const db = getDb();
  db.prepare('UPDATE businesses SET onboarding_complete = 1 WHERE id = ?').run(req.user.business_id);
  res.json({ success: true, message: 'האונבורדינג הושלם' });
};

// ---- Workers Calendar ----

const getWorkersCalendar = (req, res) => {
  const { year, month } = req.query;
  if (!year || !month) {
    return res.status(400).json({ success: false, message: 'יש לציין שנה וחודש' });
  }

  const db = getDb();
  const yearNum = parseInt(year);
  const monthNum = parseInt(month); // 1-12

  const business = db.prepare('SELECT working_hours_json FROM businesses WHERE id = ?').get(req.user.business_id);
  const workingHours = JSON.parse(business.working_hours_json);

  const workers = db.prepare(`
    SELECT id, name FROM users
    WHERE (role = 'worker' OR (role = 'admin' AND is_worker = 1)) AND business_id = ? AND is_active = 1
    ORDER BY name
  `).all(req.user.business_id);

  if (workers.length === 0) {
    return res.json({ success: true, days: {}, workers: [] });
  }

  const monthStr = String(monthNum).padStart(2, '0');
  const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
  const startDate = `${year}-${monthStr}-01`;
  const endDate = `${year}-${monthStr}-${String(daysInMonth).padStart(2, '0')}`;
  const workerIds = workers.map(w => w.id);
  const placeholders = workerIds.map(() => '?').join(',');

  const overrides = db.prepare(`
    SELECT worker_id, date, is_blocked, custom_start, custom_end
    FROM availability_overrides
    WHERE worker_id IN (${placeholders}) AND date >= ? AND date <= ?
  `).all(...workerIds, startDate, endDate);

  const apptRows = db.prepare(`
    SELECT worker_id, date(start_time) AS date, COUNT(*) AS count
    FROM appointments
    WHERE worker_id IN (${placeholders})
      AND date(start_time) >= ? AND date(start_time) <= ?
      AND status IN ('pending', 'confirmed')
    GROUP BY worker_id, date(start_time)
  `).all(...workerIds, startDate, endDate);

  // Build lookup maps
  const overrideMap = {};
  for (const o of overrides) overrideMap[`${o.worker_id}_${o.date}`] = o;

  const apptMap = {};
  for (const a of apptRows) apptMap[`${a.worker_id}_${a.date}`] = a.count;

  const days = {};
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${monthStr}-${String(day).padStart(2, '0')}`;
    const dayOfWeek = new Date(dateStr + 'T00:00:00').getDay();
    const isBusinessOpen = !!workingHours[String(dayOfWeek)];

    days[dateStr] = {
      isBusinessOpen,
      workers: workers.map(w => {
        const ov = overrideMap[`${w.id}_${dateStr}`];
        let status;
        if (!isBusinessOpen)                             status = 'business_closed';
        else if (ov?.is_blocked)                         status = 'blocked';
        else if (ov?.custom_start && ov?.custom_end)     status = 'custom_hours';
        else                                             status = 'available';

        return {
          id: w.id,
          name: w.name,
          status,
          appointmentCount: (status === 'available' || status === 'custom_hours')
            ? (apptMap[`${w.id}_${dateStr}`] || 0)
            : 0,
          customStart: ov?.custom_start || null,
          customEnd:   ov?.custom_end   || null,
        };
      }),
    };
  }

  res.json({ success: true, days, workers });
};

const getWorkersDayDetail = (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ success: false, message: 'יש לציין תאריך' });

  const db = getDb();
  const business = db.prepare('SELECT working_hours_json FROM businesses WHERE id = ?').get(req.user.business_id);
  const workingHours = JSON.parse(business.working_hours_json);

  const workers = db.prepare(`
    SELECT id, name FROM users
    WHERE (role = 'worker' OR (role = 'admin' AND is_worker = 1)) AND business_id = ? AND is_active = 1
    ORDER BY name
  `).all(req.user.business_id);

  if (workers.length === 0) {
    return res.json({ success: true, date, isBusinessOpen: false, workers: [] });
  }

  const dayOfWeek = new Date(date + 'T00:00:00').getDay();
  const isBusinessOpen = !!workingHours[String(dayOfWeek)];
  const workerIds = workers.map(w => w.id);
  const placeholders = workerIds.map(() => '?').join(',');

  const overrides = db.prepare(`
    SELECT * FROM availability_overrides
    WHERE worker_id IN (${placeholders}) AND date = ?
  `).all(...workerIds, date);

  const appointments = db.prepare(`
    SELECT
      a.id, a.start_time, a.end_time, a.status, a.notes, a.worker_id,
      c.name AS customer_name, c.email AS customer_email,
      s.name AS service_name, s.duration_minutes, s.price
    FROM appointments a
    JOIN users c ON a.customer_id = c.id
    JOIN services s ON a.service_id = s.id
    WHERE a.worker_id IN (${placeholders})
      AND date(a.start_time) = ?
      AND a.status NOT IN ('cancelled')
    ORDER BY a.start_time ASC
  `).all(...workerIds, date);

  const overrideByWorker = {};
  for (const o of overrides) overrideByWorker[o.worker_id] = o;

  const apptByWorker = {};
  for (const a of appointments) {
    (apptByWorker[a.worker_id] ??= []).push(a);
  }

  const workersDetail = workers.map(w => {
    const ov = overrideByWorker[w.id];
    let status;
    if (!isBusinessOpen)                         status = 'business_closed';
    else if (ov?.is_blocked)                     status = 'blocked';
    else if (ov?.custom_start && ov?.custom_end) status = 'custom_hours';
    else                                         status = 'available';

    return {
      id: w.id, name: w.name, status,
      customStart:   ov?.custom_start || null,
      customEnd:     ov?.custom_end   || null,
      appointments:  apptByWorker[w.id] || [],
    };
  });

  res.json({ success: true, date, isBusinessOpen, workers: workersDetail });
};

module.exports = {
  getWorkers, createWorker, updateWorker, deleteWorker,
  toggleAdminAsWorker,
  getWorkerAvailability,
  getWorkersCalendar, getWorkersDayDetail,
  getServices, createService, updateService, deleteService,
  getAppointments, updateAppointmentStatus, requestReschedule,
  getSettings, updateSettings, uploadImage,
  getCustomers, getCustomerDetail, updateCustomerNotes,
  completeOnboarding,
  getAnalytics,
};
