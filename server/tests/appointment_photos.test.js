/**
 * Tests for appointment photo uploads — admin and worker sides.
 * Not covered elsewhere in the test suite.
 */
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret-key';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const { initializeDatabase, closeDatabase, getDb } = require('../db/database');
const app = require('../app');
const { seedTestData } = require('./helpers');

// Minimal valid 1×1 PNG — same buffer used in admin_new_features tests
const TINY_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41,
  0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc,
  0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
  0x44, 0xae, 0x42, 0x60, 0x82,
]);

let ctx;

beforeAll(() => {
  initializeDatabase(':memory:');
  ctx = seedTestData();
});

afterAll(() => {
  closeDatabase();
});

function adminCookie() { return `token=${ctx.adminToken}`; }
function workerCookie() { return `token=${ctx.workerToken}`; }
function customerCookie() { return `token=${ctx.customerToken}`; }

function insertAppointment(startTime, status = 'confirmed') {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO appointments (business_id, customer_id, worker_id, service_id, start_time, end_time, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(ctx.businessId, ctx.customer.id, ctx.worker.id, ctx.service.id, startTime, startTime.replace('09:00', '09:30'), status);
  return result.lastInsertRowid;
}

// ─── Admin — appointment photos ───────────────────────────────────────────────

describe('Admin appointment photos', () => {
  let apptId;

  beforeAll(() => {
    apptId = insertAppointment('2030-06-20 09:00:00');
  });

  it('GET returns empty array before any uploads', async () => {
    const res = await request(app)
      .get(`/api/admin/appointments/${apptId}/photos`)
      .set('Cookie', adminCookie());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.photos).toEqual([]);
  });

  it('POST uploads a photo and returns it', async () => {
    const res = await request(app)
      .post(`/api/admin/appointments/${apptId}/photos`)
      .set('Cookie', adminCookie())
      .attach('image', TINY_PNG, { filename: 'haircut.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.photo.url).toMatch(/^\/uploads\//);
    expect(res.body.photo.id).toBeDefined();
  });

  it('GET returns the uploaded photo', async () => {
    const res = await request(app)
      .get(`/api/admin/appointments/${apptId}/photos`)
      .set('Cookie', adminCookie());
    expect(res.status).toBe(200);
    expect(res.body.photos.length).toBe(1);
    expect(res.body.photos[0].url).toMatch(/^\/uploads\//);
  });

  it('can upload multiple photos to one appointment', async () => {
    await request(app)
      .post(`/api/admin/appointments/${apptId}/photos`)
      .set('Cookie', adminCookie())
      .attach('image', TINY_PNG, { filename: 'result.png', contentType: 'image/png' });

    const res = await request(app)
      .get(`/api/admin/appointments/${apptId}/photos`)
      .set('Cookie', adminCookie());
    expect(res.body.photos.length).toBe(2);
  });

  it('DELETE removes a specific photo', async () => {
    const listRes = await request(app)
      .get(`/api/admin/appointments/${apptId}/photos`)
      .set('Cookie', adminCookie());
    const photoId = listRes.body.photos[0].id;

    const deleteRes = await request(app)
      .delete(`/api/admin/appointments/${apptId}/photos/${photoId}`)
      .set('Cookie', adminCookie());
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);

    const afterRes = await request(app)
      .get(`/api/admin/appointments/${apptId}/photos`)
      .set('Cookie', adminCookie());
    expect(afterRes.body.photos.length).toBe(1);
    expect(afterRes.body.photos.find(p => p.id === photoId)).toBeUndefined();
  });

  it('DELETE returns 404 for non-existent photo', async () => {
    const res = await request(app)
      .delete(`/api/admin/appointments/${apptId}/photos/99999`)
      .set('Cookie', adminCookie());
    expect(res.status).toBe(404);
  });

  it('upload returns 400 when no file attached', async () => {
    const res = await request(app)
      .post(`/api/admin/appointments/${apptId}/photos`)
      .set('Cookie', adminCookie());
    expect(res.status).toBe(400);
  });

  it('customer cannot access admin photo endpoint', async () => {
    const res = await request(app)
      .get(`/api/admin/appointments/${apptId}/photos`)
      .set('Cookie', customerCookie());
    expect(res.status).toBe(403);
  });

  it('unauthenticated request is blocked', async () => {
    const res = await request(app)
      .get(`/api/admin/appointments/${apptId}/photos`);
    expect(res.status).toBe(401);
  });
});

// ─── Worker — appointment photos ──────────────────────────────────────────────

describe('Worker appointment photos', () => {
  let apptId;
  let otherApptId; // belongs to a different worker

  beforeAll(() => {
    apptId = insertAppointment('2030-07-01 10:00:00');

    // Appointment assigned to admin (different worker)
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO appointments (business_id, customer_id, worker_id, service_id, start_time, end_time, status)
      VALUES (?, ?, ?, ?, '2030-07-01 11:00:00', '2030-07-01 11:30:00', 'confirmed')
    `).run(ctx.businessId, ctx.customer.id, ctx.admin.id, ctx.service.id);
    otherApptId = result.lastInsertRowid;
  });

  it('GET returns empty array before any uploads', async () => {
    const res = await request(app)
      .get(`/api/worker/appointments/${apptId}/photos`)
      .set('Cookie', workerCookie());
    expect(res.status).toBe(200);
    expect(res.body.photos).toEqual([]);
  });

  it('POST uploads a photo', async () => {
    const res = await request(app)
      .post(`/api/worker/appointments/${apptId}/photos`)
      .set('Cookie', workerCookie())
      .attach('image', TINY_PNG, { filename: 'style.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    expect(res.body.photo.url).toMatch(/^\/uploads\//);
  });

  it('can upload multiple photos', async () => {
    await request(app)
      .post(`/api/worker/appointments/${apptId}/photos`)
      .set('Cookie', workerCookie())
      .attach('image', TINY_PNG, { filename: 'style2.png', contentType: 'image/png' });

    const res = await request(app)
      .get(`/api/worker/appointments/${apptId}/photos`)
      .set('Cookie', workerCookie());
    expect(res.body.photos.length).toBe(2);
  });

  it('DELETE removes a photo', async () => {
    const listRes = await request(app)
      .get(`/api/worker/appointments/${apptId}/photos`)
      .set('Cookie', workerCookie());
    const photoId = listRes.body.photos[0].id;

    const res = await request(app)
      .delete(`/api/worker/appointments/${apptId}/photos/${photoId}`)
      .set('Cookie', workerCookie());
    expect(res.status).toBe(200);

    const afterRes = await request(app)
      .get(`/api/worker/appointments/${apptId}/photos`)
      .set('Cookie', workerCookie());
    expect(afterRes.body.photos.length).toBe(1);
  });

  it('cannot view photos of another worker\'s appointment', async () => {
    const res = await request(app)
      .get(`/api/worker/appointments/${otherApptId}/photos`)
      .set('Cookie', workerCookie());
    expect(res.status).toBe(404);
  });

  it('cannot upload to another worker\'s appointment', async () => {
    const res = await request(app)
      .post(`/api/worker/appointments/${otherApptId}/photos`)
      .set('Cookie', workerCookie())
      .attach('image', TINY_PNG, { filename: 'hack.png', contentType: 'image/png' });
    expect(res.status).toBe(404);
  });

  it('upload returns 400 when no file attached', async () => {
    const res = await request(app)
      .post(`/api/worker/appointments/${apptId}/photos`)
      .set('Cookie', workerCookie());
    expect(res.status).toBe(400);
  });

  it('customer cannot access worker photo endpoint', async () => {
    const res = await request(app)
      .get(`/api/worker/appointments/${apptId}/photos`)
      .set('Cookie', customerCookie());
    expect(res.status).toBe(403);
  });
});
