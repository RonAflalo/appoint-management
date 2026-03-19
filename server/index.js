require('dotenv').config();
const { initializeDatabase } = require('./db/database');
const { verifyEmailConnection } = require('./services/emailService');
const { startReminderJob } = require('./services/reminderService');
const { startWaitlistJob } = require('./services/waitlistService');
const { startCompletionJob } = require('./services/completionService');
const { startRecurringJob } = require('./services/recurringService');
const app = require('./app');

const PORT = process.env.PORT || 3001;

initializeDatabase();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  verifyEmailConnection();
  if (process.env.NODE_ENV !== 'test') {
    startReminderJob();
    startWaitlistJob();
    startCompletionJob();
    startRecurringJob();
  }
});
