process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret-key';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const { initializeDatabase, closeDatabase } = require('../db/database');
const app = require('../app');

// Helper: register a business with correct API field names
function registerBiz(slug, email, password = 'password123') {
  return request(app).post('/api/register-business').send({
    businessName: `Biz ${slug}`,
    businessType: 'default',
    ownerName: 'Owner',
    email,
    password,
    slug,
  });
}

beforeAll(() => {
  initializeDatabase(':memory:');
});

afterAll(() => {
  closeDatabase();
});

describe('POST /api/auth/register', () => {
  it('creates a new user and returns a cookie', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test User',
      email: 'newuser@test.com',
      password: 'password123',
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.user.email).toBe('newuser@test.com');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('rejects missing fields', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'x@x.com',
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects password shorter than 6 chars', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test',
      email: 'short@test.com',
      password: '12345',
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects duplicate email for admin/worker roles', async () => {
    // Create an admin via register-business
    await registerBiz('dup-test-biz', 'admin-dup@test.com');

    // Attempt to register with the admin's email should fail (role is 'admin', not 'user')
    const res = await request(app).post('/api/auth/register').send({
      name: 'Hacker',
      email: 'admin-dup@test.com',
      password: 'password123',
    });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('allows claiming a guest user account (same email, role=user)', async () => {
    // Register a plain user first
    await request(app).post('/api/auth/register').send({
      name: 'Original',
      email: 'claimable@test.com',
      password: 'oldpassword',
    });

    // Register again with same email — should succeed (account claim)
    const res = await request(app).post('/api/auth/register').send({
      name: 'Claimed',
      email: 'claimable@test.com',
      password: 'newpassword123',
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('POST /api/auth/login', () => {
  beforeAll(async () => {
    await registerBiz('login-biz', 'login@test.com', 'correctpassword');
  });

  it('returns token on valid credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'login@test.com',
      password: 'correctpassword',
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.email).toBe('login@test.com');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('rejects wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'login@test.com',
      password: 'wrongpassword',
    });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('rejects unknown email', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'nobody@test.com',
      password: 'password123',
    });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('rejects missing fields', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'login@test.com' });
    expect(res.status).toBe(400);
  });

  it('rejects inactive account', async () => {
    const { getDb } = require('../db/database');
    const db = getDb();
    db.prepare("UPDATE users SET is_active = 0 WHERE email = 'login@test.com'").run();

    const res = await request(app).post('/api/auth/login').send({
      email: 'login@test.com',
      password: 'correctpassword',
    });
    expect(res.status).toBe(403);

    // Restore
    db.prepare("UPDATE users SET is_active = 1 WHERE email = 'login@test.com'").run();
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the auth cookie', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const cookie = res.headers['set-cookie']?.[0] || '';
    expect(cookie).toMatch(/token=;|token=$/i);
  });
});

describe('GET /api/auth/me', () => {
  let cookie;

  beforeAll(async () => {
    const res = await registerBiz('me-biz', 'me@test.com');
    cookie = res.headers['set-cookie'];
  });

  it('returns the current user when authenticated', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.email).toBe('me@test.com');
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid token', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', 'token=badtoken');
    expect(res.status).toBe(401);
  });
});
