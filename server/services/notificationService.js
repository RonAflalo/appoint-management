const { getDb } = require('../db/database');

function createNotification(businessId, type, message, link = null, workerId = null) {
  try {
    const db = getDb();
    db.prepare(
      'INSERT INTO notifications (business_id, type, message, link, worker_id) VALUES (?, ?, ?, ?, ?)'
    ).run(businessId, type, message, link, workerId || null);
  } catch (_) {}
}

// Creates one admin notification + one for the specific worker
function notifyAdminAndWorker(businessId, workerId, type, message, adminLink = '/admin/appointments', workerLink = '/worker/appointments') {
  createNotification(businessId, type, message, adminLink, null);
  if (workerId) createNotification(businessId, type, message, workerLink, workerId);
}

module.exports = { createNotification, notifyAdminAndWorker };
