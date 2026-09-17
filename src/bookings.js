const { randomUUID } = require('node:crypto');
const Stripe = require('stripe');

const validId = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const paymentMode = config => config.paymentMode === 'stripe' ? (config.stripeSecret?.startsWith('sk_live_') ? 'stripe_live' : 'stripe_test') : config.paymentMode || (config.demo ? 'demo' : 'disabled');
const stripeClient = config => config.paymentMode === 'stripe' && config.stripeSecret ? new Stripe(config.stripeSecret, { timeout: 10000, maxNetworkRetries: 1 }) : null;
const publicBooking = row => ({ id: row.id, centre_id: row.centre_id, centre_name: row.centre_name, product_id: row.product_id, product_name: row.product_name, starts_at: row.starts_at, amount: row.amount, currency: row.currency, status: row.status, payment_status: row.payment_status, payment_mode: row.payment_mode, checkout_started: Boolean(row.checkout_id) });

function centreSlots(centre, demo, now = Date.now()) {
  if (!centre) return [];
  if (!demo) return (Array.isArray(centre.slots) ? centre.slots : []).filter(slot => typeof slot === 'string' && Date.parse(slot) > now + 3600000 && Date.parse(slot) < now + 30 * 86400000).map(slot => new Date(slot).toISOString());
  const slots = [];
  const india = new Date(now + 330 * 60000);
  for (let offset = 0; offset < 14; offset++) {
    const day = new Date(Date.UTC(india.getUTCFullYear(), india.getUTCMonth(), india.getUTCDate() + offset));
    const date = day.toISOString().slice(0, 10);
    if (day.getUTCDay() === 0 || centre.holidays?.includes(date)) continue;
    for (const hour of ['09', '10', '11', '14', '15']) {
      const slot = new Date(`${date}T${hour}:00:00+05:30`);
      if (slot.getTime() > now + 3600000) slots.push(slot.toISOString());
    }
  }
  return slots;
}

async function reconcilePayment(database, session) {
  if (!session || !validId(session.client_reference_id) || typeof session.id !== 'string') return false;
  const row = (await database.query('SELECT * FROM bookings WHERE id=$1 AND checkout_id=$2', [session.client_reference_id, session.id])).rows[0];
  if (!row || !row.payment_mode.startsWith('stripe_')) return false;
  if (session.amount_total !== row.amount || session.currency !== row.currency || session.livemode !== (row.payment_mode === 'stripe_live')) throw new Error('Payment verification mismatch.');
  if (session.status === 'complete' && session.payment_status === 'paid') {
    const changed = await database.query("UPDATE bookings SET status='confirmed',payment_status='paid',updated_at=NOW() WHERE id=$1 AND status='pending' RETURNING user_id", [row.id]);
    if (changed.rows.length) await database.query("INSERT INTO audit_logs (user_id,action) VALUES ($1,'payment_confirmed')", [row.user_id]);
    return true;
  }
  if (session.status === 'expired') await database.query("UPDATE bookings SET status='expired',updated_at=NOW() WHERE id=$1 AND status='pending' AND payment_status='unpaid'", [row.id]);
  return false;
}

function installPaymentWebhook(app, { database, config }) {
  const stripe = stripeClient(config);
  app.post('/api/payments/webhook', require('express').raw({ type: 'application/json', limit: '128kb' }), async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!stripe || !config.stripeWebhookSecret) return res.sendStatus(503);
    let event;
    try { event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], config.stripeWebhookSecret); }
    catch { return res.status(400).json({ error: 'Invalid payment signature.' }); }
    try {
      if (['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.expired'].includes(event.type)) await reconcilePayment(database, event.data.object);
      res.json({ received: true });
    } catch { res.status(503).json({ error: 'Payment reconciliation will be retried.' }); }
  });
}

