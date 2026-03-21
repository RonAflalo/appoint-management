/**
 * Unit tests for getAvailableSlots / getPossibleSlots.
 *
 * Each describe block sets up its own in-memory DB so state never bleeds between groups.
 */
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret-key';
process.env.NODE_ENV = 'test';

const { initializeDatabase, closeDatabase, getDb } = require('../db/database');
const { getAvailableSlots, getPossibleSlots, formatTimeMinutes } = require('../utils/slots');

// ─── formatTimeMinutes (pure) ─────────────────────────────────────────────────

describe('formatTimeMinutes', () => {
  it('formats 0 → 00:00', () => expect(formatTimeMinutes(0)).toBe('00:00'));
  it('formats 60 → 01:00', () => expect(formatTimeMinutes(60)).toBe('01:00'));
  it('formats 9*60 → 09:00', () => expect(formatTimeMinutes(540)).toBe('09:00'));
  it('formats 9*60+30 → 09:30', () => expect(formatTimeMinutes(570)).toBe('09:30'));
  it('formats 17*60+45 → 17:45', () => expect(formatTimeMinutes(1065)).toBe('17:45'));
});

// ─── Shared fixture setup ─────────────────────────────────────────────────────

function buildFixture({ workingHours, durationMinutes = 30 } = {}) {
  initializeDatabase(':memory:');
  const db = getDb();

  const defaultHours = {
    0: null, // Sunday closed
    1: { start: '09:00', end: '12:00' },
    2: { start: '09:00', end: '12:00' },
    3: { start: '09:00', end: '12:00' },
    4: { start: '09:00', end: '12:00' },
    5: { start: '09:00', end: '12:00' },
    6: null, // Saturday closed
  };

  const hours = workingHours ?? defaultHours;

  const biz = db.prepare(
    `INSERT INTO businesses (name, slug, address, working_hours_json) VALUES ('Test', 'test', '1 St', ?)`
  ).run(JSON.stringify(hours));
  const businessId = biz.lastInsertRowid;

  const svc = db.prepare(
    `INSERT INTO services (business_id, name, duration_minutes, price) VALUES (?, 'Cut', ?, 50)`
  ).run(businessId, durationMinutes);
  const serviceId = svc.lastInsertRowid;

  const worker = db.prepare(
    `INSERT INTO users (name, email, password_hash, role, business_id) VALUES ('W', 'w@t.com', 'x', 'worker', ?)`
  ).run(businessId);
  const workerId = worker.lastInsertRowid;

  return { db, businessId, serviceId, workerId };
}

// ─── Basic slot generation ────────────────────────────────────────────────────

describe('getAvailableSlots — basic generation', () => {
  let ctx;
  beforeAll(() => { ctx = buildFixture({ durationMinutes: 30 }); });
  afterAll(() => closeDatabase());

  // 2030-06-10 is a Monday
  it('generates correct slots for 09:00–12:00 with 30-min service', () => {
    const slots = getAvailableSlots({ ...ctx, date: '2030-06-10' });
    expect(slots).toEqual([
      '2030-06-10T09:00:00',
      '2030-06-10T09:30:00',
      '2030-06-10T10:00:00',
      '2030-06-10T10:30:00',
      '2030-06-10T11:00:00',
      '2030-06-10T11:30:00',
    ]);
  });

  it('last slot starts at 11:30 (30-min service ends at 12:00 exactly)', () => {
    const slots = getAvailableSlots({ ...ctx, date: '2030-06-10' });
    expect(slots[slots.length - 1]).toBe('2030-06-10T11:30:00');
  });

  it('returns empty array for a closed day (Sunday)', () => {
    // 2030-06-09 is a Sunday
    const slots = getAvailableSlots({ ...ctx, date: '2030-06-09' });
    expect(slots).toEqual([]);
  });
});

// ─── Service duration affects slot count ──────────────────────────────────────

describe('getAvailableSlots — service duration', () => {
  afterAll(() => closeDatabase());

  it('60-min service in 3-hour window → 3 slots', () => {
    const ctx = buildFixture({ durationMinutes: 60 });
    const slots = getAvailableSlots({ ...ctx, date: '2030-06-10' });
    expect(slots.length).toBe(3);
    expect(slots).toEqual([
      '2030-06-10T09:00:00',
      '2030-06-10T10:00:00',
      '2030-06-10T11:00:00',
    ]);
  });

  it('90-min service in 3-hour window → 2 slots', () => {
    const ctx = buildFixture({ durationMinutes: 90 });
    const slots = getAvailableSlots({ ...ctx, date: '2030-06-10' });
    expect(slots.length).toBe(2);
    expect(slots).toEqual([
      '2030-06-10T09:00:00',
      '2030-06-10T10:30:00',
    ]);
  });

  it('service longer than the working window → no slots', () => {
    const ctx = buildFixture({ durationMinutes: 181 }); // 181 min > 180 min window
    const slots = getAvailableSlots({ ...ctx, date: '2030-06-10' });
    expect(slots).toEqual([]);
  });

  it('service exactly equal to window → 1 slot', () => {
    const ctx = buildFixture({ durationMinutes: 180 }); // exactly 3 hours
    const slots = getAvailableSlots({ ...ctx, date: '2030-06-10' });
    expect(slots.length).toBe(1);
    expect(slots[0]).toBe('2030-06-10T09:00:00');
  });
});

