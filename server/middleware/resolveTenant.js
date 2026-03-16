const { getDb } = require('../db/database');

function resolveTenant(req, res, next) {
  const slug = req.params.slug || req.query.tenant;

  if (!slug) {
    return res.status(400).json({ success: false, message: 'חסר מזהה עסק (slug)' });
  }

  const db = getDb();
  const business = db.prepare('SELECT * FROM businesses WHERE slug = ?').get(slug);

  if (!business) {
    return res.status(404).json({ success: false, message: 'עסק לא נמצא' });
  }

  req.business = business;
  next();
}

module.exports = resolveTenant;
