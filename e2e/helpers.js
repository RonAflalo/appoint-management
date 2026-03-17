/**
 * Shared E2E helpers.
 *
 * NOTE: E2E tests hit a running server (see playwright.config.js webServer).
 * They require a pre-seeded database or use the register-business API to set up data.
 */

const BASE = 'http://localhost:3001/api';

/**
 * Register a fresh business + admin account via the API and return credentials.
 */
async function registerBusiness(request, { slug, adminEmail = `admin-${slug}@e2e.test` } = {}) {
  const res = await request.post(`${BASE}/register-business`, {
    data: {
      businessName: `E2E Business ${slug}`,
      slug,
      adminName: 'E2E Admin',
      adminEmail,
      adminPassword: 'password123',
    },
  });
  return { adminEmail, adminPassword: 'password123', slug };
}

/**
 * Perform a login via the API and return the Set-Cookie header value.
 */
async function apiLogin(request, email, password) {
  const res = await request.post(`${BASE}/auth/login`, {
    data: { email, password },
  });
  const cookies = res.headers()['set-cookie'];
  return cookies;
}

module.exports = { registerBusiness, apiLogin };
