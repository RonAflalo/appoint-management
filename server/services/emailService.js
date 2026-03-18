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

async function sendPasswordResetEmail({ email, name, resetUrl }) {
  await sendEmail(
    email,
    '🔑 איפוס סיסמה',
    wrap('איפוס סיסמה', `
      <p style="color:#374151;margin-bottom:16px">שלום ${name},<br>קיבלנו בקשה לאיפוס הסיסמה שלך.</p>
      <a href="${resetUrl}" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin-bottom:16px">
        איפוס סיסמה
      </a>
      <p style="color:#6b7280;font-size:12px;margin-top:16px">הקישור תקף לשעה אחת. אם לא ביקשת איפוס סיסמה, התעלם מהודעה זו.</p>
    `)
  );
}

async function sendVerificationEmail({ email, name, verifyUrl }) {
  await sendEmail(
    email,
    '✉️ אמת את כתובת האימייל שלך',
    wrap('אימות אימייל', `
      <p style="color:#374151;margin-bottom:16px">שלום ${name},<br>תודה שנרשמת! לחץ על הכפתור לאימות האימייל שלך.</p>
      <a href="${verifyUrl}" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin-bottom:16px">
        אמת אימייל
      </a>
      <p style="color:#6b7280;font-size:12px;margin-top:16px">אם לא נרשמת למערכת, התעלם מהודעה זו.</p>
    `)
  );
}

async function sendReminderEmail({ customerEmail, customerName, workerName, serviceName, dateTime }) {
  await sendEmail(
    customerEmail,
    '⏰ תזכורת לתור מחר',
    wrap('תזכורת לתור', `
      <p style="color:#374151;margin-bottom:16px">שלום ${customerName},<br>תזכורת — יש לך תור מחר!</p>
      ${detailsTable({ customerName, workerName, serviceName, dateTime })}
      <div style="margin-top:20px;padding:12px 16px;background:#faf5ff;border-radius:8px;color:#6b21a8;font-size:13px">
        ⏰ אנא הגע בזמן
      </div>
    `)
  );
}

async function sendAppointmentCancelledByCustomer({ workerEmail, workerName, customerName, serviceName, dateTime }) {
  await sendEmail(
    workerEmail,
    '❌ לקוח ביטל את התור',
    wrap('ביטול תור על ידי הלקוח', `
      <p style="color:#374151;margin-bottom:16px">שלום ${workerName},<br>הלקוח ${customerName} ביטל את התור הבא:</p>
      ${detailsTable({ customerName, workerName, serviceName, dateTime })}
      <div style="margin-top:20px;padding:12px 16px;background:#fef2f2;border-radius:8px;color:#991b1b;font-size:13px">
        ❌ התור בוטל על ידי הלקוח
      </div>
    `)
  );
}

async function sendWaitlistAvailable({ customerEmail, customerName, serviceName, slotTime, confirmUrl }) {
  const dt = new Date(slotTime).toLocaleString('he-IL', { dateStyle: 'full', timeStyle: 'short' });
  await sendEmail(
    customerEmail,
    '🔔 השעה שחיכית לה התפנתה!',
    wrap('השעה התפנתה — יש לך 30 דקות לאשר', `
      <p style="color:#374151;margin-bottom:16px">שלום ${customerName},<br>השעה שרשמת לה לרשימת המתנה עבור <strong>${serviceName}</strong> התפנתה!</p>
      <p style="color:#374151;margin-bottom:16px"><strong>מועד:</strong> ${dt}</p>
      <a href="${confirmUrl}" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin-bottom:16px">
        ✅ אשר את התור שלי
      </a>
      <div style="margin-top:16px;padding:12px 16px;background:#fef3c7;border-radius:8px;color:#92400e;font-size:13px">
        ⏰ יש לך 30 דקות לאשר — לאחר מכן ההזדמנות תעבור ללקוח הבא בתור
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
  sendWaitlistAvailable,
  sendAppointmentConfirmed,
  sendAppointmentCancelled,
  sendAppointmentCancelledByCustomer,
  sendRescheduleRequest,
  sendNewBookingToWorker,
  sendRescheduleAcceptedToWorker,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendReminderEmail,
};
