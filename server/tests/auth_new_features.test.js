/**
 * Tests for new auth features: forgot-password, reset-password,
 * email verification, resend verification, getMe enhancements.
 */
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret-key';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const { initializeDatabase, closeDatabase, getDb } = require('../db/database');
const app = require('../app');

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

// ─── Forgot password ──────────────────────────────────────────────────────────

describe('POST /api/auth/forgot-password', () => {
  let userEmail = 'forgot@test.com';

  beforeAll(async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Forgot User',
      email: userEmail,
      password: 'password123',
    });
  });

  it('returns 200 for a known email', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: userEmail });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('stores a reset token and expiry in the DB', async () => {
    await request(app).post('/api/auth/forgot-password').send({ email: userEmail });
    const db = getDb();
    const user = db.prepare('SELECT reset_token, reset_token_expires FROM users WHERE email = ?').get(userEmail);
    expect(user.reset_token).toBeTruthy();
    expect(user.reset_token_expires).toBeTruthy();
    // Expiry should be in the future
    expect(new Date(user.reset_token_expires) > new Date()).toBe(true);
  });

  it('returns 200 even for an unknown email (no enumeration)', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@test.com' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 400 when email field is missing', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({});
    expect(res.status).toBe(400);
  });
});

// ─── Reset password ───────────────────────────────────────────────────────────

describe('POST /api/auth/reset-password/:token', () => {
  let resetToken;
  const resetEmail = 'reset@test.com';

  beforeAll(async () => {
    // Register user and request password reset
    await request(app).post('/api/auth/register').send({
      name: 'Reset User',
      email: resetEmail,
      password: 'oldpassword',
    });
    await request(app).post('/api/auth/forgot-password').send({ email: resetEmail });
    const db = getDb();
    const user = db.prepare('SELECT reset_token FROM users WHERE email = ?').get(resetEmail);
    resetToken = user.reset_token;
  });

  it('resets password with a valid token', async () => {
    const res = await request(app)
      .post(`/api/auth/reset-password/${resetToken}`)
      .send({ password: 'newpassword123' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('can login with the new password after reset', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: resetEmail,
      password: 'newpassword123',
    });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(resetEmail);
  });

  it('clears reset_token after successful use (prevents replay)', async () => {
    const db = getDb();
    const user = db.prepare('SELECT reset_token, reset_token_expires FROM users WHERE email = ?').get(resetEmail);
    expect(user.reset_token).toBeNull();
    expect(user.reset_token_expires).toBeNull();
  });

  it('rejects an already-used token', async () => {
    const res = await request(app)
      .post(`/api/auth/reset-password/${resetToken}`)
      .send({ password: 'anotherpassword' });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid/unknown token', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password/totallyfaketoken')
      .send({ password: 'newpassword123' });
    expect(res.status).toBe(400);
  });

  it('rejects a password shorter than 6 chars', async () => {
    const db = getDb();
    // Set a fresh token for this test
    const token = 'shorttesttoken123';
    db.prepare("UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE email = ?")
      .run(token, new Date(Date.now() + 3600_000).toISOString(), resetEmail);

    const res = await request(app)
      .post(`/api/auth/reset-password/${token}`)
      .send({ password: '12345' });
    expect(res.status).toBe(400);
  });

  it('rejects an expired token', async () => {
    const db = getDb();
    const expiredToken = 'expiredtoken456';
    // Set expiry in the past
    db.prepare("UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE email = ?")
      .run(expiredToken, new Date(Date.now() - 1000).toISOString(), resetEmail);

    const res = await request(app)
      .post(`/api/auth/reset-password/${expiredToken}`)
      .send({ password: 'validpassword' });
    expect(res.status).toBe(400);
  });
});

// ─── Email verification ───────────────────────────────────────────────────────