// ─── Existing appointment overlap ─────────────────────────────────────────────

describe('getAvailableSlots — booked slot exclusion', () => {
  let ctx;
  beforeAll(() => { ctx = buildFixture({ durationMinutes: 30 }); });
  afterAll(() => closeDatabase());

  // 2030-07-08 Mon, 2030-07-09 Tue, 2030-07-10 Wed, 2030-07-11 Thu, 2030-07-15 Mon
  it('slot occupied by confirmed appointment is excluded', () => {
    ctx.db.prepare(`
      INSERT INTO appointments (business_id, customer_id, worker_id, service_id, start_time, end_time, status)
      VALUES (?, 1, ?, ?, '2030-07-08 09:00:00', '2030-07-08 09:30:00', 'confirmed')
    `).run(ctx.businessId, ctx.workerId, ctx.serviceId);

    const slots = getAvailableSlots({ ...ctx, date: '2030-07-08' });
    expect(slots).not.toContain('2030-07-08T09:00:00');
    expect(slots).toContain('2030-07-08T09:30:00');
  });

  it('slot occupied by pending appointment is excluded', () => {
    ctx.db.prepare(`
      INSERT INTO appointments (business_id, customer_id, worker_id, service_id, start_time, end_time, status)
      VALUES (?, 1, ?, ?, '2030-07-09 10:00:00', '2030-07-09 10:30:00', 'pending')
    `).run(ctx.businessId, ctx.workerId, ctx.serviceId);

    const slots = getAvailableSlots({ ...ctx, date: '2030-07-09' });
    expect(slots).not.toContain('2030-07-09T10:00:00');
    expect(slots).toContain('2030-07-09T09:00:00');
  });

  it('cancelled appointment does NOT block the slot', () => {
    ctx.db.prepare(`
      INSERT INTO appointments (business_id, customer_id, worker_id, service_id, start_time, end_time, status)
      VALUES (?, 1, ?, ?, '2030-07-10 11:00:00', '2030-07-10 11:30:00', 'cancelled')
    `).run(ctx.businessId, ctx.workerId, ctx.serviceId);

    const slots = getAvailableSlots({ ...ctx, date: '2030-07-10' });
    expect(slots).toContain('2030-07-10T11:00:00');
  });

  it('appointment fully books the day → no slots remain', () => {
    ctx.db.prepare(`
      INSERT INTO appointments (business_id, customer_id, worker_id, service_id, start_time, end_time, status)
      VALUES (?, 1, ?, ?, '2030-07-11 09:00:00', '2030-07-11 12:00:00', 'confirmed')
    `).run(ctx.businessId, ctx.workerId, ctx.serviceId);

    const slots = getAvailableSlots({ ...ctx, date: '2030-07-11' });
    expect(slots).toEqual([]);
  });

  it('partial overlap blocks affected slots only', () => {
    // Appointment at 09:15–09:45 overlaps both 09:00–09:30 and 09:30–10:00
    ctx.db.prepare(`
      INSERT INTO appointments (business_id, customer_id, worker_id, service_id, start_time, end_time, status)
      VALUES (?, 1, ?, ?, '2030-07-15 09:15:00', '2030-07-15 09:45:00', 'confirmed')
    `).run(ctx.businessId, ctx.workerId, ctx.serviceId);

    const slots = getAvailableSlots({ ...ctx, date: '2030-07-15' });
    expect(slots).not.toContain('2030-07-15T09:00:00');
    expect(slots).not.toContain('2030-07-15T09:30:00');
    expect(slots).toContain('2030-07-15T10:00:00');
  });
});

// ─── Availability overrides ───────────────────────────────────────────────────

