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

function workerCookie() {
  return `token=${ctx.workerToken}`;
}
function customerCookie() {
  return `token=${ctx.customerToken}`;
}
function adminCookie() {
  return `token=${ctx.adminToken}`;
}

function insertAppointment(status = 'pending', startTime = '2030-06-15 09:00:00') {
  const db = getDb();
  const endTime = '2030-06-15 09:30:00';
  const result = db.prepare(
    `INSERT INTO appointments (business_id, customer_id, worker_id, service_id, start_time, end_time, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(ctx.businessId, ctx.customer.id, ctx.worker.id, ctx.service.id, startTime, endTime, status);
  return result.lastInsertRowid;
}

// ─── List appointments ────────────────────────────────────────────────────────

describe('GET /api/worker/appointments', () => {
  beforeAll(() => {
    insertAppointment('pending', '2030-06-15 09:00:00');
  });

  it('returns worker\'s own appointments', async () => {
    const res = await request(app).get('/api/worker/appointments').set('Cookie', workerCookie());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.appointments)).toBe(true);
  });

  it('can filter by status', async () => {
    const res = await request(app)
      .get('/api/worker/appointments?status=pending')
      .set('Cookie', workerCookie());
    expect(res.status).toBe(200);
    res.body.appointments.forEach(a => expect(a.status).toBe('pending'));
  });

  it('blocks non-worker access', async () => {
    const res = await request(app).get('/api/worker/appointments').set('Cookie', customerCookie());
    expect(res.status).toBe(403);
  });

  it('blocks unauthenticated access', async () => {
    const res = await request(app).get('/api/worker/appointments');
    expect(res.status).toBe(401);
  });
});

// ─── Approve appointment ──────────────────────────────────────────────────────

describe('PUT /api/worker/appointments/:id/approve', () => {
  let apptId;
  beforeAll(() => { apptId = insertAppointment('pending', '2030-07-01 09:00:00'); });

  it('approves a pending appointment', async () => {
    const res = await request(app)
      .put(`/api/worker/appointments/${apptId}/approve`)
      .set('Cookie', workerCookie());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const db = getDb();
    const a = db.prepare('SELECT status FROM appointments WHERE id = ?').get(apptId);
    expect(a.status).toBe('confirmed');
  });

  it('rejects approving a non-pending appointment', async () => {
    // Already confirmed
    const res = await request(app)
      .put(`/api/worker/appointments/${apptId}/approve`)
      .set('Cookie', workerCookie());
    expect(res.status).toBe(400);
  });

  it('cannot approve another worker\'s appointment', async () => {
    // Insert appointment owned by admin-as-worker
    const db = getDb();
    const otherResult = db.prepare(
      `INSERT INTO appointments (business_id, customer_id, worker_id, service_id, start_time, end_time, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`
    ).run(ctx.businessId, ctx.customer.id, ctx.admin.id, ctx.service.id, '2030-07-02 09:00:00', '2030-07-02 09:30:00');

    const res = await request(app)
      .put(`/api/worker/appointments/${otherResult.lastInsertRowid}/approve`)
      .set('Cookie', workerCookie());
    expect(res.status).toBe(404);
  });
});

// ─── Cancel appointment (worker) ─────────────────────────────────────────────

describe('PUT /api/worker/appointments/:id/cancel', () => {
  let apptId;
  beforeAll(() => { apptId = insertAppointment('pending', '2030-08-01 09:00:00'); });

  it('cancels a pending appointment', async () => {
    const res = await request(app)
      .put(`/api/worker/appointments/${apptId}/cancel`)
      .set('Cookie', workerCookie());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('cannot cancel an already cancelled appointment', async () => {
    const res = await request(app)
      .put(`/api/worker/appointments/${apptId}/cancel`)
      .set('Cookie', workerCookie());
    expect(res.status).toBe(400);
  });
});

// ─── Request reschedule ───────────────────────────────────────────────────────

describe('PUT /api/worker/appointments/:id/reschedule-request', () => {
  let apptId;
  beforeAll(() => { apptId = insertAppointment('confirmed', '2030-09-01 09:00:00'); });

  it('requests a reschedule on a confirmed appointment', async () => {
    const res = await request(app)
      .put(`/api/worker/appointments/${apptId}/reschedule-request`)
      .set('Cookie', workerCookie())
      .send({ suggested_time: '2030-09-02 10:00:00', note: 'Please come at 10' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const db = getDb();
    const a = db.prepare('SELECT status, suggested_time, reschedule_note FROM appointments WHERE id = ?').get(apptId);
    expect(a.status).toBe('reschedule_requested');
    expect(a.suggested_time).toContain('2030-09-02');
    expect(a.reschedule_note).toBe('Please come at 10');
  });

  it('requires suggested_time', async () => {
    const apptId2 = insertAppointment('confirmed', '2030-09-03 09:00:00');
    const res = await request(app)
      .put(`/api/worker/appointments/${apptId2}/reschedule-request`)
      .set('Cookie', workerCookie())
      .send({});
    expect(res.status).toBe(400);
  });

  it('can only reschedule confirmed appointments', async () => {
    const pendingId = insertAppointment('pending', '2030-09-04 09:00:00');
    const res = await request(app)
      .put(`/api/worker/appointments/${pendingId}/reschedule-request`)
      .set('Cookie', workerCookie())
      .send({ suggested_time: '2030-09-05 10:00:00' });
    expect(res.status).toBe(400);
  });
});

// ─── Mark completed ───────────────────────────────────────────────────────────

describe('PUT /api/worker/appointments/:id/status (completed)', () => {
  let apptId;
  beforeAll(() => { apptId = insertAppointment('confirmed', '2030-10-01 09:00:00'); });

  it('marks appointment as completed', async () => {
    const res = await request(app)
      .put(`/api/worker/appointments/${apptId}/status`)
      .set('Cookie', workerCookie())
      .send({ status: 'completed' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('rejects status values other than completed', async () => {
    const apptId2 = insertAppointment('confirmed', '2030-10-02 09:00:00');
    const res = await request(app)
      .put(`/api/worker/appointments/${apptId2}/status`)
      .set('Cookie', workerCookie())
      .send({ status: 'cancelled' });
    expect(res.status).toBe(400);
  });
});

// ─── Availability ─────────────────────────────────────────────────────────────

describe('Worker availability', () => {
  it('GET /api/worker/availability returns overrides', async () => {
    const res = await request(app).get('/api/worker/availability').set('Cookie', workerCookie());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.overrides)).toBe(true);
  });

  it('POST /api/worker/availability sets a blocked day', async () => {
    const res = await request(app)
      .post('/api/worker/availability')
      .set('Cookie', workerCookie())
      .send({ date: '2030-11-01', is_blocked: true });
    expect(res.status).toBe(200);
    expect(res.body.override.is_blocked).toBe(1);
  });

  it('POST /api/worker/availability sets custom hours', async () => {
    const res = await request(app)
      .post('/api/worker/availability')
      .set('Cookie', workerCookie())
      .send({ date: '2030-11-03', is_blocked: false, custom_start: '10:00', custom_end: '14:00' });
    expect(res.status).toBe(200);
    expect(res.body.override.custom_start).toBe('10:00');
    expect(res.body.override.custom_end).toBe('14:00');
  });

  it('POST /api/worker/availability updates existing override', async () => {
    // Set once
    await request(app)
      .post('/api/worker/availability')
      .set('Cookie', workerCookie())
      .send({ date: '2030-11-05', is_blocked: true });

    // Update to custom hours
    const res = await request(app)
      .post('/api/worker/availability')
      .set('Cookie', workerCookie())
      .send({ date: '2030-11-05', is_blocked: false, custom_start: '08:00', custom_end: '12:00' });
    expect(res.status).toBe(200);
    expect(res.body.override.is_blocked).toBe(0);
    expect(res.body.override.custom_start).toBe('08:00');
  });

  it('requires date param', async () => {
    const res = await request(app)
      .post('/api/worker/availability')
      .set('Cookie', workerCookie())
      .send({ is_blocked: true });
    expect(res.status).toBe(400);
  });

  it('blocks reflect in slot availability — blocked day returns no slots', async () => {
    // Block the worker on 2030-11-01 (already done above)
    const res = await request(app)
      .get(`/api/slots?serviceId=${ctx.service.id}&date=2030-11-01&workerId=${ctx.worker.id}`)
      .set('Cookie', customerCookie());
    expect(res.status).toBe(200);
    expect(res.body.slots.length).toBe(0);
  });

  it('admin can view worker availability', async () => {
    const res = await request(app)
      .get(`/api/admin/workers/${ctx.worker.id}/availability`)
      .set('Cookie', adminCookie());
    expect(res.status).toBe(200);
    expect(res.body.overrides).toBeDefined();
  });
});
