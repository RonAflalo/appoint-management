const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getServices, getWorkers, getSlots, getAvailableDays, bookAppointment, getMyAppointments, cancelAppointment, acceptReschedule, addToWaitlist, getMyWaitlist, cancelWaitlistEntry, confirmWaitlistEntry, confirmWaitlistEntryInApp, getBusinessPolicy } = require('../controllers/userController');

router.get('/services', getServices);
router.get('/workers', getWorkers);
router.get('/slots', getSlots);
router.get('/available-days', getAvailableDays);

router.post('/appointments', authenticate, bookAppointment);
router.get('/appointments/mine', authenticate, getMyAppointments);
router.put('/appointments/:id/cancel', authenticate, cancelAppointment);
router.put('/appointments/:id/accept-reschedule', authenticate, acceptReschedule);

router.post('/waitlist', authenticate, addToWaitlist);
router.get('/waitlist', authenticate, getMyWaitlist);
router.delete('/waitlist/:id', authenticate, cancelWaitlistEntry);
router.post('/waitlist/:id/confirm-in-app', authenticate, confirmWaitlistEntryInApp);
router.post('/waitlist/confirm/:token', confirmWaitlistEntry);

router.get('/business-policy', authenticate, getBusinessPolicy);

module.exports = router;
