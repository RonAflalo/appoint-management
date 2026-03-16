const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getAppointments, updateAppointmentStatus, getAvailability, setAvailability } = require('../controllers/workerController');

router.use(authenticate, authorize('worker'));

router.get('/appointments', getAppointments);
router.put('/appointments/:id/status', updateAppointmentStatus);
router.get('/availability', getAvailability);
router.post('/availability', setAvailability);

module.exports = router;
