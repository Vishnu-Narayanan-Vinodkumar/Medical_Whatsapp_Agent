const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { createDatabase } = require('../src/database');
const { createApp } = require('../src/app');

let database, server, base;
const config = { demo: true, production: false, sessionMs: 1800000, encryptionKey: randomBytes(32).toString('hex') };
before(async () => {
  database = await createDatabase();
  server = createApp({ database, config }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise(resolve => server.close(resolve)); await database.close(); });

async function request(route, body, credentials = {}) {
  const response = await fetch(base + route, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', 'X-DiagnoBot': '1', ...credentials },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
}

test('registration ignores attempted admin role; login and logout use HttpOnly sessions', async () => {
  const account = { email: 'patient@example.com', password: 'SamplePassword123!', full_name: 'Sample Patient', consent: true, role: 'admin' };
  assert.equal((await request('/api/auth/register', account)).status, 201);
  const login = await request('/api/auth/login', account);
  assert.equal(login.status, 200);
  assert.equal(login.body.user.role, 'patient');
  assert.ok(login.cookie);
  assert.equal(login.body.session_token, undefined);
  const headers = { Cookie: login.cookie, 'X-CSRF-Token': login.body.csrf };
  assert.equal((await request('/api/auth/me', undefined, headers)).status, 200);
  assert.equal((await request('/api/auth/logout', {}, { Cookie: login.cookie })).status, 403);
  assert.equal((await request('/api/auth/logout', {}, headers)).status, 200);
  assert.equal((await request('/api/auth/me', undefined, headers)).status, 401);
});

test('expired and replaced sessions cannot be reused; polling does not extend expiry', async () => {
  const first = await request('/api/auth/demo/patient', {});
  const second = await request('/api/auth/demo/patient', {});
  assert.equal((await request('/api/auth/me', undefined, { Cookie: first.cookie })).status, 401);
  const beforeExpiry = (await database.query('SELECT expires_at FROM sessions WHERE user_id=$1', [second.body.user.id])).rows[0].expires_at;
  await request('/api/auth/me', undefined, { Cookie: second.cookie });
  assert.equal(String((await database.query('SELECT expires_at FROM sessions WHERE user_id=$1', [second.body.user.id])).rows[0].expires_at), String(beforeExpiry));
  await database.query("UPDATE sessions SET expires_at=NOW()-INTERVAL '1 second'");
  assert.equal((await request('/api/auth/me', undefined, { Cookie: second.cookie })).status, 401);
});

test('cross-origin writes and unauthenticated access are rejected', async () => {
  assert.equal((await request('/api/auth/me')).status, 401);
  assert.equal((await request('/api/auth/demo/admin', {}, { Origin: 'https://untrusted.example' })).status, 403);
  assert.equal((await request('/.env')).status, 404);
  assert.equal((await request('/src/config.js')).status, 404);
});

test('audit schema cannot contain plaintext request or medical payloads', async () => {
  const logs = (await database.query('SELECT * FROM audit_logs')).rows;
  const serialized = JSON.stringify(logs);
  for (const sensitive of ['patient@example.com', 'Sample Patient', 'SamplePassword123!', 'session_token', 'password_hash']) assert.ok(!serialized.includes(sensitive));
});