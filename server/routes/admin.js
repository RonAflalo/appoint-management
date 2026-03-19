const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
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
} = require('../controllers/adminController');

router.use(authenticate, authorize('admin'));

router.get('/workers', getWorkers);
router.post('/workers', createWorker);
router.patch('/me/worker-toggle', toggleAdminAsWorker);
router.put('/workers/:id', updateWorker);
router.delete('/workers/:id', deleteWorker);
router.get('/workers/:id/availability', getWorkerAvailability);

router.get('/services', getServices);
router.post('/services', createService);
router.put('/services/:id', updateService);
router.delete('/services/:id', deleteService);

router.get('/appointments', getAppointments);
router.put('/appointments/:id/status', updateAppointmentStatus);
router.post('/appointments/:id/reschedule', requestReschedule);

router.get('/settings', getSettings);
router.put('/settings', updateSettings);
router.post('/upload', upload.single('image'), uploadImage);

router.get('/workers-calendar', getWorkersCalendar);
router.get('/workers-calendar/day', getWorkersDayDetail);

router.get('/customers', getCustomers);
router.get('/customers/:id', getCustomerDetail);
router.put('/customers/:id/notes', updateCustomerNotes);
router.post('/onboarding/complete', completeOnboarding);
router.get('/analytics', getAnalytics);

router.post('/test/run-reminders', async (req, res) => {
  const { sendReminders } = require('../services/reminderService');
  await sendReminders();
  res.json({ ok: true, message: 'Reminder check triggered' });
});

module.exports = router;
