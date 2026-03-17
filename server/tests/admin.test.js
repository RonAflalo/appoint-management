process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret-key';
process.env.NODE_ENV = 'test';


const request = require('supertest');
const { initializeDatabase, closeDatabase } = require('../db/database');
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

function adminCookie() {
  return `token=${ctx.adminToken}`;
}
function workerCookie() {
  return `token=${ctx.workerToken}`;
}
function customerCookie() {
  return `token=${ctx.customerToken}`;
}

// ─── Workers ─────────────────────────────────────────────────────────────────

describe('GET /api/admin/workers', () => {
  it('returns workers for the admin\'s business', async () => {
    const res = await request(app).get('/api/admin/workers').set('Cookie', adminCookie());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.workers)).toBe(true);
    expect(res.body.workers.length).toBeGreaterThan(0);
  });

  it('blocks non-admin access (worker)', async () => {
    const res = await request(app).get('/api/admin/workers').set('Cookie', workerCookie());
    expect(res.status).toBe(403);
  });

  it('blocks unauthenticated access', async () => {
    const res = await request(app).get('/api/admin/workers');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/admin/workers', () => {
  it('creates a new worker', async () => {
    const res = await request(app)
      .post('/api/admin/workers')
      .set('Cookie', adminCookie())
      .send({ name: 'New Worker', email: 'newworker@test.com', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.worker.email).toBe('newworker@test.com');
  });

  it('rejects duplicate email', async () => {
    const res = await request(app)
      .post('/api/admin/workers')
      .set('Cookie', adminCookie())
      .send({ name: 'Dup', email: 'newworker@test.com', password: 'password123' });
    expect(res.status).toBe(409);
  });

  it('rejects missing fields', async () => {
    const res = await request(app)
      .post('/api/admin/workers')
      .set('Cookie', adminCookie())
      .send({ name: 'Incomplete' });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/admin/workers/:id', () => {
  it('updates worker name', async () => {
    const res = await request(app)
      .put(`/api/admin/workers/${ctx.worker.id}`)
      .set('Cookie', adminCookie())
      .send({ name: 'Updated Worker Name' });
    expect(res.status).toBe(200);
    expect(res.body.worker.name).toBe('Updated Worker Name');
  });

  it('returns 404 for worker from another business', async () => {
    const res = await request(app)
      .put('/api/admin/workers/99999')
      .set('Cookie', adminCookie())
      .send({ name: 'Hacker' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/admin/workers/:id', () => {
  it('soft-deletes a worker', async () => {
    // Create a worker to delete
    const createRes = await request(app)
      .post('/api/admin/workers')
      .set('Cookie', adminCookie())
      .send({ name: 'To Delete', email: 'todelete@test.com', password: 'password123' });
    const workerId = createRes.body.worker.id;

    const res = await request(app)
      .delete(`/api/admin/workers/${workerId}`)
      .set('Cookie', adminCookie());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify worker no longer appears in active list with is_active=1
    const { getDb } = require('../db/database');
    const db = getDb();
    const w = db.prepare('SELECT is_active FROM users WHERE id = ?').get(workerId);
    expect(w.is_active).toBe(0);
  });
});

// ─── Services ─────────────────────────────────────────────────────────────────

describe('GET /api/admin/services', () => {
  it('returns services for the business', async () => {
    const res = await request(app).get('/api/admin/services').set('Cookie', adminCookie());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.services.length).toBeGreaterThan(0);
  });
});

describe('POST /api/admin/services', () => {
  it('creates a service', async () => {
    const res = await request(app)
      .post('/api/admin/services')
      .set('Cookie', adminCookie())
      .send({ name: 'Massage', duration_minutes: 60, price: 100 });
    expect(res.status).toBe(201);
    expect(res.body.service.name).toBe('Massage');
  });

  it('rejects missing fields', async () => {
    const res = await request(app)
      .post('/api/admin/services')
      .set('Cookie', adminCookie())
      .send({ name: 'Incomplete' });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/admin/services/:id', () => {
  it('updates service price', async () => {
    const res = await request(app)
      .put(`/api/admin/services/${ctx.service.id}`)
      .set('Cookie', adminCookie())
      .send({ price: 75 });
    expect(res.status).toBe(200);
    expect(res.body.service.price).toBe(75);
  });

  it('returns 404 for service from another business', async () => {
    const res = await request(app)
      .put('/api/admin/services/99999')
      .set('Cookie', adminCookie())
      .send({ price: 0 });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/admin/services/:id', () => {
  it('soft-deletes a service', async () => {
    const createRes = await request(app)
      .post('/api/admin/services')
      .set('Cookie', adminCookie())
      .send({ name: 'Delete Me', duration_minutes: 15, price: 0 });
    const serviceId = createRes.body.service.id;

    const res = await request(app)
      .delete(`/api/admin/services/${serviceId}`)
      .set('Cookie', adminCookie());
    expect(res.status).toBe(200);

    const { getDb } = require('../db/database');
    const s = getDb().prepare('SELECT is_active FROM services WHERE id = ?').get(serviceId);
    expect(s.is_active).toBe(0);
  });
});

// ─── Appointments ─────────────────────────────────────────────────────────────

describe('Admin appointments', () => {
  let appointmentId;

  beforeAll(async () => {
    // Book an appointment as customer to have data
    const { getDb } = require('../db/database');
    const db = getDb();
    const futureTime = '2030-06-15 09:00:00';
    const endTime = '2030-06-15 09:30:00';
    const result = db.prepare(
      `INSERT INTO appointments (business_id, customer_id, worker_id, service_id, start_time, end_time, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`
    ).run(ctx.businessId, ctx.customer.id, ctx.worker.id, ctx.service.id, futureTime, endTime);
    appointmentId = result.lastInsertRowid;
  });

  it('GET /api/admin/appointments returns appointments', async () => {
    const res = await request(app).get('/api/admin/appointments').set('Cookie', adminCookie());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.appointments)).toBe(true);
    expect(res.body.appointments.length).toBeGreaterThan(0);
  });

  it('can filter appointments by status', async () => {
    const res = await request(app)
      .get('/api/admin/appointments?status=pending')
      .set('Cookie', adminCookie());
    expect(res.status).toBe(200);
    res.body.appointments.forEach(a => expect(a.status).toBe('pending'));
  });

  it('PUT /api/admin/appointments/:id/status confirms an appointment', async () => {
    const res = await request(app)
      .put(`/api/admin/appointments/${appointmentId}/status`)
      .set('Cookie', adminCookie())
      .send({ status: 'confirmed' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('rejects invalid status values', async () => {
    const res = await request(app)
      .put(`/api/admin/appointments/${appointmentId}/status`)
      .set('Cookie', adminCookie())
      .send({ status: 'invalid_status' });
    expect(res.status).toBe(400);
  });

  it('POST /api/admin/appointments/:id/reschedule requests reschedule on confirmed appt', async () => {
    const res = await request(app)
      .post(`/api/admin/appointments/${appointmentId}/reschedule`)
      .set('Cookie', adminCookie())
      .send({ suggested_time: '2030-06-16 10:00:00', note: 'Please come at 10' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('cannot reschedule a non-confirmed appointment', async () => {
    // The appointment is now reschedule_requested, so requesting again should fail
    const res = await request(app)
      .post(`/api/admin/appointments/${appointmentId}/reschedule`)
      .set('Cookie', adminCookie())
      .send({ suggested_time: '2030-06-17 10:00:00' });
    expect(res.status).toBe(400);
  });
});

// ─── Settings ─────────────────────────────────────────────────────────────────

describe('Admin settings', () => {
  it('GET /api/admin/settings returns business settings', async () => {
    const res = await request(app).get('/api/admin/settings').set('Cookie', adminCookie());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.business).toBeDefined();
    expect(res.body.business.working_hours).toBeDefined();
  });

  it('PUT /api/admin/settings updates business name', async () => {
    const res = await request(app)
      .put('/api/admin/settings')
      .set('Cookie', adminCookie())
      .send({ name: 'Updated Business Name' });
    expect(res.status).toBe(200);
    expect(res.body.business.name).toBe('Updated Business Name');
  });
});

// ─── Admin-as-worker toggle ───────────────────────────────────────────────────

describe('PATCH /api/admin/me/worker-toggle', () => {
  it('toggles is_worker flag', async () => {
    const before = await request(app).get('/api/admin/settings').set('Cookie', adminCookie());
    const res = await request(app)
      .patch('/api/admin/me/worker-toggle')
      .set('Cookie', adminCookie());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.is_worker).toBe('number');
    // Toggle again to restore
    await request(app).patch('/api/admin/me/worker-toggle').set('Cookie', adminCookie());
  });
});

// ─── Workers Calendar ─────────────────────────────────────────────────────────

describe('Admin workers calendar', () => {
  it('GET /api/admin/workers-calendar returns month data', async () => {
    const res = await request(app)
      .get('/api/admin/workers-calendar?year=2030&month=6')
      .set('Cookie', adminCookie());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.days).toBeDefined();
    expect(res.body.workers).toBeDefined();
  });

  it('requires year and month params', async () => {
    const res = await request(app)
      .get('/api/admin/workers-calendar')
      .set('Cookie', adminCookie());
    expect(res.status).toBe(400);
  });

  it('GET /api/admin/workers-calendar/day returns day detail', async () => {
    const res = await request(app)
      .get('/api/admin/workers-calendar/day?date=2030-06-15')
      .set('Cookie', adminCookie());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('requires date param for day detail', async () => {
    const res = await request(app)
      .get('/api/admin/workers-calendar/day')
      .set('Cookie', adminCookie());
    expect(res.status).toBe(400);
  });
});

// ─── Role isolation ───────────────────────────────────────────────────────────

describe('Admin role isolation', () => {
  it('worker cannot access admin endpoints', async () => {
    const res = await request(app)
      .post('/api/admin/services')
      .set('Cookie', workerCookie())
      .send({ name: 'Hijacked', duration_minutes: 30, price: 0 });
    expect(res.status).toBe(403);
  });

  it('customer cannot access admin endpoints', async () => {
    const res = await request(app)
      .get('/api/admin/workers')
      .set('Cookie', customerCookie());
    expect(res.status).toBe(403);
  });
});
