/**
 * Auto-completion cron job.
 * Runs every hour and marks past confirmed/pending appointments as 'completed'.
 * This keeps the admin dashboard accurate without manual intervention.
 */

const cron = require('node-cron');
const { getDb } = require('../db/database');

function completePassedAppointments() {
  const db = getDb();
  const now = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');

  const result = db.prepare(`
    UPDATE appointments
    SET status = 'completed'
    WHERE status IN ('pending', 'confirmed')
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
