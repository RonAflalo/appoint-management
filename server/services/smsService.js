/**
 * SMS / WhatsApp notification service via Twilio.
 *
 * Configure with environment variables:
 *   TWILIO_ACCOUNT_SID  - your Twilio account SID
 *   TWILIO_AUTH_TOKEN   - your Twilio auth token
 *   TWILIO_FROM_NUMBER  - sender number:
 *       SMS mode:      +972XXXXXXXXX
 *       WhatsApp mode: whatsapp:+14155238886  (Twilio sandbox or approved number)
 *   TWILIO_WHATSAPP_MODE - set to "true" to send via WhatsApp instead of SMS
 *
 * If TWILIO_ACCOUNT_SID is not set, all sends are silently skipped.
 */

const isConfigured = () =>
  !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);

function getClient() {
  const twilio = require('twilio');
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

function formatPhone(phone) {
  if (!phone) return null;
  // Normalize Israeli numbers: 05X -> +9725X
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('972')) return `+${digits}`;
  if (digits.startsWith('0')) return `+972${digits.slice(1)}`;
  return `+${digits}`;
}

function buildTo(phone) {
  const formatted = formatPhone(phone);
  if (!formatted) return null;
  return process.env.TWILIO_WHATSAPP_MODE === 'true'
    ? `whatsapp:${formatted}`
    : formatted;
}

async function sendSms({ to, body }) {
  if (!isConfigured()) {
    console.log(`[SMS] ⚠️  Skipped (not configured) | To: ${to} | ${body.slice(0, 60)}...`);
    return;
  }
  const toFormatted = buildTo(to);
  if (!toFormatted) {
    console.warn(`[SMS] Invalid phone number: ${to}`);
    return;
  }
  try {
    const client = getClient();
    const from = process.env.TWILIO_FROM_NUMBER;
    await client.messages.create({ from, to: toFormatted, body });
    console.log(`[SMS] ✓ Sent to ${to}`);
  } catch (err) {
    console.error(`[SMS] ✗ Failed to send to ${to}:`, err.message);
  }
}

async function sendAppointmentReminderSms({ customerPhone, customerName, workerName, serviceName, dateTime }) {
  const mode = process.env.TWILIO_WHATSAPP_MODE === 'true' ? 'WhatsApp' : 'SMS';
  console.log(`[SMS] Sending ${mode} reminder to ${customerPhone}`);
  await sendSms({
    to: customerPhone,
    body: `שלום ${customerName} 👋\nתזכורת: יש לך תור מחר ל${serviceName} עם ${workerName} בתאריך ${dateTime}.\nלביטול או שינוי פנה/י לעסק.`,
  });
}

module.exports = { sendSms, sendAppointmentReminderSms, isConfigured };
