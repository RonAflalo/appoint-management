const cron = require('node-cron');
const { getDb } = require('../db/database');
const { sendReminderEmail } = require('./emailService');
const { sendAppointmentReminderSms } = require('./smsService');
const { formatDateTime } = require('../utils/dateFormat');

async function sendReminders() {
  const db = getDb();
  const now = new Date();
  const windowStart = new Date(now.getTime() + 23.5 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 24.5 * 60 * 60 * 1000);

  // Format as Israeli local time to match how start_time is stored in the DB
  const toIso = d => {
    const local = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
    const pad = n => String(n).padStart(2, '0');
    return `${local.getFullYear()}-${pad(local.getMonth()+1)}-${pad(local.getDate())} ${pad(local.getHours())}:${pad(local.getMinutes())}:${pad(local.getSeconds())}`;
  };

  const appointments = db.prepare(`
    SELECT
      a.id, a.start_time,
      c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
      w.name AS worker_name,
      s.name AS service_name
    FROM appointments a
    JOIN users c ON a.customer_id = c.id
    JOIN users w ON a.worker_id = w.id
    JOIN services s ON a.service_id = s.id
    WHERE a.status IN ('pending', 'confirmed')
      AND a.reminder_sent = 0
      AND a.start_time >= ?
      AND a.start_time < ?
  `).all(toIso(windowStart), toIso(windowEnd));

  for (const appt of appointments) {
    const dateTime = formatDateTime(appt.start_time);

    // Email reminder
    sendReminderEmail({
      customerEmail: appt.customer_email,
      customerName: appt.customer_name,
      workerName: appt.worker_name,
      serviceName: appt.service_name,
      dateTime,
    });

    // WhatsApp / SMS reminder (if customer has a phone number)
    if (appt.customer_phone) {
      await sendAppointmentReminderSms({
        customerPhone: appt.customer_phone,
        customerName: appt.customer_name,
        workerName: appt.worker_name,
        serviceName: appt.service_name,
        dateTime,
      });
    }

    db.prepare('UPDATE appointments SET reminder_sent = 1 WHERE id = ?').run(appt.id);
    console.log(`[Reminder] Sent to ${appt.customer_email} for appointment ${appt.id}`);
  }
}

function startReminderJob() {
  // Run every hour
  cron.schedule('0 * * * *', () => {
    console.log('[Reminder] Running hourly reminder check...');
    sendReminders();
  });
  // Also run once immediately on startup
  console.log('[Reminder] Running initial check on startup...');
  sendReminders();
  console.log('[Reminder] Reminder cron job started.');
}

module.exports = { startReminderJob, sendReminders };
