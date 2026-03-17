const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db/database');

const JWT_SECRET = 'test-secret-key';

function createToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role, business_id: user.business_id },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function seedTestData() {
  const db = getDb();

  const bizResult = db.prepare(
    `INSERT INTO businesses (name, slug, address) VALUES ('Test Business', 'test-biz', '1 Test St')`
  ).run();
  const businessId = bizResult.lastInsertRowid;

  const adminResult = db.prepare(
    `INSERT INTO users (name, email, password_hash, role, business_id, is_worker)
     VALUES ('Admin User', 'admin@test.com', ?, 'admin', ?, 1)`
  ).run(bcrypt.hashSync('password123', 10), businessId);
  const admin = db.prepare('SELECT * FROM users WHERE id = ?').get(adminResult.lastInsertRowid);

  const workerResult = db.prepare(
    `INSERT INTO users (name, email, password_hash, role, business_id)
     VALUES ('Worker User', 'worker@test.com', ?, 'worker', ?)`
  ).run(bcrypt.hashSync('password123', 10), businessId);
  const worker = db.prepare('SELECT * FROM users WHERE id = ?').get(workerResult.lastInsertRowid);

  const customerResult = db.prepare(
    `INSERT INTO users (name, email, password_hash, role, business_id)
     VALUES ('Customer User', 'customer@test.com', ?, 'user', ?)`
  ).run(bcrypt.hashSync('password123', 10), businessId);
  const customer = db.prepare('SELECT * FROM users WHERE id = ?').get(customerResult.lastInsertRowid);

  const serviceResult = db.prepare(
    `INSERT INTO services (business_id, name, duration_minutes, price) VALUES (?, 'Haircut', 30, 50)`
  ).run(businessId);
  const service = db.prepare('SELECT * FROM services WHERE id = ?').get(serviceResult.lastInsertRowid);

  return {
    businessId,
    admin,
    worker,
    customer,
    service,
    adminToken: createToken(admin),
    workerToken: createToken(worker),
    customerToken: createToken(customer),
  };
}

module.exports = { seedTestData, createToken };
