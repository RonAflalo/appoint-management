const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

function isConfigured() {
  return !!process.env.BREVO_API_KEY;
}

function parsFrom() {
  const raw = (process.env.EMAIL_FROM || '').trim();
  const match = raw.match(/^(.*?)\s*<(.+)>\s*$/);
  if (match) return { name: match[1].trim() || 'Torii', email: match[2].trim() };
  return { name: 'Torii', email: raw || 'noreply@example.com' };
}

async function verifyEmailConnection() {
  if (!isConfigured()) {
    console.log('[Email] ⚠️  BREVO_API_KEY not set — emails disabled.');
    return;
  }
  console.log('[Email] ✅ Brevo API configured — emails enabled.');
}

async function sendEmail(to, subject, html) {
  if (!isConfigured()) {
    console.log(`[Email] ⚠️  Skipped (not configured) | To: ${to} | Subject: ${subject}`);
    return;
  }
  const sender = parsFrom();
  console.log(`[Email] Sender resolved:`, JSON.stringify(sender));
  try {
    const res = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender,
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[Email] ❌ Failed | To: ${to} | Subject: ${subject} | ${res.status}: ${err}`);
    } else {
      const data = await res.json();
      console.log(`[Email] ✅ Sent | To: ${to} | Subject: ${subject} | Id: ${data.messageId}`);
    }
  } catch (err) {
    console.error(`[Email] ❌ Failed | To: ${to} | Subject: ${subject} |`, err.message);
  }
}

// ─── Shared layout ────────────────────────────────────────────────────────────

function wrap(title, body) {
  return `
  <div style="direction:rtl;font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;background:#f9fafb;padding:24px;border-radius:12px">
    <div style="background:#6366f1;border-radius:10px;padding:20px 24px;margin-bottom:24px">
      <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700">📅 תוריי</h1>
    </div>
    <div style="background:#fff;border-radius:10px;padding:24px;border:1px solid #e5e7eb">
      <h2 style="color:#111827;margin-top:0;font-size:18px">${title}</h2>
      ${body}
    </div>
    <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:16px">נשלח אוטומטית ממערכת תוריי</p>
  </div>`;
}

function detailsTable({ customerName, workerName, serviceName, dateTime, suggestedTime, rescheduleNote }) {
  const rows = [
    ['לקוח', customerName],
    ['עובד', workerName],
    ['שירות', serviceName],
    ['תאריך ושעה', dateTime],
    suggestedTime ? ['זמן מוצע', `<strong style="color:#6366f1">${suggestedTime}</strong>`] : null,
    rescheduleNote ? ['הערת עובד', `<em>${rescheduleNote}</em>`] : null,
  ].filter(Boolean);

  const html = rows.map(([k, v]) => `
    <tr>
      <td style="padding:8px 12px;background:#f3f4f6;color:#6b7280;font-size:13px;border-radius:4px;white-space:nowrap">${k}</td>
      <td style="padding:8px 12px;color:#111827;font-size:14px;font-weight:500">${v}</td>
    </tr>`).join('');

  return `<table style="width:100%;border-collapse:separate;border-spacing:0 4px">${html}</table>`;
}

// ─── Email types ──────────────────────────────────────────────────────────────

async function sendAppointmentConfirmed({ customerEmail, customerName, workerName, serviceName, dateTime }) {
  await sendEmail(
    customerEmail,
    '✅ התור שלך אושר!',
    wrap('התור שלך אושר', `
      <p style="color:#374151;margin-bottom:16px">שלום ${customerName},<br>התור שלך אושר בהצלחה. נתראה בקרוב!</p>
      ${detailsTable({ customerName, workerName, serviceName, dateTime })}
      <div style="margin-top:20px;padding:12px 16px;background:#ecfdf5;border-radius:8px;color:#065f46;font-size:13px">
        ✅ התור מאושר — אנא הגע בזמן
      </div>
    `)
  );
}

async function sendAppointmentCancelled({ customerEmail, customerName, workerName, serviceName, dateTime, cancelledBy }) {
  const byWhom = cancelledBy === 'admin' ? 'ניהול' : 'העובד';
  await sendEmail(
    customerEmail,
    '❌ התור שלך בוטל',
    wrap('התור שלך בוטל', `
      <p style="color:#374151;margin-bottom:16px">שלום ${customerName},<br>לצערנו התור שלך בוטל על ידי ${byWhom}.</p>
      ${detailsTable({ customerName, workerName, serviceName, dateTime })}
      <div style="margin-top:20px;padding:12px 16px;background:#fef2f2;border-radius:8px;color:#991b1b;font-size:13px">
        ❌ התור בוטל — ניתן לקבוע תור חדש במערכת
      </div>
    `)
  );
}

async function sendRescheduleRequest({ customerEmail, customerName, workerName, serviceName, dateTime, suggestedTime, rescheduleNote }) {
  await sendEmail(
    customerEmail,
    '🔄 בקשת שינוי מועד לתור שלך',
    wrap('בקשת שינוי מועד', `
      <p style="color:#374151;margin-bottom:16px">שלום ${customerName},<br>העובד ${workerName} מבקש לשנות את מועד התור שלך.</p>
      ${detailsTable({ customerName, workerName, serviceName, dateTime, suggestedTime, rescheduleNote })}
      <div style="margin-top:20px;padding:12px 16px;background:#eff6ff;border-radius:8px;color:#1e40af;font-size:13px">
        🔄 כניסה למערכת — ניתן לאשר את הזמן החדש או לבטל את התור
      </div>
    `)
  );
}

async function sendNewBookingToWorker({ workerEmail, workerName, customerName, serviceName, dateTime }) {
  await sendEmail(
    workerEmail,
    '📅 תור חדש נקבע אצלך',
    wrap('תור חדש', `
      <p style="color:#374151;margin-bottom:16px">שלום ${workerName},<br>תור חדש נקבע ביומן שלך.</p>
      ${detailsTable({ customerName, workerName, serviceName, dateTime })}
      <div style="margin-top:20px;padding:12px 16px;background:#faf5ff;border-radius:8px;color:#6b21a8;font-size:13px">
        📅 התחבר למערכת לאשר או לנהל את התור
      </div>
    `)
  );
}

async function sendRescheduleAcceptedToWorker({ workerEmail, workerName, customerName, serviceName, dateTime }) {
  await sendEmail(
    workerEmail,
    '✅ הלקוח אישר את המועד החדש',
    wrap('המועד החדש אושר', `
      <p style="color:#374151;margin-bottom:16px">שלום ${workerName},<br>הלקוח ${customerName} אישר את המועד החדש שהצעת.</p>
      ${detailsTable({ customerName, workerName, serviceName, dateTime })}
      <div style="margin-top:20px;padding:12px 16px;background:#ecfdf5;border-radius:8px;color:#065f46;font-size:13px">
        ✅ התור מאושר במועד החדש — נתראה בקרוב
      </div>
    `)
  );
}

module.exports = {
  verifyEmailConnection,
  sendAppointmentConfirmed,
  sendAppointmentCancelled,
  sendRescheduleRequest,
  sendNewBookingToWorker,
  sendRescheduleAcceptedToWorker,
};
