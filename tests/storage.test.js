const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { createDatabase } = require('../src/database');
const { createSecurity, validPassword } = require('../src/security');
const { inspectDatabase } = require('../src/manage');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

test('encrypted profiles authenticate ciphertext and reject tampering', () => {
  const security = createSecurity(randomBytes(32).toString('hex'));
  const profile = { email: 'sample@example.com', full_name: 'Sample Patient' };
  const sealed = security.seal(profile);
  assert.ok(!sealed.includes('sample'));
  assert.deepEqual(security.open(sealed), profile);
  const changed = Buffer.from(sealed, 'base64');
  changed[30] ^= 1;
  assert.throws(() => security.open(changed.toString('base64')));
  assert.equal(validPassword('Short1!'), false);
  assert.equal(validPassword('SecureSample123!'), true);
  assert.equal(validPassword('SecureSample123!' + 'a'.repeat(80)), false);
});

test('PostgreSQL schema enforces session uniqueness and cleans expired data', async () => {
  const database = await createDatabase();
  try {
    const userId = randomUUID();
    await database.query('INSERT INTO users (id, email_hash, profile, password_hash) VALUES ($1,$2,$3,$4)', [userId, 'hash', 'encrypted', 'hashed']);
    await database.query("INSERT INTO sessions (token_hash,user_id,csrf,context,expires_at) VALUES ($1,$2,$3,$4,NOW() - INTERVAL '1 minute')", ['token-hash', userId, 'csrf', 'encrypted']);
    await assert.rejects(database.query("INSERT INTO sessions (token_hash,user_id,csrf,context,expires_at) VALUES ($1,$2,$3,$4,NOW())", ['second', userId, 'csrf', 'encrypted']));
    await database.cleanup();
    assert.equal((await database.query('SELECT * FROM sessions')).rows.length, 0);
  } finally { await database.close(); }
});

test('embedded data survives restart and rejects a second process handle', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'diagnobot-test-'));
  let database;
  try {
    database = await createDatabase({ dataDir: directory });
    await database.query("INSERT INTO audit_logs (action) VALUES ('persistence_test')");
    await assert.rejects(createDatabase({ dataDir: directory }), /already open/);
    await database.close();
    database = await createDatabase({ dataDir: directory, readOnly: true });
    assert.equal((await database.query('SELECT action FROM audit_logs')).rows[0].action, 'persistence_test');
    assert.equal((await inspectDatabase(database, 'audit_logs'))[0].action, 'persistence_test');
    await assert.rejects(database.query('DELETE FROM audit_logs'), /read-only/);
    await assert.rejects(database.query('CREATE TABLE inspection_write (id INTEGER)'), /read-only/);
  } finally {
    if (database) await database.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('database inspection limits tables and excludes authentication and encrypted content fields', async () => {
  const database = await createDatabase();
  try {
    await database.query('INSERT INTO users (id,email_hash,profile,password_hash) VALUES ($1,$2,$3,$4)', [randomUUID(), 'private-email-hash', 'private-profile', 'private-password-hash']);
    const overview = await inspectDatabase(database);
    assert.equal(overview.find(row => row.table === 'users').rows, 1);
    const users = await inspectDatabase(database, 'users');
    assert.deepEqual(Object.keys(users[0]), ['id', 'role', 'verified', 'created_at']);
    assert.ok(!JSON.stringify(users).includes('private'));
    for (const table of ['users; DROP TABLE users', '__proto__', 'pg_authid']) await assert.rejects(inspectDatabase(database, table), /Inspect: choose/);
  } finally { await database.close(); }
});