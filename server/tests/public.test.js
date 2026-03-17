process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret-key';
process.env.NODE_ENV = 'test';


const request = require('supertest');
const { initializeDatabase, closeDatabase, getDb } = require('../db/database');
const app = require('../app');
const { seedTestData } = require('./helpers');

let ctx;
const SLUG = 'test-biz';

beforeAll(() => {
  initializeDatabase(':memory:');
  ctx = seedTestData();
});

afterAll(() => {
  closeDatabase();
});

describe('GET /api/public/check-slug', () => {
  it('returns available for a free slug', async () => {
    const res = await request(app).get('/api/public/check-slug?slug=free-slug-xyz');
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(true);
  });

  it('returns unavailable for an existing slug', async () => {
    const res = await request(app).get(`/api/public/check-slug?slug=${SLUG}`);
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
  });

  it('rejects invalid slug format (uppercase)', async () => {
    const res = await request(app).get('/api/public/check-slug?slug=INVALID');
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
  });

  it('rejects slug with leading hyphen', async () => {
    const res = await request(app).get('/api/public/check-slug?slug=-bad');
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
  });

  it('rejects slug shorter than 3 chars', async () => {
    const res = await request(app).get('/api/public/check-slug?slug=ab');
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
  });

  it('rejects missing slug param', async () => {
    const res = await request(app).get('/api/public/check-slug');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/public/:slug/info', () => {
  it('returns business info for a valid slug', async () => {
    const res = await request(app).get(`/api/public/${SLUG}/info`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.business.slug).toBe(SLUG);
    expect(res.body.business.working_hours).toBeDefined();
    // Password hash should NOT be in response
    expect(res.body.business.password_hash).toBeUndefined();
  });

  it('returns 404 for unknown slug', async () => {
    const res = await request(app).get('/api/public/nonexistent-slug/info');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/public/:slug/services', () => {
  it('returns services for a business', async () => {
    const res = await request(app).get(`/api/public/${SLUG}/services`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.services)).toBe(true);
    expect(res.body.services[0].name).toBe('Haircut');
  });
});

describe('GET /api/public/:slug/workers', () => {
  it('returns active workers for a business', async () => {
    const res = await request(app).get(`/api/public/${SLUG}/workers`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.workers)).toBe(true);
    // Should not expose sensitive fields
    res.body.workers.forEach(w => {
      expect(w.password_hash).toBeUndefined();
      expect(w.email).toBeUndefined();
    });
  });
});

describe('GET /api/public/:slug/slots', () => {
  it('returns available slots', async () => {
    const res = await request(app).get(
      `/api/public/${SLUG}/slots?serviceId=${ctx.service.id}&date=2030-06-10&workerId=${ctx.worker.id}`
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.slots)).toBe(true);
  });

  it('returns merged slots without workerId', async () => {
    const res = await request(app).get(
      `/api/public/${SLUG}/slots?serviceId=${ctx.service.id}&date=2030-06-10`
    );
    expect(res.status).toBe(200);
    expect(res.body.slotWorkers).toBeDefined();
  });

  it('requires serviceId and date', async () => {
    const res = await request(app).get(`/api/public/${SLUG}/slots?serviceId=${ctx.service.id}`);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/public/:slug/available-days', () => {
  it('returns unavailable dates for a month', async () => {
    const res = await request(app).get(
      `/api/public/${SLUG}/available-days?serviceId=${ctx.service.id}&year=2030&month=6`
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.unavailableDates)).toBe(true);
  });
});

describe('POST /api/public/:slug/book (guest booking)', () => {
  it('creates an appointment for a new guest user', async () => {
    const res = await request(app)
      .post(`/api/public/${SLUG}/book`)
      .send({
        workerId: ctx.worker.id,
        serviceId: ctx.service.id,
        start_time: '2030-06-10T09:00:00',
        guestName: 'Guest Customer',
        guestEmail: 'guest@example.com',
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.appointment.status).toBe('pending');
  });

  it('reuses an existing guest user by email', async () => {
    const db = getDb();
    const usersBefore = db.prepare("SELECT COUNT(*) AS cnt FROM users WHERE email = 'guest@example.com'").get();

    // Book again with same email
    const res = await request(app)
      .post(`/api/public/${SLUG}/book`)
      .send({
        workerId: ctx.worker.id,
        serviceId: ctx.service.id,
        start_time: '2030-06-11T09:00:00',
        guestName: 'Guest Customer',
        guestEmail: 'guest@example.com',
      });
    expect(res.status).toBe(201);

    const usersAfter = db.prepare("SELECT COUNT(*) AS cnt FROM users WHERE email = 'guest@example.com'").get();
    expect(usersAfter.cnt).toBe(usersBefore.cnt); // No new user created
  });

  it('prevents double-booking the same slot', async () => {
    const res = await request(app)
      .post(`/api/public/${SLUG}/book`)
      .send({
        workerId: ctx.worker.id,
        serviceId: ctx.service.id,
        start_time: '2030-06-10T09:00:00', // same as first booking
        guestName: 'Another Guest',
        guestEmail: 'another@example.com',
      });
    expect(res.status).toBe(409);
  });

  it('rejects missing required fields', async () => {
    const res = await request(app)
      .post(`/api/public/${SLUG}/book`)
      .send({ serviceId: ctx.service.id, start_time: '2030-06-12T09:00:00' });
    expect(res.status).toBe(400);
  });

  it('rejects booking for unknown worker', async () => {
    const res = await request(app)
      .post(`/api/public/${SLUG}/book`)
      .send({
        workerId: 99999,
        serviceId: ctx.service.id,
        start_time: '2030-06-12T09:00:00',
        guestName: 'Guest',
        guestEmail: 'x@x.com',
      });
    expect(res.status).toBe(404);
  });

  it('rejects booking for unknown slug', async () => {
    const res = await request(app)
      .post('/api/public/nope/book')
      .send({
        workerId: ctx.worker.id,
        serviceId: ctx.service.id,
        start_time: '2030-06-12T09:00:00',
        guestName: 'Guest',
        guestEmail: 'x@x.com',
      });
    expect(res.status).toBe(404);
  });
});

// ─── Business registration ────────────────────────────────────────────────────

describe('POST /api/register-business', () => {
  it('creates a business and admin account', async () => {
    const res = await request(app).post('/api/register-business').send({
      businessName: 'New Salon',
      businessType: 'default',
      ownerName: 'Salon Owner',
      email: 'owner@newsalon.com',
      password: 'securepass',
      slug: 'new-salon',
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.user.role).toBe('admin');
  });

  it('rejects duplicate slug', async () => {
    const res = await request(app).post('/api/register-business').send({
      businessName: 'Dupe',
      businessType: 'default',
      ownerName: 'Owner',
      email: 'owner2@newsalon.com',
      password: 'securepass',
      slug: 'new-salon',
    });
    expect(res.status).toBe(409);
  });

  it('rejects duplicate admin email', async () => {
    const res = await request(app).post('/api/register-business').send({
      businessName: 'Another',
      businessType: 'default',
      ownerName: 'Owner',
      email: 'owner@newsalon.com',
      password: 'securepass',
      slug: 'another-biz',
    });
    expect(res.status).toBe(409);
  });
});
