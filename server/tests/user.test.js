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

function customerCookie() {
  return `token=${ctx.customerToken}`;
}
function adminCookie() {
  return `token=${ctx.adminToken}`;
}

// ─── Read-only routes (no auth required for these) ───────────────────────────

describe('GET /api/services', () => {
  it('returns services when authenticated', async () => {
    const res = await request(app).get('/api/services').set('Cookie', customerCookie());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.services)).toBe(true);
    expect(res.body.services[0].name).toBe('Haircut');
  });
});

describe('GET /api/workers', () => {
  it('returns active workers', async () => {
    const res = await request(app).get('/api/workers').set('Cookie', customerCookie());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.workers)).toBe(true);
    // admin with is_worker=1 and worker both appear
    expect(res.body.workers.length).toBeGreaterThan(0);
  });
});

describe('GET /api/slots', () => {
  it('returns slots for a worker/service/date combo', async () => {
    const res = await request(app)
      .get(`/api/slots?serviceId=${ctx.service.id}&date=2030-06-10&workerId=${ctx.worker.id}`)
      .set('Cookie', customerCookie());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.slots)).toBe(true);
  });

  it('returns merged slots when no workerId given', async () => {
    const res = await request(app)
      .get(`/api/slots?serviceId=${ctx.service.id}&date=2030-06-10`)
      .set('Cookie', customerCookie());
    expect(res.status).toBe(200);
    expect(res.body.slotWorkers).toBeDefined();
  });

  it('requires serviceId and date', async () => {
    const res = await request(app).get('/api/slots?serviceId=1').set('Cookie', customerCookie());
    expect(res.status).toBe(400);
  });
});

describe('GET /api/available-days', () => {
  it('returns unavailable dates for a month', async () => {
    const res = await request(app)
      .get(`/api/available-days?serviceId=${ctx.service.id}&year=2030&month=6`)
      .set('Cookie', customerCookie());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.unavailableDates)).toBe(true);
  });

  it('requires serviceId, year, month', async () => {
    const res = await request(app).get('/api/available-days?serviceId=1').set('Cookie', customerCookie());
    expect(res.status).toBe(400);
  });
});

// ─── Booking ──────────────────────────────────────────────────────────────────

describe('POST /api/appointments (booking)', () => {
  it('creates an appointment and returns it', async () => {
    // 2030-06-10 is a Tuesday — should be a working day
    const res = await request(app)
      .post('/api/appointments')
      .set('Cookie', customerCookie())
      .send({
        workerId: ctx.worker.id,
        serviceId: ctx.service.id,
        start_time: '2030-06-10T09:00:00',
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.appointment.status).toBe('pending');
  });

  it('prevents double-booking the same slot', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .set('Cookie', customerCookie())
      .send({
        workerId: ctx.worker.id,
        serviceId: ctx.service.id,
        start_time: '2030-06-10T09:00:00',
      });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('requires auth to book', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .send({
        workerId: ctx.worker.id,
        serviceId: ctx.service.id,
        start_time: '2030-06-10T10:00:00',
      });
    expect(res.status).toBe(401);
  });

  it('rejects booking with missing fields', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .set('Cookie', customerCookie())
      .send({ workerId: ctx.worker.id });
    expect(res.status).toBe(400);
  });

  it('rejects booking with invalid workerId', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .set('Cookie', customerCookie())
      .send({
        workerId: 99999,
        serviceId: ctx.service.id,
        start_time: '2030-06-11T09:00:00',
      });
    expect(res.status).toBe(404);
  });

  it('rejects booking with invalid serviceId', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .set('Cookie', customerCookie())
      .send({
        workerId: ctx.worker.id,
        serviceId: 99999,
        start_time: '2030-06-11T09:00:00',
      });
    expect(res.status).toBe(404);
  });
});

// ─── View/Cancel my appointments ──────────────────────────────────────────────

