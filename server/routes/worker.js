const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  getAppointments,
  approveAppointment,
  cancelAppointment,
  requestReschedule,
  updateAppointmentStatus,
  getAvailability,
  setAvailability,
  getAppointmentPhotos,
  addAppointmentPhoto,
  deleteAppointmentPhoto,
  getWorkerNotifications,
  markWorkerNotificationsSeen,
} = require('../controllers/workerController');

router.use(authenticate, authorize('worker'));

router.get('/appointments', getAppointments);
router.put('/appointments/:id/status', updateAppointmentStatus);
router.put('/appointments/:id/approve', approveAppointment);
router.put('/appointments/:id/cancel', cancelAppointment);
router.put('/appointments/:id/reschedule-request', requestReschedule);
router.get('/appointments/:id/photos', getAppointmentPhotos);
router.post('/appointments/:id/photos', upload.single('image'), addAppointmentPhoto);
router.delete('/appointments/:id/photos/:photoId', deleteAppointmentPhoto);
router.get('/availability', getAvailability);
router.post('/availability', setAvailability);

router.get('/notifications', getWorkerNotifications);
router.post('/notifications/seen', markWorkerNotificationsSeen);

module.exports = router;
