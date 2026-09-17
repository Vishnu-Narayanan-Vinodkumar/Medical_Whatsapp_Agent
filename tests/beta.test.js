const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createWebReader, publicAddress } = require('../src/web');
const { randomBytes, randomUUID } = require('node:crypto');
const Stripe = require('stripe');
const { createDatabase } = require('../src/database');
const { createApp } = require('../src/app');
const { createFeatures } = require('../src/features');

async function fixture(context, config = {}, dependencies = {}) {
  const database = await createDatabase();
  const server = createApp({ database, config: { demo: true, sessionMs: 1800000, encryptionKey: randomBytes(32).toString('hex'), ...config }, installFeatures: createFeatures(dependencies) }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  context.after(async () => { await new Promise(resolve => server.close(resolve)); await database.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (route, body, account) => {
    const response = await fetch(base + route, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', 'X-DiagnoBot': '1', ...(account ? { Cookie: account.cookie, 'X-CSRF-Token': account.csrf } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, ...await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  };
  return { database, base, call, patient: await call('/api/auth/demo/patient', {}), admin: await call('/api/auth/demo/admin', {}) };
}

test('website transport rejects local, mixed DNS, mapped and reserved addresses', async () => {
  const local = async () => [{ address: '127.0.0.1', family: 4 }];
  for (const url of ['http://example.test', 'https://127.0.0.1', 'https://[::1]', 'https://user:pass@example.test', 'https://example.test:8443', 'https://example.test']) await assert.rejects(publicAddress(url, local));
  for (const address of ['10.0.0.1', '169.254.169.254', '192.168.0.1', '::ffff:127.0.0.1', 'fc00::1', '0.0.0.0', '100.64.0.1']) await assert.rejects(publicAddress('https://example.test', async () => [{ address, family: address.includes(':') ? 6 : 4 }]));
  await assert.rejects(publicAddress('https://example.test', async () => [{ address: '93.184.216.34', family: 4 }, { address: '127.0.0.1', family: 4 }]));
  assert.equal((await publicAddress('https://example.test', async () => [{ address: '93.184.216.34', family: 4 }])).records.length, 1);
});

test('approved website extraction respects robots, strips active HTML and caches bounded excerpts', async () => {
  let calls = 0;
  const reader = createWebReader({ urls: ['https://example.test/clinic'], requestImpl: async url => {
    calls++;
    return url.endsWith('/robots.txt') ? { status: 200, text: 'User-agent: *\nAllow: /' } : { status: 200, type: 'text/html', text: '<title>Clinic</title><main>Public hours<script>steal()</script><form>secret form</form> 9 to 5<svg><title>Logo</title></svg></main>' };
  } });
  const result = await reader();
  assert.equal(result.sources[0].text, 'Public hours 9 to 5');
  assert.equal(result.sources[0].title, 'Clinic');
  assert.equal(result.sources[0].url, 'https://example.test/clinic');
  await reader();
  assert.equal(calls, 2);
  const blocked = createWebReader({ urls: ['https://example.test/private'], requestImpl: async () => ({ status: 200, text: 'User-agent: *\nDisallow: /' }) });
  assert.deepEqual(await blocked(), { sources: [], unavailable: 1 });
});

test('beta chat keeps session history, cites retrieved sources and cannot execute model suggestions', async context => {
  const turns = [];
  const { call, patient, admin } = await fixture(context, {}, { assistant: async input => { turns.push(input); return { message: 'Use the booking form to confirm.', action: 'book', groq_called: true }; }, webReader: async () => ({ sources: [{ url: 'https://example.test', title: 'Public source', text: 'Hours', retrieved_at: '2026-09-17' }], unavailable: 0 }) });
  assert.equal((await call('/api/beta/chat', { message: 'Hi' })).status, 401);
  const first = await call('/api/beta/chat', { message: 'Book a test', use_web: true, latitude: 12.12345, patient_id: 'secret-id' }, patient);
  assert.equal(first.suggested_action, 'book');
  assert.equal(first.sources[0].title, 'Public source');
  assert.equal((await call('/api/bookings', undefined, patient)).bookings.length, 0);
  await call('/api/beta/chat', { message: 'What about tomorrow?' }, patient);
  assert.equal(turns[1].history[0].text, 'Book a test');
  assert.ok(!JSON.stringify(turns).includes('12.12345'));
  assert.ok(!JSON.stringify(turns).includes('secret-id'));
  assert.equal((await call('/api/beta/history', undefined, admin)).turns.length, 0);
});

test('bookings enforce ownership, authoritative pricing, idempotency, slot capacity and sample payment', async context => {
  const { call, patient, admin } = await fixture(context);
  const slots = (await call('/api/booking/slots?centre=mg-road', undefined, patient)).slots;
  const request = { request_id: randomUUID(), centre_id: 'mg-road', product_id: 'glucose', starts_at: slots[0], consent: true, amount: 1 };
  assert.equal((await call('/api/bookings', { ...request, consent: false }, patient)).status, 400);
  assert.equal((await call('/api/bookings', { ...request, starts_at: '2000-01-01' }, patient)).status, 400);
  const created = await call('/api/bookings', request, patient);
  assert.equal(created.status, 201);
  assert.equal(created.booking.amount, 20000);
  assert.equal((await call('/api/bookings', request, patient)).booking.id, created.booking.id);
  assert.equal((await call('/api/bookings', { ...request, centre_id: 'omr' }, patient)).status, 409);
  assert.equal((await call('/api/bookings', { ...request, request_id: randomUUID() }, admin)).status, 409);
  assert.equal((await call(`/api/bookings/${created.booking.id}/pay`, { consent: true, simulate: true }, admin)).status, 404);
  assert.equal((await call(`/api/bookings/${created.booking.id}/pay`, { consent: true }, patient)).status, 400);
  const paid = await call(`/api/bookings/${created.booking.id}/pay`, { consent: true, simulate: true }, patient);
  assert.equal(paid.booking.payment_status, 'simulated');
  const otherSlots = (await call('/api/booking/slots?centre=omr', undefined, patient)).slots;
  const moved = await call(`/api/bookings/${created.booking.id}/reschedule`, { centre_id: 'omr', starts_at: otherSlots[0], consent: true }, patient);
  assert.equal(moved.booking.centre_id, 'omr');
  assert.equal(moved.booking.amount, 20000);
  assert.equal((await call('/admin/bookings', undefined, patient)).status, 403);
  assert.equal((await call('/admin/bookings', undefined, admin)).bookings.length, 1);
  assert.equal((await call(`/api/bookings/${created.booking.id}/cancel`, { consent: true }, patient)).status, 200);
  assert.equal((await call(`/api/bookings/${created.booking.id}/pay`, { consent: true, simulate: true }, patient)).status, 409);
});

test('Stripe checkout uses server prices and signed, amount-checked, idempotent payment confirmation', async context => {
  const config = { paymentMode: 'stripe', stripeSecret: 'sk_test_synthetic', stripeWebhookSecret: 'whsec_synthetic', origin: 'http://localhost:3000' };
  let session;
  let creates = 0;
  const paymentClient = { checkout: { sessions: {
    create: async (body, options) => {
      creates++;
      assert.equal(body.line_items[0].price_data.unit_amount, 20000);
      assert.equal(body.line_items[0].price_data.product_data.name, 'Diagnostics appointment reservation');
      assert.equal(options.idempotencyKey, `booking-${body.client_reference_id}`);
      session = { id: 'cs_test_synthetic', client_reference_id: body.client_reference_id, amount_total: 20000, currency: 'inr', livemode: false, status: 'open', payment_status: 'unpaid', url: 'https://checkout.stripe.com/c/pay/test' };
      return session;
    }, retrieve: async () => session,
  } } };
  const { call, base, patient, database } = await fixture(context, config, { paymentClient });
  const slots = (await call('/api/booking/slots?centre=mg-road', undefined, patient)).slots;
  const created = await call('/api/bookings', { request_id: randomUUID(), centre_id: 'mg-road', product_id: 'glucose', starts_at: slots[0], consent: true }, patient);
  const route = `/api/bookings/${created.booking.id}/pay`;
  assert.equal((await call(route, { consent: true, simulate: true }, patient)).checkout_url, session.url);
  await call(route, { consent: true }, patient);
  assert.equal(creates, 1);
  assert.equal((await call('/api/bookings', undefined, patient)).bookings[0].payment_status, 'unpaid');
  const notify = async (object, valid = true) => {
    const payload = JSON.stringify({ id: 'evt_test', type: 'checkout.session.completed', data: { object } });
    const signature = new Stripe(config.stripeSecret).webhooks.generateTestHeaderString({ payload, secret: config.stripeWebhookSecret });
    return fetch(base + '/api/payments/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': valid ? signature : 'invalid' }, body: payload });
  };
  session = { ...session, status: 'complete', payment_status: 'paid' };
  assert.equal((await notify(session, false)).status, 400);
  assert.equal((await notify({ ...session, amount_total: 1 })).status, 503);
  assert.equal((await call('/api/bookings', undefined, patient)).bookings[0].payment_status, 'unpaid');
  assert.equal((await notify(session)).status, 200);
  assert.equal((await notify(session)).status, 200);
  assert.equal((await call('/api/bookings', undefined, patient)).bookings[0].status, 'confirmed');
  assert.equal((await database.query("SELECT * FROM audit_logs WHERE action='payment_confirmed'")).rows.length, 1);
  assert.equal((await call(`/api/bookings/${created.booking.id}/cancel`, { consent: true }, patient)).status, 409);
});