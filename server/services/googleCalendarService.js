const { getDb } = require('../db/database');

function isConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

async function getValidAccessToken(userId) {
  if (!isConfigured()) return null;
  const db = getDb();
  const user = db.prepare('SELECT google_calendar_refresh_token, google_calendar_access_token, google_calendar_token_expires FROM users WHERE id = ?').get(userId);
  if (!user || !user.google_calendar_refresh_token) return null;

  const now = Date.now();
  const expires = user.google_calendar_token_expires ? new Date(user.google_calendar_token_expires).getTime() : 0;
  if (user.google_calendar_access_token && expires > now + 60000) {
    return user.google_calendar_access_token;
  }

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: user.google_calendar_refresh_token,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
      }).toString(),
    });
    const data = await res.json();
    if (!data.access_token) { console.error('[GCal] Token refresh failed:', data); return null; }
    const newExpires = new Date(now + (data.expires_in || 3600) * 1000).toISOString();
    db.prepare('UPDATE users SET google_calendar_access_token = ?, google_calendar_token_expires = ? WHERE id = ?')
      .run(data.access_token, newExpires, userId);
    return data.access_token;
  } catch (err) {
    console.error('[GCal] Token refresh error:', err.message);
    return null;
  }
}

async function createCalendarEvent(workerId, appointment) {
  const accessToken = await getValidAccessToken(workerId);
  if (!accessToken) return null;
  try {
    const start = appointment.start_time.replace(' ', 'T');
    const end = appointment.end_time.replace(' ', 'T');
    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: `${appointment.service_name} — ${appointment.customer_name}`,
        description: `לקוח: ${appointment.customer_name}\nשירות: ${appointment.service_name}`,
        start: { dateTime: start, timeZone: 'Asia/Jerusalem' },
        end: { dateTime: end, timeZone: 'Asia/Jerusalem' },
      }),
    });
    const data = await res.json();
    if (data.id) { console.log(`[GCal] Event created: ${data.id}`); return data.id; }
    return null;
  } catch (err) {
    console.error('[GCal] createCalendarEvent error:', err.message);
    return null;
  }
}

async function deleteCalendarEvent(workerId, eventId) {
  if (!eventId) return;
  const accessToken = await getValidAccessToken(workerId);
  if (!accessToken) return;
  try {
    await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    console.log(`[GCal] Event deleted: ${eventId}`);
  } catch (err) {
    console.error('[GCal] deleteCalendarEvent error:', err.message);
  }
}

module.exports = { isConfigured, createCalendarEvent, deleteCalendarEvent };
