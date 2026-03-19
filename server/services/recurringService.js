const cron = require('node-cron');
const { getDb } = require('../db/database');

function israelNow() {
  const local = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
  const pad = n => String(n).padStart(2, '0');
  return `${local.getFullYear()}-${pad(local.getMonth()+1)}-${pad(local.getDate())} ${pad(local.getHours())}:${pad(local.getMinutes())}:${pad(local.getSeconds())}`;
}

function israelToday() {
  return israelNow().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function getDatesForDayOfWeek(startDate, endDate, dayOfWeek) {
  const dates = [];
  let current = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  while (current.getDay() !== dayOfWeek && current <= end) {
    current.setDate(current.getDate() + 1);
  }
  const pad = n => String(n).padStart(2, '0');
  while (current <= end) {
    dates.push(`${current.getFullYear()}-${pad(current.getMonth()+1)}-${pad(current.getDate())}`);
    current.setDate(current.getDate() + 7);
  }
  return dates;
}

function generateAppointmentsForRule(rule, db, weeksAhead = 8) {
  const today = israelToday();
  const startDate = rule.start_date > today ? rule.start_date : today;
  const maxEnd = addDays(today, weeksAhead * 7);
  const endDate = rule.end_date && rule.end_date < maxEnd ? rule.end_date : maxEnd;
  if (startDate > endDate) return 0;

  const service = db.prepare('SELECT * FROM services WHERE id = ?').get(rule.service_id);
  if (!service) return 0;

  const dates = getDatesForDayOfWeek(startDate, endDate, rule.day_of_week);
  let count = 0;

  for (const date of dates) {
    const startTimeStr = `${date} ${rule.time}:00`;

    const exists = db.prepare('SELECT id FROM appointments WHERE recurring_rule_id = ? AND start_time = ?').get(rule.id, startTimeStr);
    if (exists) continue;

    const startMs = new Date(`${date}T${rule.time}:00`).getTime();
    const endMs = startMs + service.duration_minutes * 60000;
    const pad = n => String(n).padStart(2, '0');
    const endDate2 = new Date(endMs);
    const endTimeStr = `${endDate2.getFullYear()}-${pad(endDate2.getMonth()+1)}-${pad(endDate2.getDate())} ${pad(endDate2.getHours())}:${pad(endDate2.getMinutes())}:00`;

    const conflict = db.prepare(`
      SELECT id FROM appointments
      WHERE worker_id = ? AND status IN ('pending', 'confirmed')
        AND start_time < ? AND end_time > ?
    `).get(rule.worker_id, endTimeStr, startTimeStr);
    if (conflict) continue;

    db.prepare(`
      INSERT INTO appointments (business_id, customer_id, worker_id, service_id, start_time, end_time, status, recurring_rule_id)
      VALUES (?, ?, ?, ?, ?, ?, 'confirmed', ?)
    `).run(rule.business_id, rule.customer_id, rule.worker_id, rule.service_id, startTimeStr, endTimeStr, rule.id);
    count++;
  }
  return count;
}

function generateAllRecurringAppointments() {
  const db = getDb();
  const rules = db.prepare('SELECT * FROM recurring_rules WHERE is_active = 1').all();
  let total = 0;
  for (const rule of rules) {
    total += generateAppointmentsForRule(rule, db);
  }
  console.log(`[Recurring] Generated ${total} appointments`);
  return total;
}

function startRecurringJob() {
  cron.schedule('0 3 * * 1', () => {
    console.log('[Recurring] Weekly generation run');
    generateAllRecurringAppointments();
  });
  generateAllRecurringAppointments();
  console.log('[Recurring] Job started');
}

module.exports = { generateAppointmentsForRule, generateAllRecurringAppointments, startRecurringJob };