describe('GET /api/appointments/mine', () => {
  it('returns the customer\'s own appointments', async () => {
    const res = await request(app).get('/api/appointments/mine').set('Cookie', customerCookie());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.appointments)).toBe(true);
    expect(res.body.appointments.length).toBeGreaterThan(0);
  });

  it('requires auth', async () => {
    const res = await request(app).get('/api/appointments/mine');
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/appointments/:id/cancel (customer cancel)', () => {
  let appointmentId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/appointments')
      .set('Cookie', customerCookie())
      .send({
        workerId: ctx.worker.id,
        serviceId: ctx.service.id,
        start_time: '2030-07-01T09:00:00',
      });
    appointmentId = res.body.appointment.id;
  });

  it('cancels a pending appointment', async () => {
    const res = await request(app)
      .put(`/api/appointments/${appointmentId}/cancel`)
      .set('Cookie', customerCookie());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('cannot cancel an already cancelled appointment', async () => {
    const res = await request(app)
      .put(`/api/appointments/${appointmentId}/cancel`)
      .set('Cookie', customerCookie());
    expect(res.status).toBe(400);
  });

  it('cannot cancel another customer\'s appointment', async () => {
    // Book as admin's customer perspective — use a different approach
    const db = getDb();
    const otherApptResult = db.prepare(
      `INSERT INTO appointments (business_id, customer_id, worker_id, service_id, start_time, end_time, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`
    ).run(ctx.businessId, ctx.admin.id, ctx.worker.id, ctx.service.id, '2030-08-01 09:00:00', '2030-08-01 09:30:00');
    const otherApptId = otherApptResult.lastInsertRowid;

    const res = await request(app)
      .put(`/api/appointments/${otherApptId}/cancel`)
      .set('Cookie', customerCookie());
    expect(res.status).toBe(404);
  });
});

// ─── Accept reschedule ────────────────────────────────────────────────────────

describe('PUT /api/appointments/:id/accept-reschedule', () => {
  let appointmentId;

  beforeAll(async () => {
    const db = getDb();
    // Create a confirmed appointment with a reschedule request
    const result = db.prepare(
      `INSERT INTO appointments (business_id, customer_id, worker_id, service_id, start_time, end_time, status, suggested_time)
       VALUES (?, ?, ?, ?, ?, ?, 'reschedule_requested', ?)`
    ).run(
      ctx.businessId, ctx.customer.id, ctx.worker.id, ctx.service.id,
      '2030-09-01 09:00:00', '2030-09-01 09:30:00',
      '2030-09-02 10:00:00'
    );
    appointmentId = result.lastInsertRowid;
  });

  it('accepts reschedule and updates appointment time', async () => {
    const res = await request(app)
      .put(`/api/appointments/${appointmentId}/accept-reschedule`)
      .set('Cookie', customerCookie());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const db = getDb();
    const appt = db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointmentId);
    expect(appt.status).toBe('confirmed');
    expect(appt.start_time).toContain('2030-09-02');
  });

  it('returns 400 when no reschedule is pending', async () => {
    // Already accepted, so status is now 'confirmed', not 'reschedule_requested'
    const res = await request(app)
      .put(`/api/appointments/${appointmentId}/accept-reschedule`)
      .set('Cookie', customerCookie());
    expect(res.status).toBe(400);
  });

  it('prevents accepting a reschedule when the new time conflicts', async () => {
    // Book the target slot via the API so timestamps are stored in the same format
    const conflictStart = '2030-10-01T10:00:00';
    const bookRes = await request(app)
      .post('/api/appointments')
      .set('Cookie', customerCookie())
      .send({
        workerId: ctx.worker.id,
        serviceId: ctx.service.id,
        start_time: conflictStart,
      });
    expect(bookRes.status).toBe(201);

    // Create an appointment whose suggested_time points to the same local-time ISO string
    // (so acceptReschedule converts it the same way as the booking did)
    const db = getDb();
    const result = db.prepare(
      `INSERT INTO appointments (business_id, customer_id, worker_id, service_id, start_time, end_time, status, suggested_time)
       VALUES (?, ?, ?, ?, '2030-10-02 00:00:00', '2030-10-02 00:30:00', 'reschedule_requested', ?)`
    ).run(ctx.businessId, ctx.customer.id, ctx.worker.id, ctx.service.id, conflictStart);
    const conflictApptId = result.lastInsertRowid;

    const res = await request(app)
      .put(`/api/appointments/${conflictApptId}/accept-reschedule`)
      .set('Cookie', customerCookie());
    expect(res.status).toBe(409);
  });
});
