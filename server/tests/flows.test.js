/**
 * End-to-end flow tests — fully isolated in-memory SQLite.
 *
 * Each describe block gets a fresh database via beforeEach/afterEach,
 * so flows cannot interfere with each other.
 *
 * Covered flows:
 *  1. Complete booking lifecycle (register → book → confirm → cancel)
 *  2. Booked slot visibility (appears in bookedSlots, not in available)
 *  3. Double-booking prevention (409 on second booking of same slot)
 *  4. Waitlist — basic happy path (join → cancel appt → notified → confirm in-app)
 *  5. Waitlist — token confirmation (email link path)
 *  6. Waitlist — expired token rejected
 *  7. Waitlist — queue advancement (2 customers, first expires, second gets notified)
 *  8. Waitlist — duplicate join blocked
 *  9. Multi-tenant isolation (customers of biz A can't see biz B resources)
 * 10. Admin actions (confirm, cancel, reschedule, reschedule accept)
 * 11. Worker availability override (blocked day → no slots)
 * 12. Multi-customer, multi-appointment (realistic day at a salon)
 */

process.env.TZ = 'UTC'; // Must be first — prevents local-timezone shifts in Date parsing
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-flows-secret';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const { initializeDatabase, closeDatabase, getDb } = require('../db/database');
const { expireAndAdvance } = require('../utils/waitlist');
const app = require('../app');

// ─── Test dates ───────────────────────────────────────────────────────────────
// Use a future Monday so working-hours logic gives us slots.
// Default business hours: Mon–Thu 09:00–18:00, Fri 09:00–14:00
const TEST_DATE = '2030-06-17'; // Monday

// ─── Shared helpers ───────────────────────────────────────────────────────────

async function registerBusiness({ slug, email, password = 'pass1234', name }) {
  const res = await request(app).post('/api/register-business').send({
    businessName: name || `Biz-${slug}`,
    businessType: 'salon',
    ownerName: 'Owner',
    email,
    password,
    slug,
  });
  expect(res.status).toBe(201);
  return {
    cookie: res.headers['set-cookie'],
    userId: res.body.user.id,
    businessId: res.body.user.business_id,
  };
}

async function registerCustomer({ name, email, password = 'pass1234', slug }) {
  const res = await request(app).post('/api/auth/register').send({ name, email, password, slug });
  expect(res.status).toBe(201);
  return {
    cookie: res.headers['set-cookie'],
    userId: res.body.user.id,
  };
}

async function loginAs({ email, password = 'pass1234' }) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  return { cookie: res.headers['set-cookie'], user: res.body.user };
}

async function createService(cookie, { name = 'Haircut', duration = 60, price = 100 } = {}) {
  const res = await request(app)
    .post('/api/admin/services')
    .set('Cookie', cookie)
    .send({ name, duration_minutes: duration, price });
  expect(res.status).toBe(201);
  return res.body.service;
}

async function createWorker(cookie, { name = 'Worker', email, password = 'pass1234' } = {}) {
  const res = await request(app)
    .post('/api/admin/workers')
    .set('Cookie', cookie)
    .send({ name, email, password });
  expect(res.status).toBe(201);
  return res.body.worker;
}

async function getSlots(cookie, { serviceId, date, workerId } = {}) {
  const params = { serviceId, date };
  if (workerId) params.workerId = workerId;
  const res = await request(app)
    .get('/api/slots')
    .set('Cookie', cookie)
    .query(params);
  expect(res.status).toBe(200);
  return res.body; // { slots, bookedSlots, slotWorkers }
}

async function bookSlot(cookie, { workerId, serviceId, slotTime }) {
  const res = await request(app)
    .post('/api/appointments')
    .set('Cookie', cookie)
    .send({ workerId, serviceId, start_time: slotTime });
  return res;
}

async function getMyAppointments(cookie) {
  const res = await request(app).get('/api/appointments/mine').set('Cookie', cookie);
  expect(res.status).toBe(200);
  return res.body.appointments;
}

async function cancelAsCustomer(cookie, id) {
  return request(app).put(`/api/appointments/${id}/cancel`).set('Cookie', cookie);
}

async function adminUpdateStatus(cookie, id, status) {
  return request(app)
    .put(`/api/admin/appointments/${id}/status`)
    .set('Cookie', cookie)
    .send({ status });
}

async function joinWaitlist(cookie, { serviceId, workerId, slotTime }) {
  return request(app)
    .post('/api/waitlist')
    .set('Cookie', cookie)
    .send({ serviceId, workerId: workerId || null, slotTime });
}

