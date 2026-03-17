const { test, expect } = require('@playwright/test');

const BASE_API = '/api';

test.describe('Authentication API', () => {
  const slug = `e2e-auth-${Date.now()}`;
  const adminEmail = `admin-${slug}@e2e.test`;
  const adminPassword = 'password123';

  test.beforeAll(async ({ request }) => {
    await request.post(`${BASE_API}/register-business`, {
      data: {
        businessName: 'E2E Auth Biz',
        businessType: 'default',
        ownerName: 'E2E Admin',
        email: adminEmail,
        password: adminPassword,
        slug,
      },
    });
  });

  test('login succeeds with valid credentials', async ({ request }) => {
    const res = await request.post(`${BASE_API}/auth/login`, {
      data: { email: adminEmail, password: adminPassword },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.user.email).toBe(adminEmail);
  });

  test('login fails with wrong password', async ({ request }) => {
    const res = await request.post(`${BASE_API}/auth/login`, {
      data: { email: adminEmail, password: 'wrongpassword' },
    });
    expect(res.status()).toBe(401);
  });

  test('getMe returns user when authenticated', async ({ request }) => {
    await request.post(`${BASE_API}/auth/login`, {
      data: { email: adminEmail, password: adminPassword },
    });
    const meRes = await request.get(`${BASE_API}/auth/me`);
    expect(meRes.status()).toBe(200);
    const body = await meRes.json();
    expect(body.user.email).toBe(adminEmail);
  });

  test('logout clears session', async ({ request }) => {
    await request.post(`${BASE_API}/auth/login`, {
      data: { email: adminEmail, password: adminPassword },
    });
    await request.post(`${BASE_API}/auth/logout`);

    const meRes = await request.get(`${BASE_API}/auth/me`);
    expect(meRes.status()).toBe(401);
  });
});
