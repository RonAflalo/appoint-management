/**
 * Booking edge-case tests — covers gaps not addressed by user.test.js:
 *   - Terms enforcement
 *   - Notes field persisted and returned
 *   - Worker-services filtering (serviceId param on /api/workers)
 *   - Store endpoint (enabled / disabled)
 *   - Worker-specific services: worker excluded when assigned to different service only
 */
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret-key';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const { initializeDatabase, closeDatabase, getDb } = require('../db/database');
const app = require('../app');
const { seedTestData } = require('./helpers');

let ctx;

beforeAll(() => {
  initializeDatabase(':memory:');
  ctx = seedTestData();
});

afterAll(() => {
  closeDatabase();
});

function customerCookie() { return `token=${ctx.customerToken}`; }
function adminCookie()    { return `token=${ctx.adminToken}`; }
function workerCookie()   { return `token=${ctx.workerToken}`; }

// ─── Terms enforcement ────────────────────────────────────────────────────────

describe('Terms enforcement on booking', () => {
  beforeAll(() => {
    const db = getDb();
    db.prepare('UPDATE businesses SET terms_enabled = 1 WHERE id = ?').run(ctx.businessId);
  });

  afterAll(() => {
    const db = getDb();
    db.prepare('UPDATE businesses SET terms_enabled = 0 WHERE id = ?').run(ctx.businessId);
  });

  it('returns 400 when terms_enabled and terms_accepted not provided', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .set('Cookie', customerCookie())
      .send({
        workerId: ctx.worker.id,
        serviceId: ctx.service.id,
        start_time: '2031-01-10T09:00:00',
      });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when terms_accepted is false', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .set('Cookie', customerCookie())
      .send({
        workerId: ctx.worker.id,
        serviceId: ctx.service.id,
        start_time: '2031-01-10T09:00:00',
        terms_accepted: false,
      });
    expect(res.status).toBe(400);
  });

  it('succeeds when terms_accepted is true', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .set('Cookie', customerCookie())
      .send({
        workerId: ctx.worker.id,
        serviceId: ctx.service.id,
        start_time: '2031-01-10T09:00:00',
        terms_accepted: true,
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });
});

// ─── Notes field ──────────────────────────────────────────────────────────────

describe('Notes saved during booking', () => {
  let apptId;

  it('booking with notes persists the notes field', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .set('Cookie', customerCookie())
      .send({
        workerId: ctx.worker.id,
        serviceId: ctx.service.id,
        start_time: '2031-02-15T10:00:00',
        notes: 'Please use scissors only',
      });
    expect(res.status).toBe(201);
    expect(res.body.appointment.notes).toBe('Please use scissors only');
    apptId = res.body.appointment.id;
  });

  it('notes appear in getMyAppointments', async () => {
    const res = await request(app)
      .get('/api/appointments/mine')
      .set('Cookie', customerCookie());
    expect(res.status).toBe(200);
    const found = res.body.appointments.find(a => a.id === apptId);
    expect(found).toBeDefined();
    expect(found.notes).toBe('Please use scissors only');
  });

  it('booking without notes stores null (not undefined string)', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .set('Cookie', customerCookie())
      .send({
        workerId: ctx.worker.id,
        serviceId: ctx.service.id,
        start_time: '2031-02-16T10:00:00',
      });
    expect(res.status).toBe(201);
    // notes should be null or undefined, not the string "undefined"
    expect(res.body.appointment.notes == null || res.body.appointment.notes === '').toBe(true);
  });
});

// ─── Worker-services filtering ────────────────────────────────────────────────

