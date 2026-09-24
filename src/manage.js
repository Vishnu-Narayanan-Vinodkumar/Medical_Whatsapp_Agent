const { loadConfig } = require('./config');
const { createDatabase } = require('./database');
const { createSecurity, validEmail } = require('./security');
const { createClassifier } = require('./classifier');
const fs = require('node:fs');
const path = require('node:path');

const INSPECTION_VIEWS = {
  users: 'id,role,verified,verify_expires,reset_expires,created_at',
  sessions: 'user_id,created_at,expires_at',
  bookings: 'id,user_id,centre_name,product_name,starts_at,amount,currency,status,payment_mode,payment_status,created_at',
  audit_logs: 'id,user_id,action,intent,success,reason,response_ms,groq_ms,groq_called,created_at',
  tickets: 'id,user_id,reason,status,assigned_to,created_at,updated_at',
  ticket_messages: 'id,ticket_id,author,created_at',
};

function loadInspectSecurity(dataDir) {
  const envKey = process.env.ENCRYPTION_KEY;
  if (/^[a-f0-9]{64}$/i.test(envKey || '')) return createSecurity(envKey);
  const keyPath = path.join(dataDir, 'local.key');
  if (fs.existsSync(keyPath)) {
    const key = fs.readFileSync(keyPath, 'utf8').trim();
    if (/^[a-f0-9]{64}$/i.test(key)) return createSecurity(key);
  }
  return null;
}

async function inspectDatabase(database, table, security) {
  if (table && !Object.hasOwn(INSPECTION_VIEWS, table)) throw new Error(`Inspect: choose one of ${Object.keys(INSPECTION_VIEWS).join(', ')}.`);
  const available = (await database.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name")).rows.map(row => row.table_name).filter(name => Object.hasOwn(INSPECTION_VIEWS, name));
  if (table) {
    if (!available.includes(table)) throw new Error('Inspect: this table is not initialized. Start the updated app once, then stop it before inspecting.');
    if (table === 'users' && security) {
      const rows = (await database.query(`SELECT ${INSPECTION_VIEWS[table]},profile FROM users ORDER BY created_at DESC LIMIT 25`)).rows;
      return rows.map(row => {
        let name = null;
        try { name = security.open(row.profile)?.full_name || null; } catch { name = null; }
        return { id: row.id, name, role: row.role, verified: row.verified, verify_expires: row.verify_expires, reset_expires: row.reset_expires, created_at: row.created_at };
      });
    }
    return (await database.query(`SELECT ${INSPECTION_VIEWS[table]} FROM ${table} ORDER BY created_at DESC LIMIT 25`)).rows;
  }
  const result = [];
  for (const name of available) result.push({ table: name, rows: (await database.query(`SELECT COUNT(*)::int AS count FROM ${name}`)).rows[0].count });
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const [command, email, patientId, dobHash] = args.filter(value => value !== '--preview');
  if (command === 'db:inspect') {
    const preview = args.includes('--preview');
    const databaseUrl = preview ? '' : process.env.DATABASE_URL || '';
    const dataDir = preview ? path.join(__dirname, '..', '.data', 'beta-preview') : path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', '.data'));
    if (email && !Object.hasOwn(INSPECTION_VIEWS, email)) throw new Error(`Inspect: choose one of ${Object.keys(INSPECTION_VIEWS).join(', ')}.`);
    if (!databaseUrl && !fs.existsSync(path.join(dataDir, 'postgres', 'PG_VERSION'))) throw new Error('Inspect: no embedded database exists at this location. Use --preview for the beta preview or check DATA_DIR.');
    const security = loadInspectSecurity(dataDir);
    const database = await createDatabase({ databaseUrl, dataDir, readOnly: true });
    try {
      console.log(databaseUrl ? 'Read-only inspection: configured external PostgreSQL.' : `Read-only inspection: ${path.join(dataDir, 'postgres')}`);
      console.table(await inspectDatabase(database, email, security));
      console.log('Newest 25 rows per selected table. Amounts are in minor currency units (20000 INR paise = INR 200). Name is decrypted for the users table on local inspection only; password, email, token and message-content fields remain excluded (irreversibly hashed or out of scope for this tool).');
    } finally { await database.close(); }
    return;
  }
  const config = loadConfig();
  if (command === 'check-groq') {
    const result = await createClassifier({ apiKey: config.groqKey, model: config.groqModel })('When do you open on Sunday?');
    console.log(JSON.stringify({ model: config.groqModel, intent: result.intent, confidence: result.confidence, latency_ms: result.groq_ms, status: result.reason === 'groq_unavailable' ? 'unavailable' : 'ok' }));
    if (result.reason === 'groq_unavailable' || result.intent !== 'centre_info') process.exitCode = 1;
    return;
  }
  if (!['admin', 'link-patient'].includes(command) || !validEmail(email)) throw new Error('Use npm run admin -- email or npm run link-patient -- email patient-id [sha256-dob].');
  if (command === 'link-patient' && (!/^[A-Za-z0-9_-]{1,100}$/.test(patientId || '') || (dobHash && !/^[a-f0-9]{64}$/i.test(dobHash)))) throw new Error('Provide an approved patient ID and an optional SHA-256 DOB hash.');
  const database = await createDatabase(config);
  try {
    const security = createSecurity(config.encryptionKey);
    const user = (await database.query('SELECT * FROM users WHERE email_hash=$1', [security.hash(email.trim().toLowerCase())])).rows[0];
    if (!user || !user.verified) throw new Error('A registered, verified account is required.');
    if (command === 'admin') await database.query("UPDATE users SET role='admin' WHERE id=$1", [user.id]);
    else {
      const profile = security.open(user.profile);
      profile.patient_id = patientId;
      if (dobHash) profile.dob_hash = dobHash;
      await database.query('UPDATE users SET profile=$1 WHERE id=$2', [security.seal(profile), user.id]);
    }
    await database.query('DELETE FROM sessions WHERE user_id=$1', [user.id]);
    await database.query('INSERT INTO audit_logs (user_id,action) VALUES ($1,$2)', [user.id, command === 'admin' ? 'operator_access_granted' : 'patient_linked']);
    console.log('Account updated. Sign in again for the change to take effect.');
  } finally { await database.close(); }
}

if (require.main === module) main().catch(error => { console.error(error.message.startsWith('Use npm') || error.message.startsWith('Provide an approved') || error.message.startsWith('A registered') || error.message.startsWith('Inspect:') || error.message.startsWith('Embedded database is already open') ? error.message : 'Management command failed. Check configuration and stop the local server before opening embedded storage.'); process.exitCode = 1; });

module.exports = { inspectDatabase };