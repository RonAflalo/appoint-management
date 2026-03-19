/**
 * Tests for new admin features: customers list, onboarding, file upload,
 * and extended settings (description, social links, phone, logo_url).
 */
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret-key';
process.env.NODE_ENV = 'test';

const path = require('path');
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

function adminCookie() {
  return `token=${ctx.adminToken}`;
}
function customerCookie() {
  return `token=${ctx.customerToken}`;
}

// ─── Customers list ───────────────────────────────────────────────────────────

describe('GET /api/admin/customers', () => {
  beforeAll(async () => {
    // Book an appointment so the customer has a count
    await request(app)
      .post('/api/appointments')
      .set('Cookie', customerCookie())
      .send({
        workerId: ctx.worker.id,
        serviceId: ctx.service.id,
        start_time: '2030-06-10T09:00:00',
      });
  });

  it('returns customer list for the business', async () => {
    const res = await request(app).get('/api/admin/customers').set('Cookie', adminCookie());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.customers)).toBe(true);
    expect(res.body.customers.length).toBeGreaterThan(0);
  });

  it('includes appointment_count per customer', async () => {
    const res = await request(app).get('/api/admin/customers').set('Cookie', adminCookie());
    const customer = res.body.customers.find(c => c.email === ctx.customer.email);
    expect(customer).toBeDefined();
    expect(typeof customer.appointment_count).toBe('number');
    expect(customer.appointment_count).toBeGreaterThan(0);
  });

  it('includes email_verified field', async () => {
    const res = await request(app).get('/api/admin/customers').set('Cookie', adminCookie());
    const customer = res.body.customers[0];
    expect('email_verified' in customer).toBe(true);
  });

  it('does not include workers or admins', async () => {
    const res = await request(app).get('/api/admin/customers').set('Cookie', adminCookie());
    const emails = res.body.customers.map(c => c.email);
    expect(emails).not.toContain(ctx.admin.email);
    expect(emails).not.toContain(ctx.worker.email);
  });

  it('does not expose password_hash', async () => {
    const res = await request(app).get('/api/admin/customers').set('Cookie', adminCookie());
    res.body.customers.forEach(c => {
      expect(c.password_hash).toBeUndefined();
    });
  });

  it('blocks non-admin access', async () => {
    const res = await request(app).get('/api/admin/customers').set('Cookie', customerCookie());
    expect(res.status).toBe(403);
  });
});

// ─── Onboarding complete ──────────────────────────────────────────────────────

describe('POST /api/admin/onboarding/complete', () => {
  it('marks the business as onboarding_complete = 1', async () => {
    const res = await request(app)
      .post('/api/admin/onboarding/complete')
      .set('Cookie', adminCookie());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const db = getDb();
    const biz = db.prepare('SELECT onboarding_complete FROM businesses WHERE id = ?').get(ctx.businessId);
    expect(biz.onboarding_complete).toBe(1);
  });

  it('calling it again is idempotent (still 200)', async () => {
    const res = await request(app)
      .post('/api/admin/onboarding/complete')
      .set('Cookie', adminCookie());
    expect(res.status).toBe(200);
  });

  it('requires admin role', async () => {
    const res = await request(app)
      .post('/api/admin/onboarding/complete')
      .set('Cookie', customerCookie());
    expect(res.status).toBe(403);
  });
});

// ─── Extended settings ────────────────────────────────────────────────────────

describe('PUT /api/admin/settings — extended fields', () => {
  it('updates description', async () => {
    const res = await request(app)
      .put('/api/admin/settings')
      .set('Cookie', adminCookie())
      .send({ description: 'Best barbershop in town' });
    expect(res.status).toBe(200);
    expect(res.body.business.description).toBe('Best barbershop in town');
  });

  it('updates phone', async () => {
    const res = await request(app)
      .put('/api/admin/settings')
      .set('Cookie', adminCookie())
      .send({ phone: '+972-50-1234567' });
    expect(res.status).toBe(200);
    expect(res.body.business.phone).toBe('+972-50-1234567');
  });

  it('updates social links', async () => {
    const res = await request(app)
      .put('/api/admin/settings')
      .set('Cookie', adminCookie())
      .send({
        instagram_url: 'https://instagram.com/test',
        facebook_url: 'https://facebook.com/test',
      });
    expect(res.status).toBe(200);
    expect(res.body.business.instagram_url).toBe('https://instagram.com/test');
    expect(res.body.business.facebook_url).toBe('https://facebook.com/test');
  });

  it('can update logo_url directly (for when upload returns a URL)', async () => {
    const res = await request(app)
      .put('/api/admin/settings')
      .set('Cookie', adminCookie())
      .send({ logo_url: '/uploads/logo.png' });
    expect(res.status).toBe(200);
    expect(res.body.business.logo_url).toBe('/uploads/logo.png');
  });

  it('partial update does not overwrite unset fields', async () => {
    // Set description
    await request(app)
      .put('/api/admin/settings')
      .set('Cookie', adminCookie())
      .send({ description: 'Keep this' });

    // Update only name — description should be unchanged
    const res = await request(app)
      .put('/api/admin/settings')
      .set('Cookie', adminCookie())
      .send({ name: 'New Name Only' });

    expect(res.status).toBe(200);
    expect(res.body.business.name).toBe('New Name Only');
    expect(res.body.business.description).toBe('Keep this');
  });
});

// ─── File upload ──────────────────────────────────────────────────────────────

describe('POST /api/admin/upload', () => {
  it('returns a URL for a valid image upload', async () => {
    // Create a minimal 1x1 PNG as a buffer (valid PNG header)
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk length + type
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 pixels
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // bit depth, color type, etc.
      0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, // IDAT
      0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
      0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc,
      0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, // IEND
      0x44, 0xae, 0x42, 0x60, 0x82,
    ]);

    const res = await request(app)
      .post('/api/admin/upload')
      .set('Cookie', adminCookie())
      .attach('image', pngHeader, { filename: 'test.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.url).toMatch(/^\/uploads\//);
    expect(res.body.url).toMatch(/\.png$/);
  });

  it('rejects upload when no file is attached', async () => {
    const res = await request(app)
      .post('/api/admin/upload')
      .set('Cookie', adminCookie());
    expect(res.status).toBe(400);
  });

  it('rejects non-image file types', async () => {
    const textContent = Buffer.from('this is a text file');
    const res = await request(app)
      .post('/api/admin/upload')
      .set('Cookie', adminCookie())
      .attach('image', textContent, { filename: 'evil.txt', contentType: 'text/plain' });
    // Multer fileFilter rejects non-image types
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('requires admin auth', async () => {
    const res = await request(app).post('/api/admin/upload');
    expect(res.status).toBe(401);
  });
});
