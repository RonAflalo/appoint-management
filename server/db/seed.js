require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const { initializeDatabase, getDb } = require('./database');

async function seed() {
  initializeDatabase();
  const db = getDb();

  // Check if already seeded
  const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@demo.com');
  if (existingAdmin) {
    console.log('Database already seeded. Skipping.');
    process.exit(0);
  }

  console.log('Seeding database...');

  // Create business
  const businessResult = db.prepare(`
    INSERT INTO businesses (name, address, working_hours_json)
    VALUES (?, ?, ?)
  `).run(
    'סלון הספר של דוד',
    'רחוב הרצל 5, תל אביב',
    JSON.stringify({
      "0": null,
      "1": { "start": "09:00", "end": "18:00" },
      "2": { "start": "09:00", "end": "18:00" },
      "3": { "start": "09:00", "end": "18:00" },
      "4": { "start": "09:00", "end": "18:00" },
      "5": { "start": "09:00", "end": "14:00" },
      "6": null
    })
  );
  const businessId = businessResult.lastInsertRowid;
  console.log(`Created business with ID: ${businessId}`);

  // Create admin user
  const adminHash = bcrypt.hashSync('admin123', 10);
  const adminResult = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, business_id)
    VALUES (?, ?, ?, 'admin', ?)
  `).run('דוד לוי', 'admin@demo.com', adminHash, businessId);
  console.log(`Created admin user with ID: ${adminResult.lastInsertRowid}`);

  // Create worker user
  const workerHash = bcrypt.hashSync('worker123', 10);
  const workerResult = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, business_id)
    VALUES (?, ?, ?, 'worker', ?)
  `).run('יוסי כהן', 'worker@demo.com', workerHash, businessId);
  console.log(`Created worker user with ID: ${workerResult.lastInsertRowid}`);

  // Create services
  const services = [
    { name: 'תספורת', duration_minutes: 30, price: 50 },
    { name: 'גילוח', duration_minutes: 20, price: 30 },
    { name: 'עיצוב זקן', duration_minutes: 25, price: 40 },
  ];

  for (const service of services) {
    const result = db.prepare(`
      INSERT INTO services (business_id, name, duration_minutes, price)
      VALUES (?, ?, ?, ?)
    `).run(businessId, service.name, service.duration_minutes, service.price);
    console.log(`Created service "${service.name}" with ID: ${result.lastInsertRowid}`);
  }

  console.log('\nSeed complete!');
  console.log('---');
  console.log('Admin login: admin@demo.com / admin123');
  console.log('Worker login: worker@demo.com / worker123');
  console.log('Register as a customer via the app');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