describe('GET /api/workers with serviceId filter', () => {
  let serviceA; // worker assigned to this
  let serviceB; // worker NOT assigned to this

  beforeAll(() => {
    const db = getDb();

    // Create two services
    const sA = db.prepare('INSERT INTO services (business_id, name, duration_minutes, price) VALUES (?, ?, 30, 80)').run(ctx.businessId, 'Service A');
    serviceA = sA.lastInsertRowid;

    const sB = db.prepare('INSERT INTO services (business_id, name, duration_minutes, price) VALUES (?, ?, 30, 90)').run(ctx.businessId, 'Service B');
    serviceB = sB.lastInsertRowid;

    // Assign worker to service A only (creates worker_services entry)
    db.prepare('INSERT INTO worker_services (worker_id, service_id) VALUES (?, ?)').run(ctx.worker.id, serviceA);
  });

  it('worker appears when filtering by the service they are assigned to', async () => {
    const res = await request(app)
      .get(`/api/workers?serviceId=${serviceA}`)
      .set('Cookie', customerCookie());
    expect(res.status).toBe(200);
    const ids = res.body.workers.map(w => w.id);
    expect(ids).toContain(ctx.worker.id);
  });

  it('worker excluded when filtering by a service they are NOT assigned to', async () => {
    const res = await request(app)
      .get(`/api/workers?serviceId=${serviceB}`)
      .set('Cookie', customerCookie());
    expect(res.status).toBe(200);
    const ids = res.body.workers.map(w => w.id);
    expect(ids).not.toContain(ctx.worker.id);
  });

  it('all workers returned when no serviceId filter', async () => {
    const res = await request(app)
      .get('/api/workers')
      .set('Cookie', customerCookie());
    expect(res.status).toBe(200);
    const ids = res.body.workers.map(w => w.id);
    expect(ids).toContain(ctx.worker.id);
  });
});

// ─── Store endpoint ───────────────────────────────────────────────────────────

describe('GET /api/store', () => {
  beforeAll(() => {
    const db = getDb();
    // Ensure store is disabled initially
    db.prepare('UPDATE businesses SET store_enabled = 0 WHERE id = ?').run(ctx.businessId);
  });

  it('returns store_enabled: false and empty products when store is disabled', async () => {
    const res = await request(app)
      .get('/api/store')
      .set('Cookie', customerCookie());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.store_enabled).toBe(false);
    expect(res.body.products).toEqual([]);
  });

  it('returns products when store is enabled', async () => {
    const db = getDb();
    db.prepare('UPDATE businesses SET store_enabled = 1 WHERE id = ?').run(ctx.businessId);
    db.prepare('INSERT INTO products (business_id, name, price) VALUES (?, ?, ?)').run(ctx.businessId, 'Hair Wax', 45);

    const res = await request(app)
      .get('/api/store')
      .set('Cookie', customerCookie());
    expect(res.status).toBe(200);
    expect(res.body.store_enabled).toBe(true);
    expect(res.body.products.length).toBeGreaterThan(0);
    expect(res.body.products[0].name).toBe('Hair Wax');
  });

  it('inactive products not returned', async () => {
    const db = getDb();
    db.prepare('INSERT INTO products (business_id, name, price, is_active) VALUES (?, ?, ?, 0)').run(ctx.businessId, 'Hidden Product', 100);

    const res = await request(app)
      .get('/api/store')
      .set('Cookie', customerCookie());
    expect(res.status).toBe(200);
    const names = res.body.products.map(p => p.name);
    expect(names).not.toContain('Hidden Product');
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/store');
    expect(res.status).toBe(401);
  });
});

// ─── Business policy endpoint ─────────────────────────────────────────────────

describe('GET /api/business-policy', () => {
  it('returns business policy fields', async () => {
    const res = await request(app)
      .get('/api/business-policy')
      .set('Cookie', customerCookie());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // These fields should always be present
    expect(res.body).toHaveProperty('cancellation_hours');
    expect(res.body).toHaveProperty('terms_enabled');
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/business-policy');
    expect(res.status).toBe(401);
  });
});

// ─── Waitlist ─────────────────────────────────────────────────────────────────

describe('Waitlist CRUD', () => {
  let waitlistId;

  it('customer can join waitlist for a slot', async () => {
    const res = await request(app)
      .post('/api/waitlist')
      .set('Cookie', customerCookie())
      .send({
        workerId: ctx.worker.id,
        serviceId: ctx.service.id,
        slotTime: '2031-05-15 09:00:00',
      });
    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
    waitlistId = res.body.entry?.id;
  });

  it('customer can view their waitlist entries', async () => {
    const res = await request(app)
      .get('/api/waitlist')
      .set('Cookie', customerCookie());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.waitlist)).toBe(true);
    expect(res.body.waitlist.length).toBeGreaterThan(0);
  });

  it('customer can cancel their waitlist entry', async () => {
    if (!waitlistId) return;
    const res = await request(app)
      .delete(`/api/waitlist/${waitlistId}`)
      .set('Cookie', customerCookie());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('requires auth for all waitlist routes', async () => {
    const post = await request(app).post('/api/waitlist').send({ workerId: 1, serviceId: 1 });
    const get  = await request(app).get('/api/waitlist');
    expect(post.status).toBe(401);
    expect(get.status).toBe(401);
  });
});
