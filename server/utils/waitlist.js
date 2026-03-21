const crypto = require('crypto');
const { getDb } = require('../db/database');
const { sendWaitlistAvailable } = require('../services/emailService');
const { notifyAdminAndWorker } = require('../services/notificationService');

// Normalize to the same format stored in appointments ("YYYY-MM-DD HH:MM:SS")
function normalizeSlotTime(t) {
  return new Date(t).toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
}

async function notifyNextInQueue({ businessId, serviceId, slotTime, workerId }) {
  const db = getDb();

  // Normalize format so it matches what's stored in waiting_list
  const normalizedSlot = normalizeSlotTime(slotTime);

  const next = db.prepare(`
    SELECT wl.id, wl.customer_id, u.name AS customer_name, u.email AS customer_email
    FROM waiting_list wl
    JOIN users u ON wl.customer_id = u.id
    WHERE wl.business_id = ? AND wl.service_id = ? AND wl.slot_time = ?
      AND wl.status = 'waiting'
      AND (wl.worker_id IS NULL OR wl.worker_id = ?)
    ORDER BY wl.created_at ASC
    LIMIT 1
  `).get(businessId, serviceId, normalizedSlot, workerId);

  if (!next) return;

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');

  db.prepare(`
    UPDATE waiting_list
    SET status = 'notified', notify_token = ?, notified_at = datetime('now'), expires_at = ?, worker_id = ?
    WHERE id = ?
  `).run(token, expiresAt, workerId, next.id);

  const service = db.prepare('SELECT name FROM services WHERE id = ?').get(serviceId);
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  await sendWaitlistAvailable({
    customerEmail: next.customer_email,
    customerName: next.customer_name,
    serviceName: service?.name || '',
    slotTime: normalizedSlot,
    confirmUrl: `${clientUrl}/waitlist/confirm/${token}`,
  });

  notifyAdminAndWorker(businessId, workerId || null, 'waitlist_opened', `מקום פנוי ברשימת המתנה, ${next.customer_name} קיבל התראה - ${service?.name || ''}`);
}

async function expireAndAdvance() {
  const db = getDb();

  const expired = db.prepare(`
    SELECT wl.id, wl.business_id, wl.service_id, wl.slot_time, wl.worker_id
    FROM waiting_list wl
    WHERE wl.status = 'notified' AND wl.expires_at < datetime('now')
  `).all();

  for (const entry of expired) {
    db.prepare("UPDATE waiting_list SET status = 'expired' WHERE id = ?").run(entry.id);
    await notifyNextInQueue({
      businessId: entry.business_id,
      serviceId: entry.service_id,
      slotTime: entry.slot_time,
      workerId: entry.worker_id,
    });
  }
}

module.exports = { notifyNextInQueue, expireAndAdvance };
