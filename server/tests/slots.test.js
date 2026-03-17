process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret-key';
process.env.NODE_ENV = 'test';


const { initializeDatabase, closeDatabase, getDb } = require('../db/database');
const { getAvailableSlots } = require('../utils/slots');

let businessId, workerId, serviceId;

beforeAll(() => {
  initializeDatabase(':memory:');
  const db = getDb();

  const biz = db.prepare(
    `INSERT INTO businesses (name, slug, working_hours_json) VALUES (?, ?, ?)`
  ).run('Slot Biz', 'slot-biz', JSON.stringify({
    '0': null, // Sunday closed
    '1': { start: '09:00', end: '17:00' }, // Monday
    '2': { start: '09:00', end: '17:00' }, // Tuesday
    '3': { start: '09:00', end: '17:00' },
    '4': { start: '09:00', end: '17:00' },
    '5': { start: '09:00', end: '14:00' }, // Friday short
    '6': null, // Saturday closed
  }));
  businessId = biz.lastInsertRowid;

  const worker = db.prepare(
    `INSERT INTO users (name, email, password_hash, role, business_id) VALUES ('Worker', 'w@slot.com', 'x', 'worker', ?)`
  ).run(businessId);
  workerId = worker.lastInsertRowid;

  const service = db.prepare(
    `INSERT INTO services (business_id, name, duration_minutes, price) VALUES (?, 'Service', 30, 0)`
  ).run(businessId);
  serviceId = service.lastInsertRowid;
});

afterAll(() => {
  closeDatabase();
});

describe('getAvailableSlots', () => {
  it('returns slots on a working day (Monday)', () => {
    // 2030-06-10 is a Monday
    const slots = getAvailableSlots({ workerId, serviceId, date: '2030-06-10', businessId });
    expect(slots.length).toBeGreaterThan(0);
    // 09:00 to 17:00 in 30-min increments = 16 slots
    expect(slots.length).toBe(16);
    expect(slots[0]).toBe('2030-06-10T09:00:00');
    expect(slots[slots.length - 1]).toBe('2030-06-10T16:30:00');
  });

  it('returns no slots on a closed day (Sunday)', () => {
    // 2030-06-09 is a Sunday
    const slots = getAvailableSlots({ workerId, serviceId, date: '2030-06-09', businessId });
    expect(slots.length).toBe(0);
  });

  it('returns fewer slots on a short day (Friday)', () => {
    // 2030-06-14 is a Friday (09:00-14:00 = 10 slots)
    const slots = getAvailableSlots({ workerId, serviceId, date: '2030-06-14', businessId });
    expect(slots.length).toBe(10);
    expect(slots[slots.length - 1]).toBe('2030-06-14T13:30:00');
  });

  it('excludes slots that overlap with an existing appointment', () => {
    const db = getDb();
    // Book 09:00-09:30 slot
    db.prepare(
      `INSERT INTO appointments (business_id, customer_id, worker_id, service_id, start_time, end_time, status)
       VALUES (?, 1, ?, ?, '2030-06-10 09:00:00', '2030-06-10 09:30:00', 'confirmed')`
    ).run(businessId, workerId, serviceId);

    const slots = getAvailableSlots({ workerId, serviceId, date: '2030-06-10', businessId });
    expect(slots).not.toContain('2030-06-10T09:00:00');
    // 09:30 should still be available
    expect(slots).toContain('2030-06-10T09:30:00');
    expect(slots.length).toBe(15); // 16 - 1
  });

  it('excludes slots fully covered by a longer appointment', () => {
    const db = getDb();
    // Insert a 60-min appointment covering 10:00-11:00 on a different date
    db.prepare(
      `INSERT INTO appointments (business_id, customer_id, worker_id, service_id, start_time, end_time, status)
       VALUES (?, 1, ?, ?, '2030-06-11 10:00:00', '2030-06-11 11:00:00', 'confirmed')`
    ).run(businessId, workerId, serviceId);

    const slots = getAvailableSlots({ workerId, serviceId, date: '2030-06-11', businessId });
    // 10:00 and 10:30 should be blocked by the 60-min appointment
    expect(slots).not.toContain('2030-06-11T10:00:00');
    expect(slots).not.toContain('2030-06-11T10:30:00');
    // 09:00 and 11:00 should be available
    expect(slots).toContain('2030-06-11T09:00:00');
    expect(slots).toContain('2030-06-11T11:00:00');
  });

  it('returns no slots when worker is blocked via availability override', () => {
    const db = getDb();
    db.prepare(
      `INSERT INTO availability_overrides (worker_id, date, is_blocked) VALUES (?, '2030-06-12', 1)`
    ).run(workerId);

    const slots = getAvailableSlots({ workerId, serviceId, date: '2030-06-12', businessId });
    expect(slots.length).toBe(0);
  });

  it('uses custom hours from availability override', () => {
    const db = getDb();
    db.prepare(
      `INSERT INTO availability_overrides (worker_id, date, is_blocked, custom_start, custom_end)
       VALUES (?, '2030-06-16', 0, '10:00', '12:00')`
    ).run(workerId);

    const slots = getAvailableSlots({ workerId, serviceId, date: '2030-06-16', businessId });
    // 10:00 to 12:00 in 30-min = 4 slots
    expect(slots.length).toBe(4);
    expect(slots[0]).toBe('2030-06-16T10:00:00');
    expect(slots[3]).toBe('2030-06-16T11:30:00');
  });

  it('ignores cancelled appointments when calculating slots', () => {
    const db = getDb();
    // Insert a cancelled appointment
    db.prepare(
      `INSERT INTO appointments (business_id, customer_id, worker_id, service_id, start_time, end_time, status)
       VALUES (?, 1, ?, ?, '2030-06-17 09:00:00', '2030-06-17 09:30:00', 'cancelled')`
    ).run(businessId, workerId, serviceId);

    const slots = getAvailableSlots({ workerId, serviceId, date: '2030-06-17', businessId });
    // Cancelled appointment should not block the slot
    expect(slots).toContain('2030-06-17T09:00:00');
  });

  it('returns empty array for invalid businessId', () => {
    const slots = getAvailableSlots({ workerId, serviceId, date: '2030-06-10', businessId: 99999 });
    expect(slots.length).toBe(0);
  });
});
