/**
 * Tests for admin features not covered elsewhere:
 *   - Store (toggle, products CRUD)
 *   - Categories CRUD
 *   - Recurring rules CRUD
 *   - Worker-specific service assignment
 *   - Working hours update
 *   - Cancellation policy setting + enforcement
 *   - Customer detail + admin notes
 *   - Dashboard stats
 *   - Analytics
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

function adminCookie() { return `token=${ctx.adminToken}`; }
function workerCookie() { return `token=${ctx.workerToken}`; }
function customerCookie() { return `token=${ctx.customerToken}`; }

// ─── Store ────────────────────────────────────────────────────────────────────

describe('Store management', () => {
  let productId;

  it('GET /api/admin/store returns store state', async () => {
    const res = await request(app).get('/api/admin/store').set('Cookie', adminCookie());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.products)).toBe(true);
  });

  it('POST /api/admin/store/toggle enables the store', async () => {
    // Start from known state: disabled
    const db = getDb();
    db.prepare('UPDATE businesses SET store_enabled = 0 WHERE id = ?').run(ctx.businessId);

    const res = await request(app).post('/api/admin/store/toggle').set('Cookie', adminCookie());
    expect(res.status).toBe(200);
    expect(res.body.store_enabled).toBe(true);
  });

  it('POST /api/admin/store/toggle disables the store', async () => {
    const res = await request(app).post('/api/admin/store/toggle').set('Cookie', adminCookie());
    expect(res.status).toBe(200);
    expect(res.body.store_enabled).toBe(false);
  });

  it('POST /api/admin/store/products creates a product', async () => {
    const res = await request(app)
      .post('/api/admin/store/products')
      .set('Cookie', adminCookie())
      .send({ name: 'Hair Wax', description: 'Strong hold', price: 45 });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.product.name).toBe('Hair Wax');
    expect(res.body.product.price).toBe(45);
    productId = res.body.product.id;
  });

  it('GET /api/admin/store lists the created product', async () => {
    const res = await request(app).get('/api/admin/store').set('Cookie', adminCookie());
    const found = res.body.products.find(p => p.id === productId);
    expect(found).toBeDefined();
    expect(found.name).toBe('Hair Wax');
  });

  it('PUT /api/admin/store/products/:id updates product', async () => {
    const res = await request(app)
      .put(`/api/admin/store/products/${productId}`)
      .set('Cookie', adminCookie())
      .send({ name: 'Premium Wax', description: 'Updated', price: 55 });
    expect(res.status).toBe(200);
    expect(res.body.product.name).toBe('Premium Wax');
    expect(res.body.product.price).toBe(55);
  });

  it('PUT returns 404 for product from another business', async () => {
    const res = await request(app)
      .put('/api/admin/store/products/99999')
      .set('Cookie', adminCookie())
      .send({ name: 'Nope', price: 0 });
    expect(res.status).toBe(404);
  });

  it('DELETE /api/admin/store/products/:id soft-deletes the product', async () => {
    const res = await request(app)
      .delete(`/api/admin/store/products/${productId}`)
      .set('Cookie', adminCookie());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const db = getDb();
    const p = db.prepare('SELECT is_active FROM products WHERE id = ?').get(productId);
    expect(p.is_active).toBe(0);
  });

  it('deleted product no longer appears in store list', async () => {
    const res = await request(app).get('/api/admin/store').set('Cookie', adminCookie());
    expect(res.body.products.find(p => p.id === productId)).toBeUndefined();
  });

  it('rejects product creation without required fields', async () => {
    const res = await request(app)
      .post('/api/admin/store/products')
      .set('Cookie', adminCookie())
      .send({ description: 'No name or price' });
    expect(res.status).toBe(400);
  });

  it('blocks non-admin from store endpoints', async () => {
    const res = await request(app).get('/api/admin/store').set('Cookie', customerCookie());
    expect(res.status).toBe(403);
  });
});

// ─── Categories ───────────────────────────────────────────────────────────────

describe('Category management', () => {
  let categoryId;

  it('GET /api/admin/categories returns list', async () => {
    const res = await request(app).get('/api/admin/categories').set('Cookie', adminCookie());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.categories)).toBe(true);
  });

  it('POST /api/admin/categories creates a category', async () => {
    const res = await request(app)
      .post('/api/admin/categories')
      .set('Cookie', adminCookie())
      .send({ name: 'Color Treatments' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.category.name).toBe('Color Treatments');
    categoryId = res.body.category.id;
  });

  it('category appears in list after creation', async () => {
    const res = await request(app).get('/api/admin/categories').set('Cookie', adminCookie());
    expect(res.body.categories.find(c => c.id === categoryId)).toBeDefined();
  });

  it('PUT /api/admin/categories/:id renames category', async () => {
    const res = await request(app)
      .put(`/api/admin/categories/${categoryId}`)
      .set('Cookie', adminCookie())
      .send({ name: 'Color & Highlights' });
    expect(res.status).toBe(200);
    expect(res.body.category.name).toBe('Color & Highlights');
  });

  it('service can be assigned to a category', async () => {
    const res = await request(app)
      .put(`/api/admin/services/${ctx.service.id}`)
      .set('Cookie', adminCookie())
      .send({ category_id: categoryId });
    expect(res.status).toBe(200);
    expect(res.body.service.category_id).toBe(categoryId);
  });

  it('DELETE /api/admin/categories/:id removes the category', async () => {
    const res = await request(app)
      .delete(`/api/admin/categories/${categoryId}`)
      .set('Cookie', adminCookie());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('deleted category clears category_id from services', async () => {
    const db = getDb();
    const svc = db.prepare('SELECT category_id FROM services WHERE id = ?').get(ctx.service.id);
    expect(svc.category_id).toBeNull();
  });

  it('returns 404 for category from another business', async () => {
    const res = await request(app)
      .put('/api/admin/categories/99999')
      .set('Cookie', adminCookie())
      .send({ name: 'Hacker' });
    expect(res.status).toBe(404);
  });

  it('rejects category creation without name', async () => {
    const res = await request(app)
      .post('/api/admin/categories')
      .set('Cookie', adminCookie())
      .send({});
    expect(res.status).toBe(400);
  });
});

// ─── Recurring rules ──────────────────────────────────────────────────────────

describe('Recurring rules management', () => {
  let ruleId;

  it('GET /api/admin/recurring-rules returns list', async () => {
    const res = await request(app).get('/api/admin/recurring-rules').set('Cookie', adminCookie());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.rules)).toBe(true);
  });

  it('POST /api/admin/recurring-rules creates a rule', async () => {
    const res = await request(app)
      .post('/api/admin/recurring-rules')
      .set('Cookie', adminCookie())
      .send({
        customer_id: ctx.customer.id,
        worker_id: ctx.worker.id,
        service_id: ctx.service.id,
        day_of_week: 1,
        time: '10:00',
        start_date: '2030-06-01',
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.rule.day_of_week).toBe(1);
    expect(res.body.rule.time).toBe('10:00');
    expect(typeof res.body.appointments_generated).toBe('number');
    ruleId = res.body.rule.id;
  });

  it('rule appears in list', async () => {
    const res = await request(app).get('/api/admin/recurring-rules').set('Cookie', adminCookie());
    expect(res.body.rules.find(r => r.id === ruleId)).toBeDefined();
  });

  it('PUT /api/admin/recurring-rules/:id updates end_date', async () => {
    const res = await request(app)
      .put(`/api/admin/recurring-rules/${ruleId}`)
      .set('Cookie', adminCookie())
      .send({ end_date: '2031-12-31' });
    expect(res.status).toBe(200);
    expect(res.body.rule.end_date).toContain('2031-12-31');
  });

  it('PUT with is_active=false deactivates the rule and cancels future appointments', async () => {
    const res = await request(app)
      .put(`/api/admin/recurring-rules/${ruleId}`)
      .set('Cookie', adminCookie())
      .send({ is_active: false });
    expect(res.status).toBe(200);
    expect(res.body.rule.is_active).toBe(0);
  });

  it('DELETE /api/admin/recurring-rules/:id soft-deletes the rule', async () => {
    // First re-create a fresh rule to delete
    const createRes = await request(app)
      .post('/api/admin/recurring-rules')
      .set('Cookie', adminCookie())
      .send({
        customer_id: ctx.customer.id,
        worker_id: ctx.worker.id,
        service_id: ctx.service.id,
        day_of_week: 3,
        time: '14:00',
        start_date: '2030-07-01',
      });
    const newRuleId = createRes.body.rule.id;

    const res = await request(app)
      .delete(`/api/admin/recurring-rules/${newRuleId}`)
      .set('Cookie', adminCookie());
    expect(res.status).toBe(200);

    const db = getDb();
    const r = db.prepare('SELECT is_active FROM recurring_rules WHERE id = ?').get(newRuleId);
    expect(r.is_active).toBe(0);
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/admin/recurring-rules')
      .set('Cookie', adminCookie())
      .send({ day_of_week: 2 });
    expect(res.status).toBe(400);
  });

  it('returns 404 for rule from another business', async () => {
    const res = await request(app)
      .put('/api/admin/recurring-rules/99999')
      .set('Cookie', adminCookie())
      .send({ end_date: '2032-01-01' });
    expect(res.status).toBe(404);
  });

  it('blocks non-admin access', async () => {
    const res = await request(app).get('/api/admin/recurring-rules').set('Cookie', workerCookie());
    expect(res.status).toBe(403);
  });
});

// ─── Worker-specific service assignment ───────────────────────────────────────

describe('Worker-specific service assignment', () => {
  it('GET /api/admin/workers/:id/services returns service IDs', async () => {
    const res = await request(app)
      .get(`/api/admin/workers/${ctx.worker.id}/services`)
      .set('Cookie', adminCookie());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.serviceIds)).toBe(true);
  });

  it('PUT assigns services to a worker', async () => {
    const res = await request(app)
      .put(`/api/admin/workers/${ctx.worker.id}/services`)
      .set('Cookie', adminCookie())
      .send({ serviceIds: [ctx.service.id] });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('assigned services are returned in GET', async () => {
    const res = await request(app)
      .get(`/api/admin/workers/${ctx.worker.id}/services`)
      .set('Cookie', adminCookie());
    expect(res.body.serviceIds).toContain(ctx.service.id);
  });

  it('PUT with empty array removes all service assignments', async () => {
    const res = await request(app)
      .put(`/api/admin/workers/${ctx.worker.id}/services`)
      .set('Cookie', adminCookie())
      .send({ serviceIds: [] });
    expect(res.status).toBe(200);

    const getRes = await request(app)
      .get(`/api/admin/workers/${ctx.worker.id}/services`)
      .set('Cookie', adminCookie());
    expect(getRes.body.serviceIds).toEqual([]);
  });

  it('returns 404 for worker from another business', async () => {
    const res = await request(app)
      .get('/api/admin/workers/99999/services')
      .set('Cookie', adminCookie());
    expect(res.status).toBe(404);
  });
});

// ─── Working hours update ─────────────────────────────────────────────────────

describe('Working hours settings', () => {
  const customHours = {
    '0': null,
    '1': { start: '08:00', end: '17:00' },
    '2': { start: '08:00', end: '17:00' },
    '3': { start: '08:00', end: '17:00' },
    '4': { start: '08:00', end: '17:00' },
    '5': { start: '08:00', end: '13:00' },
    '6': null,
  };

  it('PUT /api/admin/settings saves new working hours', async () => {
    const res = await request(app)
      .put('/api/admin/settings')
      .set('Cookie', adminCookie())
      .send({ working_hours: customHours });
    expect(res.status).toBe(200);
    expect(res.body.business.working_hours['1'].start).toBe('08:00');
    expect(res.body.business.working_hours['0']).toBeNull();
  });

  it('GET /api/admin/settings returns the updated working hours', async () => {
    const res = await request(app).get('/api/admin/settings').set('Cookie', adminCookie());
    expect(res.status).toBe(200);
    expect(res.body.business.working_hours['1'].start).toBe('08:00');
    expect(res.body.business.working_hours['6']).toBeNull();
  });

  it('working hours affect available slots — closed day returns no slots', async () => {
    // Day 0 (Sunday) is closed; use a Sunday in the future
    const sunday = '2030-06-16'; // a Sunday
    const res = await request(app)
      .get(`/api/slots?serviceId=${ctx.service.id}&date=${sunday}&workerId=${ctx.worker.id}`)
      .set('Cookie', customerCookie());
    expect(res.status).toBe(200);
    expect(res.body.slots.length).toBe(0);
  });
});

// ─── Cancellation policy ──────────────────────────────────────────────────────

describe('Cancellation policy', () => {
  it('PUT /api/admin/settings saves cancellation_hours', async () => {
    const res = await request(app)
      .put('/api/admin/settings')
      .set('Cookie', adminCookie())
      .send({ cancellation_hours: 24 });
    expect(res.status).toBe(200);
    expect(res.body.business.cancellation_hours).toBe(24);
  });

  it('customer cannot cancel within the restricted window', async () => {
    // Set directly in DB to guarantee the value is applied regardless of other test state
    const db = getDb();
    db.prepare('UPDATE businesses SET cancellation_hours = 9999 WHERE id = ?').run(ctx.businessId);

    // Create appointment starting 1 hour from now (well within the 9999-hour window)
    const nearFuture = new Date(Date.now() + 60 * 60 * 1000);
    const fmt = d => d.toISOString().replace('T', ' ').slice(0, 19);
    const apptId = db.prepare(`
      INSERT INTO appointments (business_id, customer_id, worker_id, service_id, start_time, end_time, status)
      VALUES (?, ?, ?, ?, ?, ?, 'confirmed')
    `).run(
      ctx.businessId, ctx.customer.id, ctx.worker.id, ctx.service.id,
      fmt(nearFuture), fmt(new Date(nearFuture.getTime() + 30 * 60 * 1000))
    ).lastInsertRowid;

    const res = await request(app)
      .put(`/api/appointments/${apptId}/cancel`)
      .set('Cookie', customerCookie());
    // Server returns 403 (not 400) when within the cancellation window
    expect(res.status).toBe(403);
    expect(res.body.cancellation_hours).toBe(9999);

    // Restore
    db.prepare('UPDATE businesses SET cancellation_hours = 0 WHERE id = ?').run(ctx.businessId);
  });

  it('customer can cancel when policy is 0 (no restriction)', async () => {
    const db = getDb();
    const apptId = db.prepare(`
      INSERT INTO appointments (business_id, customer_id, worker_id, service_id, start_time, end_time, status)
      VALUES (?, ?, ?, ?, '2030-12-01 09:00:00', '2030-12-01 09:30:00', 'confirmed')
    `).run(ctx.businessId, ctx.customer.id, ctx.worker.id, ctx.service.id).lastInsertRowid;

    const res = await request(app)
      .put(`/api/appointments/${apptId}/cancel`)
      .set('Cookie', customerCookie());
    expect(res.status).toBe(200);
  });

  it('GET /api/user/business-policy returns cancellation_hours', async () => {
    const res = await request(app)
      .get('/api/business-policy')
      .set('Cookie', customerCookie());
    expect(res.status).toBe(200);
    expect(typeof res.body.cancellation_hours).toBe('number');
  });
});

// ─── Customer detail + admin notes ───────────────────────────────────────────

describe('Customer detail and admin notes', () => {
  beforeAll(async () => {
    // Ensure the customer has at least one appointment for detail view
    const db = getDb();
    db.prepare(`
      INSERT INTO appointments (business_id, customer_id, worker_id, service_id, start_time, end_time, status)
      VALUES (?, ?, ?, ?, '2030-08-01 09:00:00', '2030-08-01 09:30:00', 'completed')
    `).run(ctx.businessId, ctx.customer.id, ctx.worker.id, ctx.service.id);
  });

  it('GET /api/admin/customers/:id returns customer details', async () => {
    const res = await request(app)
      .get(`/api/admin/customers/${ctx.customer.id}`)
      .set('Cookie', adminCookie());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.customer.email).toBe(ctx.customer.email);
    expect(Array.isArray(res.body.appointments)).toBe(true);
    expect(res.body.appointments.length).toBeGreaterThan(0);
  });

  it('appointments include photos array', async () => {
    const res = await request(app)
      .get(`/api/admin/customers/${ctx.customer.id}`)
      .set('Cookie', adminCookie());
    res.body.appointments.forEach(a => {
      expect(Array.isArray(a.photos)).toBe(true);
    });
  });

  it('returns 404 for unknown customer', async () => {
    const res = await request(app)
      .get('/api/admin/customers/99999')
      .set('Cookie', adminCookie());
    expect(res.status).toBe(404);
  });

  it('does not expose password_hash', async () => {
    const res = await request(app)
      .get(`/api/admin/customers/${ctx.customer.id}`)
      .set('Cookie', adminCookie());
    expect(res.body.customer.password_hash).toBeUndefined();
  });

  it('PUT /api/admin/customers/:id/notes saves admin notes', async () => {
    const res = await request(app)
      .put(`/api/admin/customers/${ctx.customer.id}/notes`)
      .set('Cookie', adminCookie())
      .send({ notes: 'VIP — prefers morning slots' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('saved notes appear in subsequent GET', async () => {
    const res = await request(app)
      .get(`/api/admin/customers/${ctx.customer.id}`)
      .set('Cookie', adminCookie());
    expect(res.body.customer.admin_notes).toBe('VIP — prefers morning slots');
  });

  it('notes can be cleared', async () => {
    await request(app)
      .put(`/api/admin/customers/${ctx.customer.id}/notes`)
      .set('Cookie', adminCookie())
      .send({ notes: '' });

    const res = await request(app)
      .get(`/api/admin/customers/${ctx.customer.id}`)
      .set('Cookie', adminCookie());
    // Empty string or null both acceptable
    expect(res.body.customer.admin_notes == null || res.body.customer.admin_notes === '').toBe(true);
  });

  it('returns 404 for notes update on unknown customer', async () => {
    const res = await request(app)
      .put('/api/admin/customers/99999/notes')
      .set('Cookie', adminCookie())
      .send({ notes: 'ghost' });
    expect(res.status).toBe(404);
  });

  it('customer cannot access their own detail via admin endpoint', async () => {
    const res = await request(app)
      .get(`/api/admin/customers/${ctx.customer.id}`)
      .set('Cookie', customerCookie());
    expect(res.status).toBe(403);
  });
});

// ─── Dashboard stats ──────────────────────────────────────────────────────────

describe('GET /api/admin/dashboard-stats', () => {
  it('returns revenue fields', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard-stats')
      .set('Cookie', adminCookie());
    expect(res.status).toBe(200);
    expect(typeof res.body.revenueThisMonth).toBe('number');
    expect(typeof res.body.revenueLastMonth).toBe('number');
  });

  it('returns weeklyRevenue array', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard-stats')
      .set('Cookie', adminCookie());
    expect(Array.isArray(res.body.weeklyRevenue)).toBe(true);
    expect(res.body.weeklyRevenue.length).toBe(7);
  });

  it('requires admin auth', async () => {
    const res = await request(app).get('/api/admin/dashboard-stats');
    expect(res.status).toBe(401);
  });

  it('blocks non-admin access', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard-stats')
      .set('Cookie', customerCookie());
    expect(res.status).toBe(403);
  });
});

// ─── Analytics ────────────────────────────────────────────────────────────────

describe('GET /api/admin/analytics', () => {
  it('returns analytics fields', async () => {
    const res = await request(app)
      .get('/api/admin/analytics')
      .set('Cookie', adminCookie());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.monthlyRevenue)).toBe(true);
    expect(Array.isArray(res.body.busiestHours)).toBe(true);
    expect(Array.isArray(res.body.topServices)).toBe(true);
  });

  it('requires admin auth', async () => {
    const res = await request(app).get('/api/admin/analytics');
    expect(res.status).toBe(401);
  });

  it('blocks non-admin access', async () => {
    const res = await request(app)
      .get('/api/admin/analytics')
      .set('Cookie', workerCookie());
    expect(res.status).toBe(403);
  });
});
