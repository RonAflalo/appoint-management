const express = require('express');
const router = express.Router({ mergeParams: true });
const resolveTenant = require('../middleware/resolveTenant');
const { getBusinessInfo, getPublicServices, getPublicWorkers, getPublicSlots, getPublicAvailableDays, publicBook } = require('../controllers/publicController');

router.get('/check-slug', (req, res) => {
  const { slug } = req.query;
  if (!slug) return res.status(400).json({ available: false, message: 'חסר slug' });
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) || slug.length < 3) {
    return res.json({ available: false, message: 'הכתובת אינה תקינה — רק אותיות אנגליות קטנות, מספרים ומקפים (לפחות 3 תווים)' });
  }
  const { getDb } = require('../db/database');
  const db = getDb();
  const existing = db.prepare('SELECT id FROM businesses WHERE slug = ?').get(slug);
  return res.json({ available: !existing, message: existing ? 'כתובת זו תפוסה' : 'הכתובת פנויה!' });
});

router.get('/:slug/info', resolveTenant, getBusinessInfo);
router.get('/:slug/services', resolveTenant, getPublicServices);
router.get('/:slug/workers', resolveTenant, getPublicWorkers);
router.get('/:slug/slots', resolveTenant, getPublicSlots);
router.get('/:slug/available-days', resolveTenant, getPublicAvailableDays);
router.post('/:slug/book', resolveTenant, publicBook);

module.exports = router;
