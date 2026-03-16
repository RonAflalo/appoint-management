const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getWorkers, createWorker, updateWorker, deleteWorker,
  getWorkerAvailability,
  getServices, createService, updateService, deleteService,
  getAppointments, updateAppointmentStatus,
  getSettings, updateSettings,
} = require('../controllers/adminController');

router.use(authenticate, authorize('admin'));

router.get('/workers', getWorkers);
router.post('/workers', createWorker);
router.put('/workers/:id', updateWorker);
router.delete('/workers/:id', deleteWorker);
router.get('/workers/:id/availability', getWorkerAvailability);

router.get('/services', getServices);
router.post('/services', createService);
router.put('/services/:id', updateService);
router.delete('/services/:id', deleteService);

router.get('/appointments', getAppointments);
router.put('/appointments/:id/status', updateAppointmentStatus);

router.get('/settings', getSettings);
router.put('/settings', updateSettings);

module.exports = router;
