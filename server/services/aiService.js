const Anthropic = require('@anthropic-ai/sdk');
const { getDb } = require('../db/database');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Tool definitions ──────────────────────────────────────────────────────────

const tools = [
  {
    name: 'get_appointments',
    description: 'Get appointments for a specific date or date range. Use this to answer questions about today\'s appointments, this week, or any specific date.',
    input_schema: {
      type: 'object',
      properties: {
        date_from: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
        date_to: { type: 'string', description: 'End date in YYYY-MM-DD format (optional, same as date_from if single day)' },
        status: { type: 'string', description: 'Filter by status: pending, confirmed, completed, cancelled (optional)' },
      },
      required: ['date_from'],
    },
  },
  {
    name: 'search_appointments_by_customer',
    description: 'Search appointments by customer name',
    input_schema: {
      type: 'object',
      properties: {
        customer_name: { type: 'string', description: 'Customer name or partial name to search for' },
        upcoming_only: { type: 'boolean', description: 'If true, only return future appointments' },
      },
      required: ['customer_name'],
    },
  },
  {
    name: 'get_revenue_stats',
    description: 'Get revenue statistics for a period',
    input_schema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['today', 'this_week', 'this_month', 'last_month', 'all_time'], description: 'Time period for revenue stats' },
        service_name: { type: 'string', description: 'Filter by specific service name (optional)' },
      },
      required: ['period'],
    },
  },
  {
    name: 'get_top_customers',
    description: 'Get the most frequent customers by appointment count',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'How many top customers to return (default 5)' },
      },
      required: [],
    },
  },
  {
    name: 'get_top_services',
    description: 'Get the most popular services by booking count',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'How many services to return (default 5)' },
      },
      required: [],
    },
  },
  {
    name: 'get_cancellation_stats',
    description: 'Get cancellation statistics — rate, count, and who cancelled. Use for questions about cancellations.',
    input_schema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['today', 'this_week', 'this_month', 'last_month', 'all_time'] },
      },
      required: ['period'],
    },
  },
  {
    name: 'get_peak_hours',
    description: 'Get the busiest hours of the day based on appointment history.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_no_shows',
    description: 'Get appointments that were never confirmed and are now in the past — potential no-shows.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_lost_customers',
    description: 'Get customers who have not booked in a while (30+ days since their last appointment).',
    input_schema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Number of days of inactivity (default 30)' },
      },
      required: [],
    },
  },
  {
    name: 'get_new_customers',
    description: 'Get customers who booked for the first time in a given period.',
    input_schema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['this_week', 'this_month', 'last_month'] },
      },
      required: ['period'],
    },
  },
  {
    name: 'get_worker_stats',
    description: 'Get appointment count and revenue per worker.',
    input_schema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['this_week', 'this_month', 'last_month', 'all_time'] },
      },
      required: ['period'],
    },
  },
  {
    name: 'get_projected_revenue',
    description: 'Get projected revenue from upcoming confirmed/pending appointments.',
    input_schema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['today', 'this_week', 'next_week', 'this_month'] },
      },
      required: ['period'],
    },
  },
  {
    name: 'get_daily_average',
    description: 'Get the average number of appointments per day and busiest days of the week.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_month_comparison',
    description: 'Compare this month vs last month — appointments count and revenue.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'cancel_appointment',
    description: 'Cancel a specific appointment by ID. Only use this after the user has confirmed they want to cancel.',
    input_schema: {
      type: 'object',
      properties: {
        appointment_id: { type: 'number', description: 'The appointment ID to cancel' },
      },
      required: ['appointment_id'],
    },
  },
  {
    name: 'get_waitlist',
    description: 'Get waiting list entries. Use for questions like: who is on the waitlist, waitlist for a specific date, how many people are waiting, who was notified but hasn\'t confirmed yet, expired waitlist entries.',
    input_schema: {
      type: 'object',
      properties: {
        date_from: { type: 'string', description: 'Filter by slot date from (YYYY-MM-DD), optional' },
        date_to: { type: 'string', description: 'Filter by slot date to (YYYY-MM-DD), optional' },
        status: { type: 'string', enum: ['waiting', 'notified', 'confirmed', 'cancelled'], description: 'Filter by status, optional' },
      },
      required: [],
    },
  },
  {
    name: 'get_store_info',
    description: 'Get store status and all products with their details. Use for any question about the store, products, prices, or inventory.',
    input_schema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Optional product name to search for' },
      },
      required: [],
    },
  },
  {
    name: 'get_all_customers',
    description: 'Get all registered customers for this business, including their appointment count and total spent. Use this to answer questions about how many customers there are or to list all customers.',
    input_schema: {
      type: 'object',
      properties: {
        include_no_appointments: { type: 'boolean', description: 'If true, include customers with no appointments or only cancelled appointments (default true)' },
      },
      required: [],
    },
  },
  {
    name: 'get_upcoming_appointments',
    description: 'Get all upcoming (future) appointments',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max number of appointments to return (default 10)' },
      },
      required: [],
    },
  },
];

