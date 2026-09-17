const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { createDatabase } = require('../src/database');
const { createApp } = require('../src/app');
const { createFeatures } = require('../src/features');
const { queryReports, safeDownload } = require('../src/reports');

let database, server, base, patient, admin;
const config = { demo: true, sessionMs: 1800000, encryptionKey: randomBytes(32).toString('hex') };
async function request(route, body, account) {
  const response = await fetch(base + route, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', 'X-DiagnoBot': '1', ...(account ? { Cookie: account.cookie, 'X-CSRF-Token': account.csrf } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = await response.json();
  return { status: response.status, ...json, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
before(async () => {
  database = await createDatabase();
  const classifier = async () => ({ intent: 'escalation', confidence: 0.3, reason: 'low_confidence', groq_ms: 12, groq_called: true });
  server = createApp({ database, config, installFeatures: createFeatures({ classifier }) }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  patient = await request('/api/auth/demo/patient', {});
  admin = await request('/api/auth/demo/admin', {});
});
after(async () => { await new Promise(resolve => server.close(resolve)); await database.close(); });

test('reports, six centres, pricing and clinical guard are routed without inventing live data', async () => {
  const reports = await request('/api/chat', { message: 'Report status', action: 'report_status' }, patient);
  assert.equal(reports.source, 'sample');
  assert.equal(reports.reports.length, 2);
  assert.equal((await request('/api/chat', { message: 'Centres', action: 'centre_info' }, patient)).centres.length, 6);
  assert.equal((await request('/api/chat', { message: 'Pricing', action: 'pricing' }, patient)).pricing.length, 5);
  assert.equal((await request('/api/chat', { message: 'Is my report normal?', action: 'report_status' }, patient)).escalation_reason, 'clinical');
  assert.equal((await request('/api/chat', { message: 'unclear request' }, patient)).escalation_reason, 'low_confidence');
  assert.equal((await request('/admin/metrics', undefined, patient)).status, 403);
});

test('consented support tickets are deduplicated, access controlled, and support real replies', async () => {
  assert.equal((await request('/api/escalations', { consent: false }, patient)).status, 400);
  const first = await request('/api/escalations', { consent: true }, patient);
  assert.equal((await request('/api/escalations', { consent: true }, patient)).ticket.id, first.ticket.id);
  assert.equal((await request('/admin/queue', undefined, admin)).queue.length, 1);
  assert.equal((await request('/admin/queue/' + first.ticket.id, undefined, admin)).status, 404);
  assert.equal((await request('/admin/queue/' + first.ticket.id, { action: 'reply', message: 'Before claim' }, admin)).status, 409);
  assert.equal((await request('/admin/queue/' + first.ticket.id, { action: 'claim' }, admin)).status, 200);
  assert.equal((await request('/admin/queue/' + first.ticket.id, { action: 'reply', message: 'I can help with this request.' }, admin)).status, 200);
  assert.equal((await request('/api/escalations', undefined, patient)).messages[0].content, 'I can help with this request.');
  assert.equal((await request('/api/escalations/' + first.ticket.id + '/messages', { message: 'Thanks from sample patient' }, admin)).status, 404);
  assert.equal((await request('/api/escalations/' + randomUUID() + '/messages', { message: 'Wrong ID' }, patient)).status, 404);
  assert.equal((await request('/admin/queue/' + first.ticket.id, { action: 'resolve' }, admin)).status, 200);
  assert.equal((await request('/api/escalations/' + first.ticket.id + '/messages', { message: 'After close' }, patient)).status, 404);
  const metrics = await request('/admin/metrics', undefined, admin);
  assert.equal(metrics.total_requests, 5);
  assert.equal(metrics.groq_calls, 1);
  assert.ok(!JSON.stringify((await request('/admin/audit', undefined, admin)).logs).includes('sample patient'));
});

test('live LIS never uses a registration supplied by the browser; validates status and HTTPS links', async () => {
  const live = { demo: false, lisUrl: 'https://lis.example.test/api/v1', lisKey: 'test-only', reportHosts: ['reports.example.test'] };
  let called = false;
  await assert.rejects(queryReports({ registration_number: 'REG-20260910-001' }, live, async () => { called = true; }), /identity_link_required/);
  assert.equal(called, false);
  const result = await queryReports({ patient_id: 'verified-patient' }, live, async (url, options) => {
    assert.ok(url.endsWith('/reports/verified-patient'));
    assert.ok(options.signal);
    return { ok: true, json: async () => ({ reports: [{ report_id: 'id', test_name: 'Sample test', status: 'ready', download_url: 'javascript:alert(1)' }] }) };
  });
  assert.equal(result.reports[0].download_url, null);
  const future = new Date(Date.now() + 600000).toISOString();
  assert.equal(safeDownload('https://untrusted.test/report', future, live.reportHosts), null);
  assert.ok(safeDownload('https://reports.example.test/report', future, live.reportHosts));
  assert.equal(safeDownload('https://reports.example.test/report', '2000-01-01', live.reportHosts), null);
  await assert.rejects(queryReports({ patient_id: 'verified' }, live, async () => { const error = new Error(); error.name = 'TimeoutError'; throw error; }), /lis_timeout/);
});