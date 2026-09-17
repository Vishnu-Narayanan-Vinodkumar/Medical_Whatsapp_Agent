const fs = require('node:fs');
const path = require('node:path');
const lockfile = require('proper-lockfile');

async function createDatabase({ databaseUrl = '', dataDir, readOnly = false } = {}) {
  let client;
  let releaseLock;
  if (!databaseUrl && dataDir) {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      dataDir = fs.realpathSync(dataDir);
      const lockPath = path.join(dataDir, 'database.lock');
      try {
        if (!fs.lstatSync(lockPath).isDirectory()) {
          throw Object.assign(new Error('Legacy database lock found. Stop any older server using DATA_DIR, then remove only its database.lock file and retry. Do not delete postgres or local.key.'), { code: 'DATABASE_LEGACY_LOCK' });
        }
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      releaseLock = await lockfile.lock(dataDir, {
        lockfilePath: lockPath,
        stale: 10000,
        update: 2000,
        retries: { retries: 12, factor: 1, minTimeout: 1000, maxTimeout: 1000 },
      });
    } catch (error) {
      if (error.code === 'ELOCKED') {
        throw Object.assign(new Error('Embedded database is already open. Stop the other local server first.'), { code: 'DATABASE_LOCKED', cause: error });
      }
      throw error;
    }
  }
  try {
  if (databaseUrl) {
    const { Pool } = require('pg');
    client = new Pool({ connectionString: databaseUrl, max: 10, connectionTimeoutMillis: 5000, statement_timeout: 5000, ...(readOnly ? { options: '-c default_transaction_read_only=on' } : {}) });
    client.on('error', () => console.error('Database connection unavailable.'));
  } else {
    const { PGlite } = require('@electric-sql/pglite');
    client = new PGlite(dataDir ? path.join(dataDir, 'postgres') : undefined);
  }
  const query = (sql, params = []) => client.query(sql, params);
  if (readOnly) {
    if (!databaseUrl) await client.query('SET default_transaction_read_only = on');
  } else {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    if (databaseUrl) await client.query(schema);
    else await client.exec(schema);
  }
  return {
    query,
    kind: databaseUrl ? 'postgresql' : 'embedded-postgresql',
    async cleanup() {
      await query('DELETE FROM sessions WHERE expires_at <= NOW()');
      await query("DELETE FROM ticket_messages WHERE created_at < NOW() - INTERVAL '30 minutes'");
      await query("UPDATE tickets SET context = NULL WHERE context IS NOT NULL AND created_at < NOW() - INTERVAL '30 minutes'");
      await query("UPDATE users SET verify_hash = NULL, verify_expires = NULL WHERE verify_expires <= NOW()");
      await query("UPDATE users SET reset_hash = NULL, reset_expires = NULL WHERE reset_expires <= NOW()");
    },
    async close() {
      if (databaseUrl) await client.end();
      else await client.close();
      if (releaseLock) await releaseLock();
    },
  };
  } catch (error) {
    if (client) await (databaseUrl ? client.end() : client.close()).catch(() => {});
    if (releaseLock) await releaseLock();
    throw error;
  }
}

module.exports = { createDatabase };