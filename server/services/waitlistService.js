const cron = require('node-cron');
const { expireAndAdvance } = require('../utils/waitlist');

function startWaitlistJob() {
  // Run every minute to catch expiring 30-min windows
  cron.schedule('* * * * *', async () => {
    try {
      await expireAndAdvance();
    } catch (err) {
      console.error('[Waitlist] Error in expiry check:', err);
    }
  });
  console.log('[Waitlist] Waitlist expiry cron job started.');
}

module.exports = { startWaitlistJob };
