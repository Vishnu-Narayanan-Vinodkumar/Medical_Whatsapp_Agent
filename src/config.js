const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

function loadConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const demo = env.DATA_MODE !== 'live';
  const dataDir = path.resolve(env.DATA_DIR || path.join(__dirname, '..', '.data'));
  const paymentMode = env.PAYMENT_MODE || (demo ? 'demo' : 'disabled');
  if (!['demo', 'stripe', 'disabled'].includes(paymentMode) || (!demo && paymentMode === 'demo')) throw new Error('Invalid PAYMENT_MODE for this data environment.');
  if (paymentMode === 'stripe' && (!/^sk_(test|live)_/.test(env.STRIPE_SECRET_KEY || '') || !env.STRIPE_WEBHOOK_SECRET || !env.APP_ORIGIN)) throw new Error('Stripe requires secret key, webhook secret and APP_ORIGIN.');
  if (demo && paymentMode === 'stripe' && !env.STRIPE_SECRET_KEY.startsWith('sk_test_')) throw new Error('Sample data cannot collect real payments.');
  const webSources = JSON.parse(env.WEB_SOURCES || (demo ? '["https://www.nhs.uk/tests-and-treatments/blood-tests/"]' : '[]'));
  if (!Array.isArray(webSources) || webSources.length > 3 || webSources.some(value => typeof value !== 'string' || value.length > 2048 || !value.startsWith('https://'))) throw new Error('WEB_SOURCES must be a JSON array of up to three approved HTTPS URLs.');
  let encryptionKey = env.ENCRYPTION_KEY;
  if (production && (demo || !env.DATABASE_URL || !env.APP_ORIGIN?.startsWith('https://') || !env.SMTP_URL)) {
    throw new Error('Production requires DATA_MODE=live, DATABASE_URL, HTTPS APP_ORIGIN and SMTP_URL.');
  }
  if (!/^[a-f0-9]{64}$/i.test(encryptionKey || '')) {
    if (!demo) throw new Error('Live mode requires ENCRYPTION_KEY with 64 hexadecimal characters.');
    fs.mkdirSync(dataDir, { recursive: true });
    const keyPath = path.join(dataDir, 'local.key');
    try { fs.writeFileSync(keyPath, crypto.randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    encryptionKey = fs.readFileSync(keyPath, 'utf8').trim();
  }
  if (!/^[a-f0-9]{64}$/i.test(encryptionKey)) throw new Error('Invalid local encryption key.');
  if (!demo && (!env.SMTP_URL || !env.APP_ORIGIN)) throw new Error('Live mode requires SMTP_URL and APP_ORIGIN for email verification.');
  return {
    production, demo, dataDir, encryptionKey,
    databaseUrl: env.DATABASE_URL || '',
    host: demo ? '127.0.0.1' : (env.HOST || '127.0.0.1'),
    port: Number(env.PORT) || 3000,
    origin: env.APP_ORIGIN || '',
    sessionMs: 30 * 60 * 1000,
    groqKey: env.GROQ_API_KEY || '',
    groqModel: env.GROQ_MODEL || 'openai/gpt-oss-20b',
    groqLiveApproved: env.GROQ_LIVE_APPROVED === 'true',
    betaEnabled: env.BETA_ASSISTANT !== 'false',
    webSources,
    paymentMode,
    stripeSecret: env.STRIPE_SECRET_KEY || '',
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET || '',
    catalogueFile: env.CATALOGUE_FILE || '',
    lisUrl: env.LIS_API_BASE_URL || '',
    lisKey: env.LIS_API_KEY || '',
    reportHosts: (env.REPORT_DOWNLOAD_HOSTS || '').split(',').map(value => value.trim()).filter(Boolean),
    smtpUrl: env.SMTP_URL || '',
    mailFrom: env.MAIL_FROM || 'DiagnoBot <noreply@localhost>',
    supportPhone: env.SUPPORT_PHONE || '',
  };
}

module.exports = { loadConfig };