const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getServices, getWorkers, getSlots, getAvailableDays, bookAppointment, getMyAppointments, cancelAppointment, acceptReschedule } = require('../controllers/userController');

router.get('/services', getServices);
router.get('/workers', getWorkers);
router.get('/slots', getSlots);
router.get('/available-days', getAvailableDays);

router.post('/appointments', authenticate, bookAppointment);
router.get('/appointments/mine', authenticate, getMyAppointments);
router.put('/appointments/:id/cancel', authenticate, cancelAppointment);
router.put('/appointments/:id/accept-reschedule', authenticate, acceptReschedule);

module.exports = router;
