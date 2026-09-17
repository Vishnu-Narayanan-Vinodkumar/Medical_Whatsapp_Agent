const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { createClassifier } = require('./classifier');
const { queryReports } = require('./reports');
const sampleCatalogue = require('./catalogue.json');
const { createAssistant } = require('./assistant');
const { createWebReader } = require('./web');
const { installBookings } = require('./bookings');

function createFeatures({ classifier, fetchImpl, assistant, webReader, paymentClient } = {}) {
  return function installFeatures(app, { database, security, config, auth }) {
    const classify = classifier || createClassifier({ apiKey: config.demo || config.groqLiveApproved ? config.groqKey : '', model: config.groqModel });
    const catalogue = config.demo ? sampleCatalogue : config.catalogueFile ? JSON.parse(fs.readFileSync(config.catalogueFile, 'utf8')) : { centres: [], pricing: [] };
    if (!Array.isArray(catalogue.centres) || !Array.isArray(catalogue.pricing)) throw new Error('Catalogue requires centres and pricing arrays.');
    const inFlight = new Set();
    const busy = (req, res, next) => {
      if (inFlight.has(req.user.id)) return res.status(409).json({ error: 'Please wait for your previous message.' });
      inFlight.add(req.user.id);
      res.once('finish', () => inFlight.delete(req.user.id));
      res.once('close', () => inFlight.delete(req.user.id));
      next();
    };
    installBookings(app, { database, config, auth, catalogue, busy, paymentClient });
    const converse = assistant || createAssistant({ apiKey: config.demo || config.groqLiveApproved ? config.groqKey : '', model: config.groqModel });
    const readWeb = webReader || createWebReader({ urls: config.webSources || [] });
    const validId = value => /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value || '');
    const validMessage = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 1000;
    const offer = reason => ({ requires_escalation: true, escalation_reason: reason,
      message: reason === 'identity_link_required' ? 'Your lab record is not yet linked to this account. Request support to complete identity verification.' :
        reason === 'clinical' ? 'I cannot interpret results or give medical advice. A qualified clinician should discuss this with you. Would you like to request support?' :
          reason === 'appointment' ? 'Our team handles appointment requests. Would you like to request support for booking, rescheduling or cancellation?' :
            reason.startsWith('lis_') ? 'The report service is unavailable right now. You can try again or request support.' :
              reason === 'groq_unavailable' ? 'I could not understand this message because the language service is unavailable. You can select a topic or request support.' :
                'Would you like to request support from our team?' });

    app.get('/api/beta/history', auth.authenticate, (req, res) => res.json({ turns: req.context.beta_turns || [] }));
    app.post('/api/beta/chat', auth.authenticate, busy, async (req, res) => {
      if (config.betaEnabled === false) return res.status(404).json({ error: 'Beta assistant is disabled.' });
      if (!validMessage(req.body.message)) return res.status(400).json({ error: 'Enter a message of 1-1000 characters.' });
      const started = Date.now();
      const count = (await database.query("SELECT COUNT(*)::int AS count FROM audit_logs WHERE user_id=$1 AND action='chat_message' AND created_at>=CURRENT_DATE", [req.user.id])).rows[0].count;
      if (count >= 100) return res.status(429).json({ error: 'Daily message limit reached. Please contact your centre.' });
      const text = req.body.message.trim();
      const centres = catalogue.centres.filter(centre => !req.body.city || centre.city === req.body.city);
      const web = req.body.use_web === true ? await readWeb() : { sources: [], unavailable: 0 };
      const context = {
        sample: config.demo,
        centres: centres.map(({ id, name, city, address, hours }) => ({ id, name, city, address, hours })),
        pricing: catalogue.pricing.map(({ id, name, price }) => ({ id, name, price, currency: 'INR' })),
        sources: web.sources.map((source, index) => ({ label: index + 1, title: source.title, text: source.text })),
      };
      const reply = await converse({ message: text, history: req.context.beta_turns || [], fullName: req.profile.full_name, context });
      const result = { message: reply.message, intent: 'beta_conversation', suggested_action: reply.action, unavailable: Boolean(reply.unavailable), sources: web.sources.map(({ url, title, retrieved_at }) => ({ url, title, retrieved_at })), web_unavailable: web.unavailable };
      if (req.body.use_web === true && !web.sources.length) result.web_notice = 'No approved website content could be retrieved. This reply does not use live web information.';
      if (reply.action === 'centres') result.centres = centres;
      if (reply.action === 'pricing') result.pricing = catalogue.pricing;
      if (reply.action === 'support') Object.assign(result, { requires_escalation: true, escalation_reason: 'beta_support' });
      req.context.beta_turns = [...(req.context.beta_turns || []), { role: 'patient', text }, { role: 'assistant', text: reply.message }].slice(-10);
      req.context.turns = req.context.beta_turns;
      req.context.pending_reason = reply.action === 'support' ? 'beta_support' : null;
      await database.query("INSERT INTO audit_logs (user_id,action,intent,success,response_ms,groq_ms,groq_called,reason) VALUES ($1,'chat_message','beta_conversation',$2,$3,$4,$5,$6)", [req.user.id, !reply.unavailable, Date.now() - started, reply.groq_ms || 0, reply.groq_called || false, reply.reason || null]);
      result.expires_at = await auth.refresh(req, res);
      result.response_time_ms = Date.now() - started;
      res.json(result);
    });

    app.post('/api/chat', auth.authenticate, busy, async (req, res) => {
      const started = Date.now();
      if (!validMessage(req.body.message)) return res.status(400).json({ error: 'Enter a message of 1-1000 characters.' });
      const count = (await database.query("SELECT COUNT(*)::int AS count FROM audit_logs WHERE user_id=$1 AND action='chat_message' AND created_at>=CURRENT_DATE", [req.user.id])).rows[0].count;
      if (count >= 100) return res.status(429).json({ error: 'Daily message limit reached. Please contact your centre.' });
      const text = req.body.message.trim();
      let classification;
      const clinical = /\b(normal|interpret|diagnos\w*|cure|treatment|medication|symptom\w*|dosage|mg\/dl)\b|what does .*(mean|result)|should i take/i.test(text);
      if (clinical) classification = { intent: 'escalation', confidence: 1, reason: 'clinical' };
      else if (['report_status', 'centre_info', 'pricing', 'appointment', 'escalation'].includes(req.body.action)) classification = { intent: req.body.action, confidence: 1, reason: req.body.action };
      else if (/^(hi|hello|hey|thanks|thank you|help)[!.\s]*$/i.test(text)) classification = { intent: 'greeting', confidence: 1, reason: 'greeting' };
      else classification = await classify(text, req.profile.full_name);
      let result = { intent: classification.intent, confidence: classification.confidence, requires_escalation: false };
      if (classification.intent === 'report_status') {
        try {
          const data = await queryReports(req.profile, config, fetchImpl);
          result = { ...result, ...data, message: data.source === 'sample' ? 'Sample report statuses. These are fictional records, not your medical results.' : data.reports.length ? 'Here are the latest statuses from the lab.' : 'No recent reports were found for your linked account.' };
          if (data.reports.some(report => ['delayed', 'error'].includes(report.status))) result = { ...result, ...offer('lis_report_delayed') };
        } catch (error) { result = { ...result, ...offer(error.message) }; }
      } else if (classification.intent === 'centre_info') {
        const selected = catalogue.centres.find(centre => centre.id === req.body.centre_id || text.toLowerCase().includes(centre.name.split(' - ').at(-1).toLowerCase()));
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
        const centres = (selected ? [selected] : catalogue.centres).map(centre => ({ ...centre, holiday_today: centre.holidays?.includes(today) || false }));
        result = { ...result, centres, source: config.demo ? 'sample' : 'catalogue', message: centres.length ? config.demo ? 'Sample centre directory. Confirm details with the centre before travelling.' : 'Centre directory' : 'Centre details have not been configured. Please contact your centre.' };
      } else if (classification.intent === 'pricing') {
        const pricing = catalogue.pricing.map(item => ({ ...item, promotion: item.promotion && Date.parse(`${item.promotion.ends}T23:59:59+05:30`) > Date.now() ? item.promotion : null }));
        result = { ...result, pricing, source: config.demo ? 'sample' : 'catalogue', message: pricing.length ? config.demo ? 'Sample prices in INR, not a confirmed quote.' : 'Current catalogue prices in INR.' : 'Pricing has not been configured. Please contact your centre.' };
      } else if (classification.intent === 'greeting') result.message = 'Hello. What would you like to ask about today?';
      else result = { ...result, ...offer(classification.reason || classification.intent) };
      req.context.pending_reason = result.requires_escalation ? result.escalation_reason : null;
      req.context.turns = [...(req.context.turns || []), { role: 'patient', text }, { role: 'assistant', text: result.message }].slice(-10);
      await database.query(`INSERT INTO audit_logs (user_id,action,intent,confidence,success,reason,response_ms,groq_ms,groq_called)
        VALUES ($1,'chat_message',$2,$3,$4,$5,$6,$7,$8)`,
      [req.user.id, result.intent, result.confidence, !['groq_unavailable', 'lis_unavailable', 'lis_timeout'].includes(result.escalation_reason), result.escalation_reason || null, Date.now() - started, classification.groq_ms || 0, classification.groq_called || false]);
      result.expires_at = await auth.refresh(req, res);
      result.response_time_ms = Date.now() - started;
      res.json(result);
    });

    app.post('/api/escalations', auth.authenticate, busy, async (req, res) => {
      if (req.body.consent !== true) return res.status(400).json({ error: 'Confirm before sharing the recent conversation with support.' });
      const reason = req.context.pending_reason || 'explicit_request';
      const ticket = (await database.query(`INSERT INTO tickets (id,user_id,reason,context) VALUES ($1,$2,$3,$4)
        ON CONFLICT (user_id) WHERE status<>'resolved' DO UPDATE SET user_id=EXCLUDED.user_id RETURNING id,status,reason,created_at`,
      [randomUUID(), req.user.id, reason, security.seal(req.context.turns || [])])).rows[0];
      req.context.pending_reason = null;
      await auth.audit(req.user.id, 'escalation_requested');
      res.status(201).json({ ticket, expires_at: await auth.refresh(req, res), message: 'Support request created. An operator can reply here when available. This is not an emergency service.' });
    });

    async function ticketMessages(ticketId) {
      const rows = (await database.query("SELECT id,author,content,created_at FROM ticket_messages WHERE ticket_id=$1 AND created_at>NOW()-INTERVAL '30 minutes' ORDER BY id DESC LIMIT 100", [ticketId])).rows;
      return rows.reverse().map(row => ({ ...row, content: security.open(row.content) }));
    }
    app.get('/api/escalations', auth.authenticate, async (req, res) => {
      const ticket = (await database.query('SELECT id,status,reason,created_at,updated_at FROM tickets WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1', [req.user.id])).rows[0];
      res.json({ ticket: ticket || null, messages: ticket ? await ticketMessages(ticket.id) : [] });
    });
    app.post('/api/escalations/:id/messages', auth.authenticate, busy, async (req, res) => {
      if (!validId(req.params.id) || !validMessage(req.body.message)) return res.status(400).json({ error: 'Enter a message of 1-1000 characters.' });
      const inserted = await database.query(`INSERT INTO ticket_messages (ticket_id,author,content)
        SELECT id,'patient',$1 FROM tickets WHERE id=$2 AND user_id=$3 AND status<>'resolved' RETURNING id`, [security.seal(req.body.message.trim()), req.params.id, req.user.id]);
      if (!inserted.rows.length) return res.status(404).json({ error: 'Open support request not found.' });
      await auth.audit(req.user.id, 'support_message');
      res.json({ message: 'Message sent to support.', expires_at: await auth.refresh(req, res) });
    });

    app.use('/admin', auth.authenticate, auth.adminOnly);
    app.get(['/admin/metrics', '/metrics'], auth.authenticate, auth.adminOnly, async (req, res) => {
      const rows = (await database.query("SELECT intent,success,response_ms,groq_ms,groq_called,reason FROM audit_logs WHERE action='chat_message' AND created_at>=CURRENT_DATE")).rows;
      const latencies = rows.map(row => row.response_ms).sort((first, second) => first - second);
      const intents = {};
      for (const row of rows) intents[row.intent] = (intents[row.intent] || 0) + 1;
      const groqRows = rows.filter(row => row.groq_called);
      const active = (await database.query('SELECT COUNT(*)::int AS count FROM sessions WHERE expires_at>NOW()')).rows[0].count;
      const auditCount = (await database.query('SELECT COUNT(*)::int AS count FROM audit_logs')).rows[0].count;
      res.json({ total_requests: rows.length, active_sessions: active, audit_count: auditCount, successes: rows.filter(row => row.success).length,
        errors: rows.filter(row => !row.success).length, timeouts: rows.filter(row => row.reason === 'lis_timeout').length,
        avg_ms: rows.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / rows.length) : 0,
        p95_ms: latencies.length ? latencies[Math.ceil(latencies.length * 0.95) - 1] : 0,
        groq_calls: groqRows.length, groq_avg_ms: groqRows.length ? Math.round(groqRows.reduce((sum, row) => sum + row.groq_ms, 0) / groqRows.length) : 0,
        intents, timestamp: new Date().toISOString() });
    });
    app.get('/admin/audit', async (req, res) => {
      const limit = Math.max(1, Math.min(100, Number.parseInt(req.query.limit, 10) || 50));
      const logs = (await database.query('SELECT * FROM audit_logs ORDER BY id DESC LIMIT $1', [limit])).rows;
      res.json({ logs });
    });
    app.get('/admin/queue', async (req, res) => {
      const queue = (await database.query("SELECT id,user_id,reason,status,assigned_to,created_at FROM tickets WHERE status<>'resolved' ORDER BY created_at LIMIT 100")).rows;
      res.json({ queue });
    });
    app.get('/admin/queue/:id', async (req, res) => {
      if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid request ID.' });
      const ticket = (await database.query('SELECT * FROM tickets WHERE id=$1 AND assigned_to=$2', [req.params.id, req.user.id])).rows[0];
      if (!ticket) return res.status(404).json({ error: 'Claim this request before reading its conversation.' });
      const context = ticket.context && Date.now() - new Date(ticket.created_at).getTime() < 1800000 ? security.open(ticket.context) : [];
      await auth.audit(req.user.id, 'support_context_read');
      res.json({ ticket: { id: ticket.id, reason: ticket.reason, status: ticket.status }, context, messages: await ticketMessages(ticket.id) });
    });
    app.post('/admin/queue/:id', busy, async (req, res) => {
      if (!validId(req.params.id) || !['claim', 'reply', 'resolve'].includes(req.body.action)) return res.status(400).json({ error: 'Invalid support action.' });
      let result;
      if (req.body.action === 'claim') result = await database.query("UPDATE tickets SET status='assigned',assigned_to=$1,updated_at=NOW() WHERE id=$2 AND (status='waiting' OR (status='assigned' AND assigned_to=$1)) RETURNING id", [req.user.id, req.params.id]);
      if (req.body.action === 'resolve') result = await database.query("UPDATE tickets SET status='resolved',updated_at=NOW() WHERE id=$1 AND assigned_to=$2 AND status='assigned' RETURNING id", [req.params.id, req.user.id]);
      if (req.body.action === 'reply') {
        if (!validMessage(req.body.message)) return res.status(400).json({ error: 'Enter a reply of 1-1000 characters.' });
        result = await database.query("INSERT INTO ticket_messages (ticket_id,author,content) SELECT id,'agent',$1 FROM tickets WHERE id=$2 AND assigned_to=$3 AND status='assigned' RETURNING id", [security.seal(req.body.message.trim()), req.params.id, req.user.id]);
      }
      if (!result.rows.length) return res.status(409).json({ error: 'This request is unavailable or assigned to another operator.' });
      await auth.audit(req.user.id, `support_${req.body.action}`);
      res.json({ message: 'Support request updated.', expires_at: await auth.refresh(req, res) });
    });
  };
}

module.exports = { createFeatures };