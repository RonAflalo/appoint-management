/**
 * Auto-completion cron job.
 * Runs every hour and marks past confirmed/pending appointments as 'completed'.
 * This keeps the admin dashboard accurate without manual intervention.
 */

const cron = require('node-cron');
const { getDb } = require('../db/database');

function completePassedAppointments() {
  const db = getDb();
  // Use Israeli local time to match how end_time is stored in the DB
  const localDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
  const pad = n => String(n).padStart(2, '0');
  const now = `${localDate.getFullYear()}-${pad(localDate.getMonth()+1)}-${pad(localDate.getDate())} ${pad(localDate.getHours())}:${pad(localDate.getMinutes())}:${pad(localDate.getSeconds())}`;

  const result = db.prepare(`
    UPDATE appointments
    SET status = 'completed'
    WHERE status = 'confirmed'
      AND end_time < ?
  `).run(now);

  if (result.changes > 0) {
    console.log(`[Completion] Marked ${result.changes} past appointment(s) as completed.`);
  }
}

function startCompletionJob() {
  // Run every hour at minute 5 (offset from reminder job at minute 0)
  cron.schedule('5 * * * *', () => {
    console.log('[Completion] Running auto-completion check...');
    completePassedAppointments();
  });
  // Also run once on startup to catch any missed completions
  completePassedAppointments();
  console.log('[Completion] Auto-completion job started.');
}

module.exports = { startCompletionJob, completePassedAppointments };
