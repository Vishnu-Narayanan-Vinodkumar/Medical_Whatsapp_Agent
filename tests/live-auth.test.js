const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { createDatabase } = require('../src/database');
const { createApp } = require('../src/app');

test('live verification and reset tokens expire, are single-use, and revoke sessions', async () => {
  const database = await createDatabase();
  const sent = [];
  const config = { demo: false, sessionMs: 1800000, encryptionKey: randomBytes(32).toString('hex'), origin: 'https://app.example.test' };
  const server = createApp({ database, config, mailer: { sendMail: async mail => sent.push(mail) } }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (route, body, headers = {}) => {
    const response = await fetch(base + route, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', 'X-DiagnoBot': '1', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, data: response.headers.get('content-type')?.includes('json') ? await response.json() : null, cookie: response.headers.get('set-cookie')?.split(';')[0] };
  };
  try {
    const account = { email: 'verify@example.test', full_name: 'Verification Sample', password: 'SamplePassword123!', consent: true };
    assert.equal((await request('/api/auth/register', account)).status, 201);
    assert.equal(sent.length, 1);
    assert.equal((await request('/api/auth/login', account)).status, 403);
    assert.equal((await request('/api/auth/demo/admin', {})).status, 404);
    const verification = sent[0].text.match(/#verify=([a-f0-9]{64})/)[1];
    assert.notEqual((await database.query('SELECT verify_hash FROM users')).rows[0].verify_hash, verification);
    await database.query("UPDATE users SET verify_expires=NOW()-INTERVAL '1 second'");
    assert.equal((await request('/api/auth/verify', { token: verification })).status, 400);
    await request('/api/auth/recover', { email: account.email, kind: 'verify' });
    const fresh = sent[1].text.match(/#verify=([a-f0-9]{64})/)[1];
    assert.equal((await request('/api/auth/verify', { token: fresh })).status, 200);
    assert.equal((await request('/api/auth/verify', { token: fresh })).status, 400);
    const login = await request('/api/auth/login', account);
    assert.equal(login.status, 200);
    const recovery = await request('/api/auth/recover', { email: account.email, kind: 'reset' });
    const absent = await request('/api/auth/recover', { email: 'absent@example.test', kind: 'reset' });
    assert.deepEqual(recovery.data, absent.data);
    const reset = sent[2].text.match(/#reset=([a-f0-9]{64})/)[1];
    const nextPassword = 'DifferentPassword456!';
    assert.equal((await request('/api/auth/reset', { token: reset, password: nextPassword })).status, 200);
    assert.equal((await request('/api/auth/reset', { token: reset, password: nextPassword })).status, 400);
    assert.equal((await request('/api/auth/me', undefined, { Cookie: login.cookie })).status, 401);
    assert.equal((await request('/api/auth/login', { ...account, password: nextPassword })).status, 200);
    assert.equal((await request('/api/auth/login', account)).status, 401);
  } finally { await new Promise(resolve => server.close(resolve)); await database.close(); }
});