describe('getAvailableSlots — availability overrides', () => {
  let ctx;
  beforeAll(() => { ctx = buildFixture({ durationMinutes: 30 }); });
  afterAll(() => closeDatabase());

  it('is_blocked override returns no slots', () => {
    ctx.db.prepare(
      `INSERT INTO availability_overrides (worker_id, date, is_blocked) VALUES (?, '2030-08-04', 1)`
    ).run(ctx.workerId);

    const slots = getAvailableSlots({ ...ctx, date: '2030-08-04' });
    expect(slots).toEqual([]);
  });

  it('custom_start/custom_end override replaces default hours', () => {
    // Default is 09:00–12:00, override to 14:00–15:00
    ctx.db.prepare(
      `INSERT INTO availability_overrides (worker_id, date, is_blocked, custom_start, custom_end) VALUES (?, '2030-08-05', 0, '14:00', '15:00')`
    ).run(ctx.workerId);

    const slots = getAvailableSlots({ ...ctx, date: '2030-08-05' });
    expect(slots).not.toContain('2030-08-05T09:00:00');
    expect(slots).toContain('2030-08-05T14:00:00');
    expect(slots).toContain('2030-08-05T14:30:00');
    expect(slots.length).toBe(2);
  });

  it('override on a normally-closed day opens slots', () => {
    // 2030-08-11 is a Sunday (closed by default) — override opens it
    ctx.db.prepare(
      `INSERT INTO availability_overrides (worker_id, date, is_blocked, custom_start, custom_end) VALUES (?, '2030-08-11', 0, '10:00', '11:00')`
    ).run(ctx.workerId);

    const slots = getAvailableSlots({ ...ctx, date: '2030-08-11' });
    expect(slots).toContain('2030-08-11T10:00:00');
    expect(slots).toContain('2030-08-11T10:30:00');
    expect(slots.length).toBe(2);
  });
});

// ─── getPossibleSlots ─────────────────────────────────────────────────────────

describe('getPossibleSlots', () => {
  let ctx;
  beforeAll(() => { ctx = buildFixture({ durationMinutes: 30 }); });
  afterAll(() => closeDatabase());

  it('returns all theoretical slots regardless of bookings', () => {
    ctx.db.prepare(`
      INSERT INTO appointments (business_id, customer_id, worker_id, service_id, start_time, end_time, status)
      VALUES (?, 1, ?, ?, '2030-09-02 09:00:00', '2030-09-02 09:30:00', 'confirmed')
    `).run(ctx.businessId, ctx.workerId, ctx.serviceId);

    const possible = getPossibleSlots({ ...ctx, date: '2030-09-02' });
    const available = getAvailableSlots({ ...ctx, date: '2030-09-02' });

    expect(possible).toContain('2030-09-02T09:00:00');
    expect(available).not.toContain('2030-09-02T09:00:00');
  });

  it('booked slots = possible minus available', () => {
    const possible = getPossibleSlots({ ...ctx, date: '2030-09-02' });
    const available = getAvailableSlots({ ...ctx, date: '2030-09-02' });
    const booked = possible.filter(s => !available.includes(s));

    expect(booked).toContain('2030-09-02T09:00:00');
    expect(booked.length).toBe(1);
  });

  it('returns empty for closed day', () => {
    // 2030-09-07 is a Sunday
    const possible = getPossibleSlots({ ...ctx, date: '2030-09-07' });
    expect(possible).toEqual([]);
  });
});

// ─── Non-existent business / service ──────────────────────────────────────────

describe('getAvailableSlots — invalid IDs', () => {
  let ctx;
  beforeAll(() => { ctx = buildFixture(); });
  afterAll(() => closeDatabase());

  it('returns [] for unknown businessId', () => {
    const slots = getAvailableSlots({ workerId: ctx.workerId, serviceId: ctx.serviceId, date: '2030-06-10', businessId: 99999 });
    expect(slots).toEqual([]);
  });

  it('returns [] for unknown serviceId', () => {
    const slots = getAvailableSlots({ workerId: ctx.workerId, serviceId: 99999, date: '2030-06-10', businessId: ctx.businessId });
    expect(slots).toEqual([]);
  });
});

// ─── Working hours boundary edge cases ───────────────────────────────────────

describe('getAvailableSlots — boundary edge cases', () => {
  afterAll(() => closeDatabase());

  it('single slot fits exactly at the boundary', () => {
    // Window: 09:00–09:30, service 30 min → exactly 1 slot
    const ctx = buildFixture({
      workingHours: { 1: { start: '09:00', end: '09:30' } },
      durationMinutes: 30,
    });
    const slots = getAvailableSlots({ ...ctx, date: '2030-06-10' });
    expect(slots).toEqual(['2030-06-10T09:00:00']);
  });

  it('slot does not fit when window is 1 minute short', () => {
    const ctx = buildFixture({
      workingHours: { 1: { start: '09:00', end: '09:29' } },
      durationMinutes: 30,
    });
    const slots = getAvailableSlots({ ...ctx, date: '2030-06-10' });
    expect(slots).toEqual([]);
  });
});
