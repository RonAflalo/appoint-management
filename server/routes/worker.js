const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getAppointments,
  approveAppointment,
  cancelAppointment,
  requestReschedule,
  updateAppointmentStatus,
  getAvailability,
  setAvailability,
} = require('../controllers/workerController');

router.use(authenticate, authorize('worker'));

router.get('/appointments', getAppointments);
router.put('/appointments/:id/status', updateAppointmentStatus);
router.put('/appointments/:id/approve', approveAppointment);
router.put('/appointments/:id/cancel', cancelAppointment);
router.put('/appointments/:id/reschedule-request', requestReschedule);
router.get('/availability', getAvailability);
router.post('/availability', setAvailability);

module.exports = router;
