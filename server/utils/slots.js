const { getDb } = require('../db/database');

function formatTimeMinutes(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function getAvailableSlots({ workerId, serviceId, date, businessId }) {
  const db = getDb();

  // Get business working hours
  const business = db.prepare('SELECT working_hours_json FROM businesses WHERE id = ?').get(businessId);
  if (!business) return [];

  const workingHours = JSON.parse(business.working_hours_json);

  // Get day of week (0=Sunday, 6=Saturday)
  const dateObj = new Date(date + 'T00:00:00');
  const dayOfWeek = dateObj.getDay();
  let dayHours = workingHours[String(dayOfWeek)];

  // Check availability override for this worker on this date
  const override = db.prepare(
    'SELECT * FROM availability_overrides WHERE worker_id = ? AND date = ?'
  ).get(workerId, date);

  if (override) {
    if (override.is_blocked) return [];
    if (override.custom_start && override.custom_end) {
      dayHours = { start: override.custom_start, end: override.custom_end };
    }
  }

  // No working hours for this day
  if (!dayHours) return [];

  // Get service duration
  const service = db.prepare('SELECT duration_minutes FROM services WHERE id = ?').get(serviceId);
  if (!service) return [];
  const duration = service.duration_minutes;

  // Get existing appointments for worker on this date
  const existingAppointments = db.prepare(`
    SELECT start_time, end_time FROM appointments
    WHERE worker_id = ?
      AND date(start_time) = ?
      AND status IN ('pending', 'confirmed')
  `).all(workerId, date);

  // Convert "HH:MM" to minutes from midnight
  function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  const dayStart = timeToMinutes(dayHours.start);
  const dayEnd = timeToMinutes(dayHours.end);

  // Build list of slots
  const slots = [];
  let current = dayStart;

  while (current + duration <= dayEnd) {
    const slotStart = current;
    const slotEnd = current + duration;

    // Check for overlap with existing appointments
    let hasOverlap = false;
    for (const appt of existingAppointments) {
      const apptStart = new Date(appt.start_time);
      const apptEnd = new Date(appt.end_time);
      const apptStartMins = apptStart.getHours() * 60 + apptStart.getMinutes();
      const apptEndMins = apptEnd.getHours() * 60 + apptEnd.getMinutes();

      if (slotStart < apptEndMins && slotEnd > apptStartMins) {
        hasOverlap = true;
        break;
      }
    }

    if (!hasOverlap) {
      // Build ISO datetime string
      const slotTimeStr = formatTimeMinutes(slotStart);
      const isoStr = `${date}T${slotTimeStr}:00`;
      slots.push(isoStr);
    }

    current += duration;
  }

  return slots;
}

module.exports = { getAvailableSlots, formatTimeMinutes };