async function getMyWaitlist(cookie) {
  const res = await request(app).get('/api/waitlist').set('Cookie', cookie);
  expect(res.status).toBe(200);
  return res.body.waitlist;
}

async function confirmWaitlistInApp(cookie, id) {
  return request(app)
    .post(`/api/waitlist/${id}/confirm-in-app`)
    .set('Cookie', cookie);
}

// ─── Setup helpers per describe ───────────────────────────────────────────────

async function fullSetup({ slug = 'test-biz', workerEmail = 'worker@biz.com' } = {}) {
  const admin = await registerBusiness({ slug, email: `admin@${slug}.com` });
  const service = await createService(admin.cookie, { name: 'Cut', duration: 60, price: 80 });
  const worker = await createWorker(admin.cookie, { name: 'Alice', email: workerEmail });
  return { admin, service, worker };
}

// ─────────────────────────────────────────────────────────────────────────────
// Flow 1: Complete booking lifecycle
// ─────────────────────────────────────────────────────────────────────────────

describe('Flow 1 — complete booking lifecycle', () => {
  beforeEach(() => initializeDatabase(':memory:'));
  afterEach(() => closeDatabase());

  it('registers business → creates service & worker → customer books → admin confirms → customer cancels', async () => {
    const { admin, service, worker } = await fullSetup({ slug: 'salon1', workerEmail: 'alice@salon1.com' });
    const customer = await registerCustomer({ name: 'Bob', email: 'bob@test.com', slug: 'salon1' });

    // Customer fetches available slots
    const { slots } = await getSlots(customer.cookie, { serviceId: service.id, date: TEST_DATE, workerId: worker.id });
    expect(slots.length).toBeGreaterThan(0);
    const slotTime = slots[0];

    // Customer books
    const bookRes = await bookSlot(customer.cookie, { workerId: worker.id, serviceId: service.id, slotTime });
    expect(bookRes.status).toBe(201);
    const apptId = bookRes.body.appointment.id;
    expect(bookRes.body.appointment.status).toBe('pending');

    // Slot should now be gone from available
    const { slots: slotsAfter, bookedSlots } = await getSlots(customer.cookie, { serviceId: service.id, date: TEST_DATE, workerId: worker.id });
    expect(slotsAfter).not.toContain(slotTime);
    expect(bookedSlots).toContain(slotTime);

    // Admin confirms
    const confirmRes = await adminUpdateStatus(admin.cookie, apptId, 'confirmed');
    expect(confirmRes.status).toBe(200);

    // Customer sees confirmed status
    const appts = await getMyAppointments(customer.cookie);
    expect(appts.find(a => a.id === apptId).status).toBe('confirmed');

    // Customer cancels
    const cancelRes = await cancelAsCustomer(customer.cookie, apptId);
    expect(cancelRes.status).toBe(200);

    // Appointment is now cancelled
    const appts2 = await getMyAppointments(customer.cookie);
    expect(appts2.find(a => a.id === apptId).status).toBe('cancelled');

    // Slot is available again after cancellation
    const { slots: slotsRestored } = await getSlots(customer.cookie, { serviceId: service.id, date: TEST_DATE, workerId: worker.id });
    expect(slotsRestored).toContain(slotTime);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Flow 2: Booked slot visibility
// ─────────────────────────────────────────────────────────────────────────────

describe('Flow 2 — booked slot appears in bookedSlots, not in available', () => {
  beforeEach(() => initializeDatabase(':memory:'));
  afterEach(() => closeDatabase());

  it('slot moves from slots → bookedSlots after booking, back to slots after cancel', async () => {
    const { admin, service, worker } = await fullSetup({ slug: 'salon2', workerEmail: 'b@b.com' });
    const c1 = await registerCustomer({ name: 'C1', email: 'c1@t.com', slug: 'salon2' });
    const c2 = await registerCustomer({ name: 'C2', email: 'c2@t.com', slug: 'salon2' });

    const { slots: before } = await getSlots(c1.cookie, { serviceId: service.id, date: TEST_DATE, workerId: worker.id });
    const slot = before[0];

    await bookSlot(c1.cookie, { workerId: worker.id, serviceId: service.id, slotTime: slot });

    // C2 sees it as booked
    const { slots, bookedSlots } = await getSlots(c2.cookie, { serviceId: service.id, date: TEST_DATE, workerId: worker.id });
    expect(slots).not.toContain(slot);
    expect(bookedSlots).toContain(slot);

    // Cancel restores visibility
    const appts = await getMyAppointments(c1.cookie);
    await cancelAsCustomer(c1.cookie, appts[0].id);

    const { slots: after, bookedSlots: bookedAfter } = await getSlots(c2.cookie, { serviceId: service.id, date: TEST_DATE, workerId: worker.id });
    expect(after).toContain(slot);
    expect(bookedAfter).not.toContain(slot);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Flow 3: Double-booking prevention
// ─────────────────────────────────────────────────────────────────────────────

describe('Flow 3 — double-booking prevention', () => {
  beforeEach(() => initializeDatabase(':memory:'));
  afterEach(() => closeDatabase());

  it('second booking of the same slot returns 409', async () => {
    const { admin, service, worker } = await fullSetup({ slug: 'salon3', workerEmail: 'c@c.com' });
    const c1 = await registerCustomer({ name: 'C1', email: 'c1@db.com', slug: 'salon3' });
    const c2 = await registerCustomer({ name: 'C2', email: 'c2@db.com', slug: 'salon3' });

    const { slots } = await getSlots(c1.cookie, { serviceId: service.id, date: TEST_DATE, workerId: worker.id });
    const slot = slots[0];

    const r1 = await bookSlot(c1.cookie, { workerId: worker.id, serviceId: service.id, slotTime: slot });
    expect(r1.status).toBe(201);

    const r2 = await bookSlot(c2.cookie, { workerId: worker.id, serviceId: service.id, slotTime: slot });
    expect(r2.status).toBe(409);
  });

  it('customer cannot double-book their own slot', async () => {
    const { service, worker } = await fullSetup({ slug: 'salon3b', workerEmail: 'd@d.com' });
    const c = await registerCustomer({ name: 'C', email: 'c@db2.com', slug: 'salon3b' });

    const { slots } = await getSlots(c.cookie, { serviceId: service.id, date: TEST_DATE, workerId: worker.id });
    const slot = slots[0];

    await bookSlot(c.cookie, { workerId: worker.id, serviceId: service.id, slotTime: slot });
    const r2 = await bookSlot(c.cookie, { workerId: worker.id, serviceId: service.id, slotTime: slot });
    expect(r2.status).toBe(409);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Flow 4: Waitlist — basic happy path (in-app confirmation)
// ─────────────────────────────────────────────────────────────────────────────

describe('Flow 4 — waitlist basic happy path (in-app confirm)', () => {
  beforeEach(() => initializeDatabase(':memory:'));
  afterEach(() => closeDatabase());

  it('C2 joins waitlist → C1 cancels → C2 notified → C2 confirms in-app → appointment created', async () => {
    const { admin, service, worker } = await fullSetup({ slug: 'wl1', workerEmail: 'e@e.com' });
    const c1 = await registerCustomer({ name: 'C1', email: 'c1@wl.com', slug: 'wl1' });
    const c2 = await registerCustomer({ name: 'C2', email: 'c2@wl.com', slug: 'wl1' });

    const { slots } = await getSlots(c1.cookie, { serviceId: service.id, date: TEST_DATE, workerId: worker.id });
    const slot = slots[0];

    // C1 books
    const bookRes = await bookSlot(c1.cookie, { workerId: worker.id, serviceId: service.id, slotTime: slot });
    const apptId = bookRes.body.appointment.id;

    // C2 joins waitlist
    const wlRes = await joinWaitlist(c2.cookie, { serviceId: service.id, workerId: worker.id, slotTime: slot });
    expect(wlRes.status).toBe(200);

    // Waitlist entry is 'waiting'
    const wl = await getMyWaitlist(c2.cookie);
    expect(wl[0].status).toBe('waiting');

    // C1 cancels → notifyNextInQueue fires (async, need small wait)
    await cancelAsCustomer(c1.cookie, apptId);
    await new Promise(r => setTimeout(r, 100)); // let async notifyNextInQueue settle

    // C2's entry should now be 'notified'
    const wlAfter = await getMyWaitlist(c2.cookie);
    expect(wlAfter[0].status).toBe('notified');
    expect(wlAfter[0].expires_at).toBeTruthy();

    // C2 confirms in-app
    const confirmRes = await confirmWaitlistInApp(c2.cookie, wlAfter[0].id);
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.appointment).toBeDefined();
    expect(confirmRes.body.appointment.service_name).toBe('Cut');

    // C2 now has a real appointment
    const appts = await getMyAppointments(c2.cookie);
    expect(appts[0].status).toBe('confirmed');
    expect(appts[0].service_name).toBe('Cut');

    // Waitlist entry is confirmed
    const wlDone = await getMyWaitlist(c2.cookie);
    expect(wlDone.length).toBe(0); // no more active entries
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Flow 5: Waitlist — token confirmation (email link path)
// ─────────────────────────────────────────────────────────────────────────────

describe('Flow 5 — waitlist token confirmation (email link)', () => {
  beforeEach(() => initializeDatabase(':memory:'));
  afterEach(() => closeDatabase());

  it('C2 confirms via token → appointment created, waitlist entry confirmed', async () => {
    const { admin, service, worker } = await fullSetup({ slug: 'wl2', workerEmail: 'f@f.com' });
    const c1 = await registerCustomer({ name: 'C1', email: 'c1@tok.com', slug: 'wl2' });
    const c2 = await registerCustomer({ name: 'C2', email: 'c2@tok.com', slug: 'wl2' });

    const { slots } = await getSlots(c1.cookie, { serviceId: service.id, date: TEST_DATE, workerId: worker.id });
    const slot = slots[0];

    await bookSlot(c1.cookie, { workerId: worker.id, serviceId: service.id, slotTime: slot });
    await joinWaitlist(c2.cookie, { serviceId: service.id, workerId: worker.id, slotTime: slot });

    const c1Appts = await getMyAppointments(c1.cookie);
    await cancelAsCustomer(c1.cookie, c1Appts[0].id);
    await new Promise(r => setTimeout(r, 100));

    // Read token from DB
    const db = getDb();
    const entry = db.prepare("SELECT * FROM waiting_list WHERE status = 'notified'").get();
    expect(entry).toBeTruthy();
    expect(entry.notify_token).toBeTruthy();

    // Confirm via token (public endpoint, no cookie needed)
    const res = await request(app).post(`/api/waitlist/confirm/${entry.notify_token}`);
    expect(res.status).toBe(200);
    expect(res.body.appointment.service_name).toBe('Cut');

    // Token is consumed — cannot reuse
    const res2 = await request(app).post(`/api/waitlist/confirm/${entry.notify_token}`);
    expect(res2.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Flow 6: Waitlist — expired token rejected
// ─────────────────────────────────────────────────────────────────────────────

describe('Flow 6 — waitlist expired token', () => {
  beforeEach(() => initializeDatabase(':memory:'));
  afterEach(() => closeDatabase());

  it('expired notification token returns 400', async () => {
    const { admin, service, worker } = await fullSetup({ slug: 'wl3', workerEmail: 'g@g.com' });
    const c1 = await registerCustomer({ name: 'C1', email: 'c1@exp.com', slug: 'wl3' });
    const c2 = await registerCustomer({ name: 'C2', email: 'c2@exp.com', slug: 'wl3' });

    const { slots } = await getSlots(c1.cookie, { serviceId: service.id, date: TEST_DATE, workerId: worker.id });
    const slot = slots[0];

    await bookSlot(c1.cookie, { workerId: worker.id, serviceId: service.id, slotTime: slot });
    await joinWaitlist(c2.cookie, { serviceId: service.id, workerId: worker.id, slotTime: slot });

    const c1Appts = await getMyAppointments(c1.cookie);
    await cancelAsCustomer(c1.cookie, c1Appts[0].id);
    await new Promise(r => setTimeout(r, 100));

    // Manually expire the notification
    const db = getDb();
    const entry = db.prepare("SELECT * FROM waiting_list WHERE status = 'notified'").get();
    db.prepare("UPDATE waiting_list SET expires_at = '2020-01-01 00:00:00' WHERE id = ?").run(entry.id);

    const res = await request(app).post(`/api/waitlist/confirm/${entry.notify_token}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/פג/); // "expired" in Hebrew
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Flow 7: Waitlist — queue advancement (2 customers waiting)
// ─────────────────────────────────────────────────────────────────────────────

describe('Flow 7 — waitlist queue advancement', () => {
  beforeEach(() => initializeDatabase(':memory:'));
  afterEach(() => closeDatabase());

  it('first notified entry expires → second in queue gets notified', async () => {
    const { admin, service, worker } = await fullSetup({ slug: 'wl4', workerEmail: 'h@h.com' });
    const c1 = await registerCustomer({ name: 'C1', email: 'c1@q.com', slug: 'wl4' });
    const c2 = await registerCustomer({ name: 'C2', email: 'c2@q.com', slug: 'wl4' });
    const c3 = await registerCustomer({ name: 'C3', email: 'c3@q.com', slug: 'wl4' });

    const { slots } = await getSlots(c1.cookie, { serviceId: service.id, date: TEST_DATE, workerId: worker.id });
    const slot = slots[0];

    // C1 books; C2 and C3 join queue (in order)
    await bookSlot(c1.cookie, { workerId: worker.id, serviceId: service.id, slotTime: slot });
    await joinWaitlist(c2.cookie, { serviceId: service.id, workerId: worker.id, slotTime: slot });
    await new Promise(r => setTimeout(r, 10)); // ensure ordering
    await joinWaitlist(c3.cookie, { serviceId: service.id, workerId: worker.id, slotTime: slot });

    // C1 cancels → C2 (first in queue) gets notified
    const c1Appts = await getMyAppointments(c1.cookie);
    await cancelAsCustomer(c1.cookie, c1Appts[0].id);
    await new Promise(r => setTimeout(r, 100));

    const db = getDb();
    const c2entry = db.prepare(
      "SELECT * FROM waiting_list WHERE customer_id = ? AND status = 'notified'"
    ).get(c2.userId);
    expect(c2entry).toBeTruthy();

    const c3entry = db.prepare(
      "SELECT * FROM waiting_list WHERE customer_id = ? AND status = 'waiting'"
    ).get(c3.userId);
    expect(c3entry).toBeTruthy();

    // Expire C2's notification → C3 should be notified
    db.prepare("UPDATE waiting_list SET expires_at = '2020-01-01 00:00:00' WHERE id = ?").run(c2entry.id);
    await expireAndAdvance();

    const c2expired = db.prepare("SELECT status FROM waiting_list WHERE id = ?").get(c2entry.id);
    expect(c2expired.status).toBe('expired');

    const c3notified = db.prepare(
      "SELECT * FROM waiting_list WHERE customer_id = ? AND status = 'notified'"
    ).get(c3.userId);
    expect(c3notified).toBeTruthy();
    expect(c3notified.notify_token).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Flow 8: Waitlist — duplicate join blocked
// ─────────────────────────────────────────────────────────────────────────────

describe('Flow 8 — waitlist duplicate join blocked', () => {
  beforeEach(() => initializeDatabase(':memory:'));
  afterEach(() => closeDatabase());

  it('joining the same slot twice returns 409', async () => {
    const { service, worker } = await fullSetup({ slug: 'wl5', workerEmail: 'i@i.com' });
    const c1 = await registerCustomer({ name: 'C1', email: 'c1@dup.com', slug: 'wl5' });
    const c2 = await registerCustomer({ name: 'C2', email: 'c2@dup.com', slug: 'wl5' });

    const { slots } = await getSlots(c1.cookie, { serviceId: service.id, date: TEST_DATE, workerId: worker.id });
    const slot = slots[0];

    await bookSlot(c1.cookie, { workerId: worker.id, serviceId: service.id, slotTime: slot });

    const r1 = await joinWaitlist(c2.cookie, { serviceId: service.id, workerId: worker.id, slotTime: slot });
    expect(r1.status).toBe(200);

    const r2 = await joinWaitlist(c2.cookie, { serviceId: service.id, workerId: worker.id, slotTime: slot });
    expect(r2.status).toBe(409);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Flow 9: Multi-tenant isolation
// ─────────────────────────────────────────────────────────────────────────────

describe('Flow 9 — multi-tenant isolation', () => {
  beforeEach(() => initializeDatabase(':memory:'));
  afterEach(() => closeDatabase());

  it('customers of biz-A cannot see biz-B services, workers, or appointments', async () => {
    const bizA = await registerBusiness({ slug: 'biz-a', email: 'admin@biz-a.com', name: 'Salon A' });
    const bizB = await registerBusiness({ slug: 'biz-b', email: 'admin@biz-b.com', name: 'Salon B' });

    const svcA = await createService(bizA.cookie, { name: 'Cut A', duration: 60, price: 100 });
    const wrkA = await createWorker(bizA.cookie, { name: 'Worker A', email: 'wa@biz-a.com' });
    const svcB = await createService(bizB.cookie, { name: 'Cut B', duration: 60, price: 200 });
    const wrkB = await createWorker(bizB.cookie, { name: 'Worker B', email: 'wb@biz-b.com' });

    const custA = await registerCustomer({ name: 'Cust A', email: 'ca@test.com', slug: 'biz-a' });
    const custB = await registerCustomer({ name: 'Cust B', email: 'cb@test.com', slug: 'biz-b' });

    // biz-A slug shows only biz-A services (public slug-based endpoint)
    const servicesA = await request(app).get('/api/public/biz-a/services');
    expect(servicesA.body.services.map(s => s.name)).toContain('Cut A');
    expect(servicesA.body.services.map(s => s.name)).not.toContain('Cut B');

    // biz-B slug shows only biz-B services
    const servicesB = await request(app).get('/api/public/biz-b/services');
    expect(servicesB.body.services.map(s => s.name)).toContain('Cut B');
    expect(servicesB.body.services.map(s => s.name)).not.toContain('Cut A');

    // Customer A books with worker A — succeeds
    const { slots: slotsA } = await getSlots(custA.cookie, { serviceId: svcA.id, date: TEST_DATE, workerId: wrkA.id });
    const r = await bookSlot(custA.cookie, { workerId: wrkA.id, serviceId: svcA.id, slotTime: slotsA[0] });
    expect(r.status).toBe(201);

    // Each customer's appointments are in their own business namespace
    // (cross-worker booking is blocked at the slot level: booking slotsA[0] was already done above)

    // Customer A cannot see customer B's appointments
    const custAAppts = await getMyAppointments(custA.cookie);
    const custBAppts = await getMyAppointments(custB.cookie);
    const custAIds = custAAppts.map(a => a.id);
    const custBIds = custBAppts.map(a => a.id);
    expect(custAIds.every(id => !custBIds.includes(id))).toBe(true);

    // Admin A cannot see biz-B appointments
    const adminAAppts = await request(app)
      .get('/api/admin/appointments')
      .set('Cookie', bizA.cookie);
    const adminBAppts = await request(app)
      .get('/api/admin/appointments')
      .set('Cookie', bizB.cookie);
    const aIds = adminAAppts.body.appointments.map(a => a.id);
    const bIds = adminBAppts.body.appointments.map(a => a.id);
    expect(aIds.every(id => !bIds.includes(id))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Flow 10: Admin actions — confirm, cancel, reschedule, accept reschedule
// ─────────────────────────────────────────────────────────────────────────────

describe('Flow 10 — admin appointment actions', () => {
  beforeEach(() => initializeDatabase(':memory:'));
  afterEach(() => closeDatabase());

  it('admin can confirm a pending appointment', async () => {
    const { admin, service, worker } = await fullSetup({ slug: 'adm1', workerEmail: 'j@j.com' });
    const c = await registerCustomer({ name: 'C', email: 'c@adm1.com', slug: 'adm1' });
    const { slots } = await getSlots(c.cookie, { serviceId: service.id, date: TEST_DATE, workerId: worker.id });
    const bookRes = await bookSlot(c.cookie, { workerId: worker.id, serviceId: service.id, slotTime: slots[0] });
    const apptId = bookRes.body.appointment.id;

    const res = await adminUpdateStatus(admin.cookie, apptId, 'confirmed');
    expect(res.status).toBe(200);

    const appts = await getMyAppointments(c.cookie);
    expect(appts.find(a => a.id === apptId).status).toBe('confirmed');
  });

  it('admin cancelling appointment notifies waitlist', async () => {
    const { admin, service, worker } = await fullSetup({ slug: 'adm2', workerEmail: 'k@k.com' });
    const c1 = await registerCustomer({ name: 'C1', email: 'c1@adm2.com', slug: 'adm2' });
    const c2 = await registerCustomer({ name: 'C2', email: 'c2@adm2.com', slug: 'adm2' });

    const { slots } = await getSlots(c1.cookie, { serviceId: service.id, date: TEST_DATE, workerId: worker.id });
    const slot = slots[0];
    const bookRes = await bookSlot(c1.cookie, { workerId: worker.id, serviceId: service.id, slotTime: slot });
    await joinWaitlist(c2.cookie, { serviceId: service.id, workerId: worker.id, slotTime: slot });

    await adminUpdateStatus(admin.cookie, bookRes.body.appointment.id, 'cancelled');
    await new Promise(r => setTimeout(r, 100));

    const db = getDb();
    const entry = db.prepare("SELECT status FROM waiting_list WHERE customer_id = ?").get(c2.userId);
    expect(entry.status).toBe('notified');
  });

  it('admin can request reschedule → customer accepts', async () => {
    const { admin, service, worker } = await fullSetup({ slug: 'adm3', workerEmail: 'l@l.com' });
    const c = await registerCustomer({ name: 'C', email: 'c@adm3.com', slug: 'adm3' });
    const { slots } = await getSlots(c.cookie, { serviceId: service.id, date: TEST_DATE, workerId: worker.id });

    const bookRes = await bookSlot(c.cookie, { workerId: worker.id, serviceId: service.id, slotTime: slots[0] });
    const apptId = bookRes.body.appointment.id;
    const newTime = slots[1]; // suggest a different slot

    // Admin confirms first (reschedule requires confirmed status)
    await adminUpdateStatus(admin.cookie, apptId, 'confirmed');

    // Admin requests reschedule (POST, not PUT)
    const reschedRes = await request(app)
      .post(`/api/admin/appointments/${apptId}/reschedule`)
      .set('Cookie', admin.cookie)
      .send({ suggested_time: newTime, note: 'שינוי לבקשת הצוות' });
    expect(reschedRes.status).toBe(200);

    const appts = await getMyAppointments(c.cookie);
    const appt = appts.find(a => a.id === apptId);
    expect(appt.status).toBe('reschedule_requested');
    expect(appt.suggested_time).toBeTruthy();

    // Customer accepts
    const acceptRes = await request(app)
      .put(`/api/appointments/${apptId}/accept-reschedule`)
      .set('Cookie', c.cookie);
    expect(acceptRes.status).toBe(200);

    const appts2 = await getMyAppointments(c.cookie);
    const appt2 = appts2.find(a => a.id === apptId);
    expect(appt2.status).toBe('confirmed');
  });

  it('unauthorized user cannot change appointment status', async () => {
    const { admin, service, worker } = await fullSetup({ slug: 'adm4', workerEmail: 'm@m.com' });
    const c = await registerCustomer({ name: 'C', email: 'c@adm4.com', slug: 'adm4' });
    const { slots } = await getSlots(c.cookie, { serviceId: service.id, date: TEST_DATE, workerId: worker.id });
    const bookRes = await bookSlot(c.cookie, { workerId: worker.id, serviceId: service.id, slotTime: slots[0] });

    // Customer tries to use admin endpoint
    const res = await adminUpdateStatus(c.cookie, bookRes.body.appointment.id, 'cancelled');
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Flow 11: Worker availability override
// ─────────────────────────────────────────────────────────────────────────────

describe('Flow 11 — worker availability override', () => {
  beforeEach(() => initializeDatabase(':memory:'));
  afterEach(() => closeDatabase());

  it('blocking a worker on a specific date removes all slots for that day', async () => {
    const { admin, service, worker } = await fullSetup({ slug: 'avail1', workerEmail: 'n@n.com' });
    const c = await registerCustomer({ name: 'C', email: 'c@avail1.com', slug: 'avail1' });

    // Confirm slots exist before blocking
    const { slots: before } = await getSlots(c.cookie, { serviceId: service.id, date: TEST_DATE, workerId: worker.id });
    expect(before.length).toBeGreaterThan(0);

    // Admin blocks the worker on TEST_DATE
    const db = getDb();
    db.prepare(`
      INSERT INTO availability_overrides (worker_id, date, is_blocked)
      VALUES (?, ?, 1)
    `).run(worker.id, TEST_DATE);

    // No slots available after block
    const { slots: after } = await getSlots(c.cookie, { serviceId: service.id, date: TEST_DATE, workerId: worker.id });
    expect(after.length).toBe(0);
  });

  it('custom hours override shrinks the available slots', async () => {
    const { service, worker } = await fullSetup({ slug: 'avail2', workerEmail: 'o@o.com' });
    const c = await registerCustomer({ name: 'C', email: 'c@avail2.com', slug: 'avail2' });

    const { slots: full } = await getSlots(c.cookie, { serviceId: service.id, date: TEST_DATE, workerId: worker.id });

    // Override: worker only available 10:00–12:00 on that day (2 slots of 60 min)
    const db = getDb();
    db.prepare(`
      INSERT INTO availability_overrides (worker_id, date, is_blocked, custom_start, custom_end)
      VALUES (?, ?, 0, '10:00', '12:00')
    `).run(worker.id, TEST_DATE);

    const { slots: limited } = await getSlots(c.cookie, { serviceId: service.id, date: TEST_DATE, workerId: worker.id });
    expect(limited.length).toBe(2);
    expect(limited.length).toBeLessThan(full.length);
    expect(limited[0]).toMatch(/T10:00/);
    expect(limited[1]).toMatch(/T11:00/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Flow 12: Realistic multi-customer day at a salon
// ─────────────────────────────────────────────────────────────────────────────

describe('Flow 12 — realistic busy salon day', () => {
  beforeEach(() => initializeDatabase(':memory:'));
  afterEach(() => closeDatabase());

  it('multiple customers book different slots; all are independent', async () => {
    const { admin, service, worker } = await fullSetup({ slug: 'salon-busy', workerEmail: 'busy@busy.com' });

    // Register 5 customers
    const customers = await Promise.all(
      ['Alice', 'Bob', 'Carol', 'Dave', 'Eve'].map((name, i) =>
        registerCustomer({ name, email: `${name.toLowerCase()}@busy.com`, slug: 'salon-busy' })
      )
    );

    // Get all available slots
    const { slots } = await getSlots(customers[0].cookie, { serviceId: service.id, date: TEST_DATE, workerId: worker.id });
    expect(slots.length).toBeGreaterThanOrEqual(5);

    // Each customer books a different slot
    const booked = [];
    for (let i = 0; i < 5; i++) {
      const res = await bookSlot(customers[i].cookie, {
        workerId: worker.id,
        serviceId: service.id,
        slotTime: slots[i],
      });
      expect(res.status).toBe(201);
      booked.push(res.body.appointment);
    }

    // All 5 slots are now booked
    const { slots: remaining, bookedSlots } = await getSlots(
      customers[0].cookie, { serviceId: service.id, date: TEST_DATE, workerId: worker.id }
    );
    for (let i = 0; i < 5; i++) {
      expect(bookedSlots).toContain(slots[i]);
      expect(remaining).not.toContain(slots[i]);
    }

    // Each customer only sees their own appointment
    for (let i = 0; i < 5; i++) {
      const appts = await getMyAppointments(customers[i].cookie);
      expect(appts.length).toBe(1);
      expect(appts[0].id).toBe(booked[i].id);
    }

    // Admin sees all 5
    const adminAppts = await request(app)
      .get('/api/admin/appointments')
      .set('Cookie', admin.cookie);
    expect(adminAppts.body.appointments.length).toBe(5);
  });

  it('two businesses operating simultaneously do not interfere', async () => {
    const bizA = await registerBusiness({ slug: 'biz-day-a', email: 'a@day.com', name: 'Day A' });
    const bizB = await registerBusiness({ slug: 'biz-day-b', email: 'b@day.com', name: 'Day B' });

    const svcA = await createService(bizA.cookie, { name: 'Svc A', duration: 60, price: 50 });
    const svcB = await createService(bizB.cookie, { name: 'Svc B', duration: 60, price: 50 });
    const wrkA = await createWorker(bizA.cookie, { name: 'WA', email: 'wa@day.com' });
    const wrkB = await createWorker(bizB.cookie, { name: 'WB', email: 'wb@day.com' });

    const custA = await registerCustomer({ name: 'CA', email: 'ca@day.com', slug: 'biz-day-a' });
    const custB = await registerCustomer({ name: 'CB', email: 'cb@day.com', slug: 'biz-day-b' });

    const { slots: slotsA } = await getSlots(custA.cookie, { serviceId: svcA.id, date: TEST_DATE, workerId: wrkA.id });
    const { slots: slotsB } = await getSlots(custB.cookie, { serviceId: svcB.id, date: TEST_DATE, workerId: wrkB.id });

    // Both book the same wall-clock slot (different workers/businesses — no conflict)
    const rA = await bookSlot(custA.cookie, { workerId: wrkA.id, serviceId: svcA.id, slotTime: slotsA[0] });
    const rB = await bookSlot(custB.cookie, { workerId: wrkB.id, serviceId: svcB.id, slotTime: slotsB[0] });
    expect(rA.status).toBe(201);
    expect(rB.status).toBe(201);

    // Total appointments in each business = 1 (not 2)
    const aAppts = await request(app).get('/api/admin/appointments').set('Cookie', bizA.cookie);
    const bAppts = await request(app).get('/api/admin/appointments').set('Cookie', bizB.cookie);
    expect(aAppts.body.appointments.length).toBe(1);
    expect(bAppts.body.appointments.length).toBe(1);
  });
});