function installBookings(app, { database, config, auth, catalogue, busy, paymentClient }) {
  const stripe = paymentClient || stripeClient(config);
  const mode = paymentMode(config);
  const route = handler => async (req, res, next) => {
    try { await handler(req, res); }
    catch (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'That slot was just reserved. Choose another time.' });
      if (error.status) return res.status(error.status).json({ error: error.message });
      next(error);
    }
  };
  async function owned(req) {
    if (!validId(req.params.id)) fail(400, 'Invalid booking ID.');
    const row = (await database.query('SELECT * FROM bookings WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id])).rows[0];
    if (!row) fail(404, 'Booking not found.');
    return row;
  }
  function selection(body) {
    const centre = catalogue.centres.find(item => item.id === body.centre_id);
    if (!centre || !centreSlots(centre, config.demo).includes(body.starts_at)) fail(400, 'Choose an available centre and future slot.');
    return centre;
  }
  async function expireDrafts() {
    await database.query("UPDATE bookings SET status='expired' WHERE status='pending' AND checkout_id IS NULL AND updated_at<NOW()-INTERVAL '30 minutes'");
  }
  app.get('/api/booking/options', auth.authenticate, route(async (req, res) => {
    await expireDrafts();
    res.json({ centres: catalogue.centres, pricing: catalogue.pricing, payment_mode: mode, sample: config.demo });
  }));
  app.get('/api/booking/slots', auth.authenticate, route(async (req, res) => {
    await expireDrafts();
    const centre = catalogue.centres.find(item => item.id === req.query.centre);
    const reserved = (await database.query("SELECT starts_at FROM bookings WHERE centre_id=$1 AND status IN ('pending','confirmed')", [centre?.id || ''])).rows.map(row => new Date(row.starts_at).toISOString());
    res.json({ slots: centreSlots(centre, config.demo).filter(slot => !reserved.includes(slot)), timezone: 'Asia/Kolkata' });
  }));
  app.get('/api/bookings', auth.authenticate, route(async (req, res) => {
    await expireDrafts();
    const rows = (await database.query('SELECT * FROM bookings WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50', [req.user.id])).rows;
    res.json({ bookings: rows.map(publicBooking) });
  }));
  app.post('/api/bookings', auth.authenticate, busy, route(async (req, res) => {
    if (req.body.consent !== true || !validId(req.body.request_id)) fail(400, 'Confirm the booking details before reserving.');
    const existing = (await database.query('SELECT * FROM bookings WHERE user_id=$1 AND request_id=$2', [req.user.id, req.body.request_id])).rows[0];
    if (existing) {
      if (existing.centre_id !== req.body.centre_id || existing.product_id !== req.body.product_id || new Date(existing.starts_at).toISOString() !== req.body.starts_at) fail(409, 'This request already reserved different details. Review My appointments before booking again.');
      return res.json({ booking: publicBooking(existing) });
    }
    await expireDrafts();
    const active = (await database.query("SELECT COUNT(*)::int AS count FROM bookings WHERE user_id=$1 AND status IN ('pending','confirmed') AND starts_at>NOW()", [req.user.id])).rows[0].count;
    if (active >= 5) fail(429, 'You already have five upcoming reservations.');
    const centre = selection(req.body);
    const product = catalogue.pricing.find(item => item.id === req.body.product_id);
    const amount = Math.round(product?.price * 100);
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 100000000) fail(400, 'Select a test with a configured price.');
    const row = (await database.query('INSERT INTO bookings (id,user_id,request_id,centre_id,centre_name,product_id,product_name,starts_at,amount,payment_mode) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
      [randomUUID(), req.user.id, req.body.request_id, centre.id, centre.name, product.id, product.name, req.body.starts_at, amount, mode])).rows[0];
    await auth.audit(req.user.id, 'booking_reserved');
    res.status(201).json({ booking: publicBooking(row), expires_at: await auth.refresh(req, res) });
  }));
  app.post('/api/bookings/:id/reschedule', auth.authenticate, busy, route(async (req, res) => {
    const row = await owned(req);
    if (req.body.consent !== true) fail(400, 'Confirm the new location and time.');
    if (!['pending', 'confirmed'].includes(row.status) || (row.status === 'pending' && row.checkout_id) || new Date(row.starts_at).getTime() <= Date.now()) fail(409, 'This booking cannot be changed here. Request support.');
    const centre = selection(req.body);
    const updated = (await database.query("UPDATE bookings SET centre_id=$1,centre_name=$2,starts_at=$3,updated_at=NOW() WHERE id=$4 AND status IN ('pending','confirmed') RETURNING *", [centre.id, centre.name, req.body.starts_at, row.id])).rows[0];
    await auth.audit(req.user.id, 'booking_rescheduled');
    res.json({ booking: publicBooking(updated), expires_at: await auth.refresh(req, res) });
  }));
  app.post('/api/bookings/:id/cancel', auth.authenticate, busy, route(async (req, res) => {
    const row = await owned(req);
    if (req.body.consent !== true) fail(400, 'Confirm cancellation.');
    if (row.payment_status === 'paid') fail(409, 'Paid cancellations and refunds require support. Your booking is unchanged.');
    if (row.checkout_id) {
      if (!stripe) fail(503, 'Payment service unavailable.');
      const session = await stripe.checkout.sessions.retrieve(row.checkout_id);
      await reconcilePayment(database, session);
      if (session.status === 'complete') fail(409, 'Checkout has completed. Contact support for cancellation.');
      if (session.status === 'open') await stripe.checkout.sessions.expire(row.checkout_id);
    }
    await database.query("UPDATE bookings SET status='cancelled',updated_at=NOW() WHERE id=$1 AND payment_status<>'paid'", [row.id]);
    await auth.audit(req.user.id, 'booking_cancelled');
    res.json({ message: 'Booking cancelled.', expires_at: await auth.refresh(req, res) });
  }));
  app.post('/api/bookings/:id/pay', auth.authenticate, busy, route(async (req, res) => {
    await expireDrafts();
    const row = await owned(req);
    if (req.body.consent !== true) fail(400, 'Confirm before proceeding to payment.');
    if (row.status === 'confirmed') return res.json({ booking: publicBooking(row) });
    if (row.status !== 'pending' || new Date(row.starts_at).getTime() <= Date.now()) fail(409, 'Reservation is no longer payable.');
    if (row.payment_mode !== mode) fail(409, 'Payment configuration changed. Cancel this reservation and book again.');
    if (mode === 'demo') {
      if (!config.demo || req.body.simulate !== true) fail(400, 'Confirm sample payment simulation. No money will move.');
      const updated = (await database.query("UPDATE bookings SET status='confirmed',payment_status='simulated',updated_at=NOW() WHERE id=$1 AND status='pending' RETURNING *", [row.id])).rows[0];
      await auth.audit(req.user.id, 'payment_simulated');
      return res.json({ booking: publicBooking(updated), expires_at: await auth.refresh(req, res) });
    }
    if (!stripe || !config.origin || mode === 'disabled') fail(503, 'Online payments are not configured. Your reservation remains unpaid.');
    const payable = await database.query("UPDATE bookings SET updated_at=NOW() WHERE id=$1 AND status='pending' RETURNING id", [row.id]);
    if (!payable.rows.length) fail(409, 'Reservation is no longer payable.');
    let session;
    if (row.checkout_id) session = await stripe.checkout.sessions.retrieve(row.checkout_id);
    else {
      session = await stripe.checkout.sessions.create({ mode: 'payment', payment_method_types: ['card'], client_reference_id: row.id,
        line_items: [{ price_data: { currency: row.currency, unit_amount: row.amount, product_data: { name: 'Diagnostics appointment reservation' } }, quantity: 1 }],
        expires_at: Math.floor(Date.now() / 1000) + 1860,
        success_url: `${config.origin}/?checkout=return`, cancel_url: `${config.origin}/?checkout=cancelled`,
      }, { idempotencyKey: `booking-${row.id}` });
      await database.query('UPDATE bookings SET checkout_id=$1,updated_at=NOW() WHERE id=$2', [session.id, row.id]);
    }
    await reconcilePayment(database, session);
    if (session.status !== 'open') return res.json({ message: 'Payment status refreshed. Open your appointments for the latest status.' });
    const checkout = new URL(session.url);
    if (checkout.protocol !== 'https:' || checkout.hostname !== 'checkout.stripe.com') fail(503, 'Invalid checkout URL.');
    res.json({ checkout_url: checkout.href, payment_mode: mode });
  }));
  app.post('/api/bookings/:id/refresh', auth.authenticate, busy, route(async (req, res) => {
    const row = await owned(req);
    if (row.checkout_id && stripe) await reconcilePayment(database, await stripe.checkout.sessions.retrieve(row.checkout_id));
    res.json({ booking: publicBooking(await owned(req)), expires_at: await auth.refresh(req, res) });
  }));
  app.get('/admin/bookings', auth.authenticate, auth.adminOnly, route(async (req, res) => {
    const rows = (await database.query('SELECT * FROM bookings ORDER BY created_at DESC LIMIT 100')).rows;
    res.json({ bookings: rows.map(publicBooking) });
  }));
}

module.exports = { installBookings, installPaymentWebhook, reconcilePayment, centreSlots, paymentMode };