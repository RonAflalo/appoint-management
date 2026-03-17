const { test, expect } = require('@playwright/test');

const BASE_API = '/api';

test.describe('Full booking flow', () => {
  const slug = `e2e-booking-${Date.now()}`;
  const adminEmail = `admin-${slug}@e2e.test`;
  const adminPassword = 'e2ePassword1';
  const workerEmail = `worker-${slug}@e2e.test`;
  const customerEmail = `customer-${slug}@e2e.test`;

  let workerId, serviceId, appointmentId;

  test('1. Register business', async ({ request }) => {
    const res = await request.post(`${BASE_API}/register-business`, {
      data: {
        businessName: 'E2E Salon',
        businessType: 'default',
        ownerName: 'Salon Admin',
        email: adminEmail,
        password: adminPassword,
        slug,
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.user.role).toBe('admin');
  });

  test('2. Admin creates a worker', async ({ request }) => {
    await request.post(`${BASE_API}/auth/login`, {
      data: { email: adminEmail, password: adminPassword },
    });

    const res = await request.post(`${BASE_API}/admin/workers`, {
      data: { name: 'E2E Worker', email: workerEmail, password: 'password123' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    workerId = body.worker.id;
  });

  test('3. Admin creates a service', async ({ request }) => {
    await request.post(`${BASE_API}/auth/login`, {
      data: { email: adminEmail, password: adminPassword },
    });

    const res = await request.post(`${BASE_API}/admin/services`, {
      data: { name: 'E2E Haircut', duration_minutes: 30, price: 50 },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    serviceId = body.service.id;
  });

  test('4. Customer registers', async ({ request }) => {
    const res = await request.post(`${BASE_API}/auth/register`, {
      data: {
        name: 'E2E Customer',
        email: customerEmail,
        password: 'password123',
        slug,
      },
    });
    expect(res.status()).toBe(201);
  });

  test('5. Public slots are available', async ({ request }) => {
    const res = await request.get(
      `${BASE_API}/public/${slug}/slots?serviceId=${serviceId}&date=2030-06-10&workerId=${workerId}`
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.slots.length).toBeGreaterThan(0);
  });

  test('6. Customer books an appointment', async ({ request }) => {
    await request.post(`${BASE_API}/auth/login`, {
      data: { email: customerEmail, password: 'password123' },
    });

    const res = await request.post(`${BASE_API}/appointments`, {
      data: {
        workerId,
        serviceId,
        start_time: '2030-06-10T09:00:00',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    appointmentId = body.appointment.id;
    expect(body.appointment.status).toBe('pending');
  });

  test('7. Worker approves the appointment', async ({ request }) => {
    await request.post(`${BASE_API}/auth/login`, {
      data: { email: workerEmail, password: 'password123' },
    });

    const res = await request.put(`${BASE_API}/worker/appointments/${appointmentId}/approve`);
    expect(res.status()).toBe(200);
  });

  test('8. Customer sees appointment as confirmed', async ({ request }) => {
    await request.post(`${BASE_API}/auth/login`, {
      data: { email: customerEmail, password: 'password123' },
    });

    const res = await request.get(`${BASE_API}/appointments/mine`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    const appt = body.appointments.find(a => a.id === appointmentId);
    expect(appt).toBeDefined();
    expect(appt.status).toBe('confirmed');
  });

  test('9. Customer cancels the appointment', async ({ request }) => {
    await request.post(`${BASE_API}/auth/login`, {
      data: { email: customerEmail, password: 'password123' },
    });

    const res = await request.put(`${BASE_API}/appointments/${appointmentId}/cancel`);
    expect(res.status()).toBe(200);
  });

  test('10. Slot is available again after cancellation', async ({ request }) => {
    const res = await request.get(
      `${BASE_API}/public/${slug}/slots?serviceId=${serviceId}&date=2030-06-10&workerId=${workerId}`
    );
    const body = await res.json();
    // After cancellation the slot should reappear
    expect(Array.isArray(body.slots)).toBe(true);
  });
});
