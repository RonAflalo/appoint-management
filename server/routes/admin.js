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
  getStore, toggleStore, createProduct, updateProduct, deleteProduct,
  getCategories, createCategory, updateCategory, deleteCategory,
} = require('../controllers/adminController');

router.use(authenticate, authorize('admin'));

router.get('/workers', getWorkers);
router.post('/workers', createWorker);
router.patch('/me/worker-toggle', toggleAdminAsWorker);
router.put('/workers/:id', updateWorker);
router.delete('/workers/:id', deleteWorker);
router.get('/workers/:id/availability', getWorkerAvailability);

router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

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

router.get('/store', getStore);
router.post('/store/toggle', toggleStore);
router.post('/store/products', createProduct);
router.put('/store/products/:id', updateProduct);
router.delete('/store/products/:id', deleteProduct);

router.post('/ai-chat', async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ success: false, message: 'messages required' });
  }
  try {
    const { chat } = require('../services/aiService');
    const reply = await chat(messages, req.user.business_id);
    res.json({ success: true, reply });
  } catch (err) {
    console.error('[AI] Error:', err.message);
    res.status(500).json({ success: false, message: 'שגיאה בשירות ה-AI' });
  }
});

router.post('/test/run-reminders', async (req, res) => {
  const { sendReminders } = require('../services/reminderService');
  await sendReminders();
  res.json({ ok: true, message: 'Reminder check triggered' });
});

module.exports = router;
