const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { execFile, spawn } = require('node:child_process');
const { once } = require('node:events');
const { promisify } = require('node:util');
const lockfile = require('proper-lockfile');
const { createDatabase } = require('../src/database');
const { loadConfig } = require('../src/config');
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

test('startup reports an active database lock without removing it', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'diagnobot-startup-'));
  const lockPath = path.join(directory, 'database.lock');
  const release = await lockfile.lock(directory, { lockfilePath: lockPath, stale: 10000, update: 2000 });
  try {
    await assert.rejects(promisify(execFile)(process.execPath, [path.join(__dirname, '..', 'bot-core.js')], {
      encoding: 'utf8',
      timeout: 25000,
      env: {
        ...process.env,
        NODE_ENV: 'test', DATA_MODE: 'demo', DATA_DIR: directory, DATABASE_URL: '',
        ENCRYPTION_KEY: randomBytes(32).toString('hex'), PAYMENT_MODE: 'demo', WEB_SOURCES: '[]',
      },
    }), error => {
      assert.equal(error.code, 1);
      assert.equal(error.stderr.trim(), 'Embedded database is already open. Stop the other local server first.');
      return true;
    });
    assert.ok((await fs.stat(lockPath)).isDirectory());
  } finally {
    await release();
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('embedded database recovers an abandoned heartbeat lock and preserves data', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'diagnobot-recovery-'));
  const lockPath = path.join(directory, 'database.lock');
  let database;
  try {
    database = await createDatabase({ dataDir: directory });
    await database.query("INSERT INTO audit_logs (action) VALUES ('crash_recovery_test')");
    await database.close();
    database = null;
    await fs.mkdir(lockPath);
    const expired = new Date(Date.now() - 60000);
    await fs.utimes(lockPath, expired, expired);
    database = await createDatabase({ dataDir: directory });
    assert.equal((await database.query('SELECT action FROM audit_logs')).rows[0].action, 'crash_recovery_test');
    assert.ok((await fs.stat(lockPath)).isDirectory());
    await database.close();
    database = null;
    await assert.rejects(fs.stat(lockPath), { code: 'ENOENT' });
  } finally {
    if (database) await database.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('fresh sample configuration creates and reuses its encryption key and database', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'diagnobot-fresh-'));
  let database;
  try {
    const config = loadConfig({ DATA_DIR: directory });
    assert.equal(config.demo, true);
    assert.equal(config.databaseUrl, '');
    assert.equal(config.groqKey, '');
    assert.match(config.encryptionKey, /^[a-f0-9]{64}$/);
    const profile = { email: 'fresh@example.com', full_name: 'Fresh Sample' };
    database = await createDatabase(config);
    await database.query('INSERT INTO users (id, email_hash, profile, password_hash) VALUES ($1,$2,$3,$4)', [randomUUID(), 'fresh-hash', createSecurity(config.encryptionKey).seal(profile), 'hashed']);
    await database.close();
    database = null;
    const restartedConfig = loadConfig({ DATA_DIR: directory });
    assert.equal(restartedConfig.encryptionKey, config.encryptionKey);
    database = await createDatabase(restartedConfig);
    const stored = (await database.query("SELECT profile FROM users WHERE email_hash = 'fresh-hash'")).rows[0].profile;
    assert.deepEqual(createSecurity(restartedConfig.encryptionKey).open(stored), profile);
  } finally {
    if (database) await database.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('embedded database restarts automatically after its owner is forcibly killed', { timeout: 45000 }, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'diagnobot-killed-'));
  const child = spawn(process.execPath, ['-e', `
    const { createDatabase } = require(${JSON.stringify(require.resolve('../src/database'))});
    process.on('message', () => {});
    createDatabase({ dataDir: process.env.DATA_DIR }).then(async database => {
      await database.query("INSERT INTO audit_logs (action) VALUES ('forced_stop_test')");
      process.send('ready');
    }).catch(() => process.exit(1));
  `], { env: { ...process.env, DATA_DIR: directory }, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  let database;
  try {
    const [message] = await once(child, 'message', { signal: AbortSignal.timeout(20000) });
    assert.equal(message, 'ready');
    const exited = once(child, 'exit');
    child.kill('SIGKILL');
    await exited;
    assert.ok((await fs.stat(path.join(directory, 'database.lock'))).isDirectory());
    database = await createDatabase({ dataDir: directory });
    assert.equal((await database.query('SELECT action FROM audit_logs')).rows[0].action, 'forced_stop_test');
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill('SIGKILL');
      await exited;
    }
    if (database) await database.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('legacy PID locks are preserved even when old to protect older servers', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'diagnobot-legacy-'));
  const lockPath = path.join(directory, 'database.lock');
  try {
    await fs.writeFile(lockPath, String(process.pid));
    const expired = new Date(Date.now() - 60000);
    await fs.utimes(lockPath, expired, expired);
    await assert.rejects(createDatabase({ dataDir: directory }), { code: 'DATABASE_LEGACY_LOCK' });
    assert.equal(await fs.readFile(lockPath, 'utf8'), String(process.pid));
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('failed database initialization releases its heartbeat lock', async context => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'diagnobot-init-'));
  const { PGlite } = require('@electric-sql/pglite');
  const exec = context.mock.method(PGlite.prototype, 'exec', async () => { throw new Error('Schema initialization failed'); });
  try {
    await assert.rejects(createDatabase({ dataDir: directory }), /Schema initialization failed/);
    await assert.rejects(fs.stat(path.join(directory, 'database.lock')), { code: 'ENOENT' });
  } finally {
    exec.mock.restore();
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