// ── Tool execution ────────────────────────────────────────────────────────────

function israelNow() {
  const local = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
  const pad = n => String(n).padStart(2, '0');
  return `${local.getFullYear()}-${pad(local.getMonth()+1)}-${pad(local.getDate())} ${pad(local.getHours())}:${pad(local.getMinutes())}:${pad(local.getSeconds())}`;
}

function israelToday() {
  return israelNow().slice(0, 10);
}

function executeTool(name, input, businessId) {
  const db = getDb();

  if (name === 'get_appointments') {
    const dateTo = input.date_to || input.date_from;
    let query = `
      SELECT a.id, a.start_time, a.end_time, a.status, a.notes,
             c.name AS customer_name, c.phone AS customer_phone,
             w.name AS worker_name, s.name AS service_name, s.price
      FROM appointments a
      JOIN users c ON a.customer_id = c.id
      JOIN users w ON a.worker_id = w.id
      JOIN services s ON a.service_id = s.id
      WHERE a.business_id = ?
        AND date(a.start_time) >= ? AND date(a.start_time) <= ?
    `;
    const params = [businessId, input.date_from, dateTo];
    if (input.status) { query += ' AND a.status = ?'; params.push(input.status); }
    query += ' ORDER BY a.start_time ASC';
    return db.prepare(query).all(...params);
  }

  if (name === 'search_appointments_by_customer') {
    let query = `
      SELECT a.id, a.start_time, a.status,
             c.name AS customer_name, c.phone AS customer_phone,
             w.name AS worker_name, s.name AS service_name, s.price
      FROM appointments a
      JOIN users c ON a.customer_id = c.id
      JOIN users w ON a.worker_id = w.id
      JOIN services s ON a.service_id = s.id
      WHERE a.business_id = ? AND c.name LIKE ?
    `;
    const params = [businessId, `%${input.customer_name}%`];
    if (input.upcoming_only) { query += ' AND a.start_time > ?'; params.push(israelNow()); }
    query += ' ORDER BY a.start_time DESC LIMIT 20';
    return db.prepare(query).all(...params);
  }

  if (name === 'get_revenue_stats') {
    const today = israelToday();
    let dateFilter = '';
    if (input.period === 'today') dateFilter = `AND date(a.start_time) = '${today}'`;
    else if (input.period === 'this_week') dateFilter = `AND date(a.start_time) >= date('${today}', '-6 days')`;
    else if (input.period === 'this_month') dateFilter = `AND strftime('%Y-%m', a.start_time) = '${today.slice(0,7)}'`;
    else if (input.period === 'last_month') {
      const lastMonth = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const lm = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth()+1).padStart(2,'0')}`;
      dateFilter = `AND strftime('%Y-%m', a.start_time) = '${lm}'`;
    }

    let serviceFilter = '';
    const params = [businessId];
    if (input.service_name) { serviceFilter = 'AND s.name LIKE ?'; params.push(`%${input.service_name}%`); }

    return db.prepare(`
      SELECT COUNT(*) AS appointment_count, SUM(s.price) AS total_revenue,
             GROUP_CONCAT(DISTINCT s.name) AS services
      FROM appointments a
      JOIN services s ON a.service_id = s.id
      WHERE a.business_id = ? AND a.status IN ('completed', 'confirmed')
      ${dateFilter} ${serviceFilter}
    `).get(...params);
  }

  if (name === 'get_top_customers') {
    const limit = input.limit || 5;
    return db.prepare(`
      SELECT c.name, c.phone, COUNT(a.id) AS appointment_count,
             SUM(s.price) AS total_spent
      FROM appointments a
      JOIN users c ON a.customer_id = c.id
      JOIN services s ON a.service_id = s.id
      WHERE a.business_id = ? AND a.status NOT IN ('cancelled')
      GROUP BY c.id ORDER BY appointment_count DESC LIMIT ?
    `).all(businessId, limit);
  }

  if (name === 'get_top_services') {
    const limit = input.limit || 5;
    return db.prepare(`
      SELECT s.name, COUNT(a.id) AS booking_count, SUM(s.price) AS total_revenue
      FROM appointments a
      JOIN services s ON a.service_id = s.id
      WHERE a.business_id = ? AND a.status NOT IN ('cancelled')
      GROUP BY s.id ORDER BY booking_count DESC LIMIT ?
    `).all(businessId, limit);
  }

  if (name === 'get_cancellation_stats') {
    const today = israelToday();
    let dateFilter = '';
    if (input.period === 'today') dateFilter = `AND date(a.start_time) = '${today}'`;
    else if (input.period === 'this_week') dateFilter = `AND date(a.start_time) >= date('${today}', '-6 days')`;
    else if (input.period === 'this_month') dateFilter = `AND strftime('%Y-%m', a.start_time) = '${today.slice(0,7)}'`;
    else if (input.period === 'last_month') {
      const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
      d.setMonth(d.getMonth() - 1);
      dateFilter = `AND strftime('%Y-%m', a.start_time) = '${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}'`;
    }
    const cancelled = db.prepare(`
      SELECT c.name AS customer_name, s.name AS service_name, a.start_time
      FROM appointments a
      JOIN users c ON a.customer_id = c.id
      JOIN services s ON a.service_id = s.id
      WHERE a.business_id = ? AND a.status = 'cancelled' ${dateFilter}
      ORDER BY a.start_time DESC
    `).all(businessId);
    const total = db.prepare(`SELECT COUNT(*) AS cnt FROM appointments WHERE business_id = ? ${dateFilter.replace(/a\./g,'')}`).get(businessId);
    return { cancelled_count: cancelled.length, total_appointments: total.cnt, cancellation_rate: total.cnt > 0 ? ((cancelled.length / total.cnt) * 100).toFixed(1) + '%' : '0%', cancelled };
  }

  if (name === 'get_peak_hours') {
    return db.prepare(`
      SELECT CAST(strftime('%H', start_time) AS INTEGER) AS hour, COUNT(*) AS count
      FROM appointments
      WHERE business_id = ? AND status NOT IN ('cancelled')
      GROUP BY hour ORDER BY count DESC
    `).all(businessId);
  }

  if (name === 'get_no_shows') {
    return db.prepare(`
      SELECT a.id, a.start_time, c.name AS customer_name, c.phone, s.name AS service_name, w.name AS worker_name
      FROM appointments a
      JOIN users c ON a.customer_id = c.id
      JOIN services s ON a.service_id = s.id
      JOIN users w ON a.worker_id = w.id
      WHERE a.business_id = ? AND a.status = 'pending' AND a.end_time < ?
      ORDER BY a.start_time DESC LIMIT 20
    `).all(businessId, israelNow());
  }

  if (name === 'get_lost_customers') {
    const days = input.days || 30;
    const cutoff = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
    cutoff.setDate(cutoff.getDate() - days);
    const pad = n => String(n).padStart(2, '0');
    const cutoffStr = `${cutoff.getFullYear()}-${pad(cutoff.getMonth()+1)}-${pad(cutoff.getDate())}`;
    return db.prepare(`
      SELECT u.name, u.email, u.phone, MAX(a.start_time) AS last_appointment, COUNT(a.id) AS total_appointments
      FROM users u
      JOIN appointments a ON a.customer_id = u.id AND a.business_id = ?
      WHERE u.role = 'user' AND u.business_id = ? AND a.status NOT IN ('cancelled')
      GROUP BY u.id
      HAVING date(MAX(a.start_time)) < ?
      ORDER BY last_appointment ASC
    `).all(businessId, businessId, cutoffStr);
  }

  if (name === 'get_new_customers') {
    const today = israelToday();
    let dateFilter = '';
    if (input.period === 'this_week') dateFilter = `AND date(a.start_time) >= date('${today}', '-6 days')`;
    else if (input.period === 'this_month') dateFilter = `AND strftime('%Y-%m', a.start_time) = '${today.slice(0,7)}'`;
    else if (input.period === 'last_month') {
      const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
      d.setMonth(d.getMonth() - 1);
      dateFilter = `AND strftime('%Y-%m', a.start_time) = '${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}'`;
    }
    return db.prepare(`
      SELECT u.name, u.email, u.phone, MIN(a.start_time) AS first_appointment, s.name AS service_name
      FROM users u
      JOIN appointments a ON a.customer_id = u.id AND a.business_id = ?
      JOIN services s ON a.service_id = s.id
      WHERE u.role = 'user' AND u.business_id = ? AND a.status NOT IN ('cancelled')
      GROUP BY u.id
      HAVING date(MIN(a.start_time)) = date(MAX(a.start_time)) ${dateFilter.replace('a.start_time', 'MIN(a.start_time)')}
      ORDER BY first_appointment ASC
    `).all(businessId, businessId);
  }

  if (name === 'get_worker_stats') {
    const today = israelToday();
    let dateFilter = '';
    if (input.period === 'this_week') dateFilter = `AND date(a.start_time) >= date('${today}', '-6 days')`;
    else if (input.period === 'this_month') dateFilter = `AND strftime('%Y-%m', a.start_time) = '${today.slice(0,7)}'`;
    else if (input.period === 'last_month') {
      const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
      d.setMonth(d.getMonth() - 1);
      dateFilter = `AND strftime('%Y-%m', a.start_time) = '${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}'`;
    }
    return db.prepare(`
      SELECT w.name AS worker_name, COUNT(a.id) AS appointment_count, SUM(s.price) AS total_revenue
      FROM appointments a
      JOIN users w ON a.worker_id = w.id
      JOIN services s ON a.service_id = s.id
      WHERE a.business_id = ? AND a.status NOT IN ('cancelled') ${dateFilter}
      GROUP BY w.id ORDER BY total_revenue DESC
    `).all(businessId);
  }

  if (name === 'get_projected_revenue') {
    const today = israelToday();
    const now = israelNow();
    let dateFilter = '';
    if (input.period === 'today') dateFilter = `AND date(a.start_time) = '${today}' AND a.start_time > '${now}'`;
    else if (input.period === 'this_week') dateFilter = `AND date(a.start_time) >= '${today}' AND date(a.start_time) <= date('${today}', '+6 days')`;
    else if (input.period === 'next_week') dateFilter = `AND date(a.start_time) >= date('${today}', '+7 days') AND date(a.start_time) <= date('${today}', '+13 days')`;
    else if (input.period === 'this_month') dateFilter = `AND strftime('%Y-%m', a.start_time) = '${today.slice(0,7)}' AND a.start_time > '${now}'`;
    return db.prepare(`
      SELECT COUNT(*) AS appointment_count, SUM(s.price) AS projected_revenue
      FROM appointments a
      JOIN services s ON a.service_id = s.id
      WHERE a.business_id = ? AND a.status IN ('pending', 'confirmed') ${dateFilter}
    `).get(businessId);
  }

  if (name === 'get_daily_average') {
    const avg = db.prepare(`
      SELECT AVG(cnt) AS daily_average FROM (
        SELECT date(start_time) AS day, COUNT(*) AS cnt
        FROM appointments
        WHERE business_id = ? AND status NOT IN ('cancelled')
        GROUP BY day
      )
    `).get(businessId);
    const byDay = db.prepare(`
      SELECT CAST(strftime('%w', start_time) AS INTEGER) AS day_of_week, COUNT(*) AS count
      FROM appointments
      WHERE business_id = ? AND status NOT IN ('cancelled')
      GROUP BY day_of_week ORDER BY count DESC
    `).all(businessId);
    const dayNames = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
    return { daily_average: avg.daily_average?.toFixed(1), busiest_days: byDay.map(d => ({ day: dayNames[d.day_of_week], count: d.count })) };
  }

  if (name === 'get_month_comparison') {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
    const thisMonth = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    d.setMonth(d.getMonth() - 1);
    const lastMonth = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const query = (month) => db.prepare(`
      SELECT COUNT(*) AS appointments, SUM(s.price) AS revenue
      FROM appointments a JOIN services s ON a.service_id = s.id
      WHERE a.business_id = ? AND a.status IN ('completed','confirmed') AND strftime('%Y-%m', a.start_time) = ?
    `).get(businessId, month);
    return { this_month: { month: thisMonth, ...query(thisMonth) }, last_month: { month: lastMonth, ...query(lastMonth) } };
  }

  if (name === 'cancel_appointment') {
    const appt = db.prepare(`
      SELECT a.id, a.status, a.start_time, c.name AS customer_name, s.name AS service_name
      FROM appointments a
      JOIN users c ON a.customer_id = c.id
      JOIN services s ON a.service_id = s.id
      WHERE a.id = ? AND a.business_id = ?
    `).get(input.appointment_id, businessId);
    if (!appt) return { error: 'תור לא נמצא' };
    if (appt.status === 'cancelled') return { error: 'התור כבר בוטל' };
    db.prepare("UPDATE appointments SET status = 'cancelled' WHERE id = ?").run(input.appointment_id);
    return { success: true, message: `התור של ${appt.customer_name} ל${appt.service_name} בתאריך ${appt.start_time} בוטל בהצלחה` };
  }

  if (name === 'get_waitlist') {
    let query = `
      SELECT
        wl.id, wl.slot_time, wl.status, wl.notified_at, wl.expires_at, wl.created_at,
        c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email,
        s.name AS service_name,
        w.name AS worker_name
      FROM waiting_list wl
      JOIN users c ON wl.customer_id = c.id
      JOIN services s ON wl.service_id = s.id
      LEFT JOIN users w ON wl.worker_id = w.id
      WHERE wl.business_id = ?
    `;
    const params = [businessId];
    if (input.date_from) { query += ' AND date(wl.slot_time) >= ?'; params.push(input.date_from); }
    if (input.date_to) { query += ' AND date(wl.slot_time) <= ?'; params.push(input.date_to); }
    if (input.status) { query += ' AND wl.status = ?'; params.push(input.status); }
    query += ' ORDER BY wl.slot_time ASC';
    const entries = db.prepare(query).all(...params);
    return { count: entries.length, entries };
  }

  if (name === 'get_store_info') {
    const business = db.prepare('SELECT store_enabled FROM businesses WHERE id = ?').get(businessId);
    let query = 'SELECT id, name, description, price, image_url FROM products WHERE business_id = ? AND is_active = 1';
    const params = [businessId];
    if (input.search) { query += ' AND name LIKE ?'; params.push(`%${input.search}%`); }
    query += ' ORDER BY name ASC';
    const products = db.prepare(query).all(...params);
    return { store_enabled: !!business?.store_enabled, product_count: products.length, products };
  }

  if (name === 'get_all_customers') {
    return db.prepare(`
      SELECT u.id, u.name, u.email, u.phone, u.created_at,
             COUNT(a.id) AS appointment_count,
             SUM(CASE WHEN a.status NOT IN ('cancelled') THEN s.price ELSE 0 END) AS total_spent
      FROM users u
      LEFT JOIN appointments a ON a.customer_id = u.id AND a.business_id = ?
      LEFT JOIN services s ON a.service_id = s.id
      WHERE u.role = 'user' AND u.business_id = ? AND u.is_active = 1
      GROUP BY u.id
      ORDER BY appointment_count DESC
    `).all(businessId, businessId);
  }

  if (name === 'get_upcoming_appointments') {
    const limit = input.limit || 10;
    return db.prepare(`
      SELECT a.id, a.start_time, a.status,
             c.name AS customer_name, c.phone AS customer_phone,
             w.name AS worker_name, s.name AS service_name, s.price
      FROM appointments a
      JOIN users c ON a.customer_id = c.id
      JOIN users w ON a.worker_id = w.id
      JOIN services s ON a.service_id = s.id
      WHERE a.business_id = ? AND a.start_time > ? AND a.status NOT IN ('cancelled')
      ORDER BY a.start_time ASC LIMIT ?
    `).all(businessId, israelNow(), limit);
  }

  return { error: 'Unknown tool' };
}

// ── Main chat function ────────────────────────────────────────────────────────

async function chat(messages, businessId) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const today = israelToday();

  const systemPrompt = `אתה עוזר AI חכם למנהל עסק של תורים. אתה עונה תמיד בעברית, בצורה קצרה וברורה.
התאריך של היום הוא ${today}.
יש לך גישה לנתוני העסק: תורים, לקוחות, שירותים והכנסות.
כשמבקשים לבטל תור - תמיד בקש אישור מהמנהל לפני ביצוע הפעולה. ציין את שם הלקוח, השירות והתאריך.
אם אין נתונים רלוונטיים - אמור זאת בפשטות.

חשוב מאוד: אסור לך להמציא שמות, מספרים או נתונים. השתמש אך ורק במידע שקיבלת מהכלים. אם הכלי החזיר רשימה ריקה - אמור שאין נתונים. אל תשלים נתונים מהדמיון שלך.`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: systemPrompt,
    tools,
    messages,
  });

  // Handle tool use (may loop multiple times)
  if (response.stop_reason === 'tool_use') {
    const toolResults = [];
    for (const block of response.content) {
      if (block.type === 'tool_use') {
        const result = executeTool(block.name, block.input, businessId);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }
    }

    // Send tool results back to Claude
    const finalResponse = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      tools,
      messages: [
        ...messages,
        { role: 'assistant', content: response.content },
        { role: 'user', content: toolResults },
      ],
    });

    return finalResponse.content.find(b => b.type === 'text')?.text || 'אין תשובה';
  }

  return response.content.find(b => b.type === 'text')?.text || 'אין תשובה';
}

module.exports = { chat };
