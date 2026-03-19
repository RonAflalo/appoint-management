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
אם אין נתונים רלוונטיים - אמור זאת בפשטות.`;

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
