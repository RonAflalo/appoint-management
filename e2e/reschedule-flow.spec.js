const { test, expect } = require('@playwright/test');

const BASE_API = '/api';

/**
 * Reschedule flow:
 * Admin confirms → Worker requests reschedule → Customer accepts
 */
test.describe('Reschedule flow', () => {
  const slug = `e2e-reschedule-${Date.now()}`;
  const adminEmail = `admin-${slug}@e2e.test`;
  const workerEmail = `worker-${slug}@e2e.test`;
  const customerEmail = `customer-${slug}@e2e.test`;

  let workerId, serviceId, appointmentId;

  test.beforeAll(async ({ request }) => {
    // Register business
    await request.post(`${BASE_API}/register-business`, {
      data: { businessName: 'Reschedule Biz', businessType: 'default', ownerName: 'Admin', email: adminEmail, password: 'password123', slug },
    });

    // Login as admin, create worker + service
    await request.post(`${BASE_API}/auth/login`, { data: { email: adminEmail, password: 'password123' } });
    const workerRes = await request.post(`${BASE_API}/admin/workers`, {
      data: { name: 'RS Worker', email: workerEmail, password: 'password123' },
    });
    workerId = (await workerRes.json()).worker.id;

    const serviceRes = await request.post(`${BASE_API}/admin/services`, {
      data: { name: 'RS Haircut', duration_minutes: 30, price: 50 },
    });
    serviceId = (await serviceRes.json()).service.id;

    // Register + login as customer, book appointment
    await request.post(`${BASE_API}/auth/register`, {
      data: { name: 'RS Customer', email: customerEmail, password: 'password123', slug },
    });
    await request.post(`${BASE_API}/auth/login`, { data: { email: customerEmail, password: 'password123' } });
    const bookRes = await request.post(`${BASE_API}/appointments`, {
      data: { workerId, serviceId, start_time: '2030-07-01T09:00:00' },
    });
    appointmentId = (await bookRes.json()).appointment.id;

    // Admin confirms it
    await request.post(`${BASE_API}/auth/login`, { data: { email: adminEmail, password: 'password123' } });
    await request.put(`${BASE_API}/admin/appointments/${appointmentId}/status`, { data: { status: 'confirmed' } });
  });

  test('worker can request a reschedule', async ({ request }) => {
    await request.post(`${BASE_API}/auth/login`, { data: { email: workerEmail, password: 'password123' } });

    const res = await request.put(`${BASE_API}/worker/appointments/${appointmentId}/reschedule-request`, {
      data: { suggested_time: '2030-07-02T10:00:00', note: 'Please come at 10am' },
    });
    expect(res.status()).toBe(200);
  });

  test('customer can see the reschedule request', async ({ request }) => {
    await request.post(`${BASE_API}/auth/login`, { data: { email: customerEmail, password: 'password123' } });

    const res = await request.get(`${BASE_API}/appointments/mine`);
    const body = await res.json();
    const appt = body.appointments.find(a => a.id === appointmentId);
    expect(appt.status).toBe('reschedule_requested');
    expect(appt.suggested_time).toContain('2030-07-02');
    expect(appt.reschedule_note).toBe('Please come at 10am');
  });

  test('customer accepts the reschedule', async ({ request }) => {
    await request.post(`${BASE_API}/auth/login`, { data: { email: customerEmail, password: 'password123' } });

    const res = await request.put(`${BASE_API}/appointments/${appointmentId}/accept-reschedule`);
    expect(res.status()).toBe(200);
  });

  test('appointment time is updated to suggested time', async ({ request }) => {
    await request.post(`${BASE_API}/auth/login`, { data: { email: customerEmail, password: 'password123' } });

    const res = await request.get(`${BASE_API}/appointments/mine`);
    const body = await res.json();
    const appt = body.appointments.find(a => a.id === appointmentId);
    expect(appt.status).toBe('confirmed');
    expect(appt.start_time).toContain('2030-07-02');
  });
});