describe('GET /api/auth/verify-email/:token', () => {
  let verifyToken;
  const verifyEmail = 'verify@test.com';

  beforeAll(async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Verify User',
      email: verifyEmail,
      password: 'password123',
    });
    const db = getDb();
    const user = db.prepare('SELECT verification_token, email_verified FROM users WHERE email = ?').get(verifyEmail);
    verifyToken = user.verification_token;
    // Confirm user starts unverified
    expect(user.email_verified).toBe(0);
  });

  it('marks user as email_verified = 1 with a valid token', async () => {
    const res = await request(app).get(`/api/auth/verify-email/${verifyToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const db = getDb();
    const user = db.prepare('SELECT email_verified, verification_token FROM users WHERE email = ?').get(verifyEmail);
    expect(user.email_verified).toBe(1);
    expect(user.verification_token).toBeNull();
  });

  it('returns 400 for an invalid/unknown token', async () => {
    const res = await request(app).get('/api/auth/verify-email/completelyfaketoken');
    expect(res.status).toBe(400);
  });

  it('returns 400 for an already-used token (token cleared after verification)', async () => {
    // Token was cleared above, so using it again should fail
    const res = await request(app).get(`/api/auth/verify-email/${verifyToken}`);
    expect(res.status).toBe(400);
  });
});

// ─── Resend verification ──────────────────────────────────────────────────────

describe('POST /api/auth/resend-verification', () => {
  let userCookie;
  const resendEmail = 'resend@test.com';

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Resend User',
      email: resendEmail,
      password: 'password123',
    });
    userCookie = res.headers['set-cookie'];
  });

  it('sends a new verification token to an unverified user', async () => {
    const db = getDb();
    const before = db.prepare('SELECT verification_token FROM users WHERE email = ?').get(resendEmail);

    const res = await request(app)
      .post('/api/auth/resend-verification')
      .set('Cookie', userCookie);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const after = db.prepare('SELECT verification_token FROM users WHERE email = ?').get(resendEmail);
    // Token should be a new value
    expect(after.verification_token).toBeTruthy();
    expect(after.verification_token).not.toBe(before.verification_token);
  });

  it('returns 400 if user is already verified', async () => {
    const db = getDb();
    db.prepare("UPDATE users SET email_verified = 1 WHERE email = ?").run(resendEmail);

    const res = await request(app)
      .post('/api/auth/resend-verification')
      .set('Cookie', userCookie);
    expect(res.status).toBe(400);
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/auth/resend-verification');
    expect(res.status).toBe(401);
  });
});

// ─── getMe enhancements ───────────────────────────────────────────────────────

describe('GET /api/auth/me — new fields', () => {
  let adminCookie;
  let userCookie;

  beforeAll(async () => {
    const adminRes = await registerBiz('me-features-biz', 'me-features@test.com');
    adminCookie = adminRes.headers['set-cookie'];

    const userRes = await request(app).post('/api/auth/register').send({
      name: 'Me User',
      email: 'me-user@test.com',
      password: 'password123',
    });
    userCookie = userRes.headers['set-cookie'];
  });

  it('includes email_verified field', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(typeof res.body.user.email_verified).toBe('number');
  });

  it('includes business object for users with a business_id', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.user.business).toBeDefined();
    expect(res.body.user.business.slug).toBe('me-features-biz');
    // Sensitive fields should not be exposed via business
    expect(res.body.user.business.working_hours_json).toBeUndefined();
  });

  it('business is null for users without a business_id', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', userCookie);
    expect(res.status).toBe(200);
    expect(res.body.user.business).toBeNull();
  });

  it('registration sets email_verified to 0', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Unverified',
      email: 'unverified@test.com',
      password: 'password123',
    });
    expect(res.body.user.email_verified).toBe(0);
  });

  it('login response includes email_verified', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'me-features@test.com',
      password: 'password123',
    });
    expect(res.status).toBe(200);
    expect(typeof res.body.user.email_verified).toBe('number');
  });
});
