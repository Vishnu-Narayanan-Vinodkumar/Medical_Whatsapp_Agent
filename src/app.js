const express = require('express');
const helmet = require('helmet');
const path = require('node:path');
const { rateLimit } = require('express-rate-limit');
const { createSecurity } = require('./security');
const { installAuth } = require('./auth');
const { installPaymentWebhook, paymentMode } = require('./bookings');

function createApp({ database, config, mailer, installFeatures } = {}) {
  const app = express();
  const security = createSecurity(config.encryptionKey);
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: { directives: { 'script-src': ["'self'"], 'style-src': ["'self'"], 'img-src': ["'self'", 'data:'], 'upgrade-insecure-requests': config.production ? [] : null } }, strictTransportSecurity: config.production ? undefined : false }));
  app.use((req, res, next) => { res.set('Permissions-Policy', 'geolocation=(self)'); next(); });
  installPaymentWebhook(app, { database, config });
  app.use(express.json({ limit: '16kb' }));
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const expectedOrigin = config.origin || `${req.protocol}://${req.get('host')}`;
      if (req.headers['x-diagnobot'] !== '1' || !req.is('application/json') ||
          (req.headers.origin && req.headers.origin !== expectedOrigin) || req.headers['sec-fetch-site'] === 'cross-site') {
        return res.status(403).json({ error: 'Request origin check failed.' });
      }
      if (!req.body || Array.isArray(req.body)) return res.status(400).json({ error: 'Expected a JSON object.' });
    }
    next();
  });
  app.use('/api', rateLimit({ windowMs: 60000, limit: 150, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many requests. Please try again shortly.' } }));
  app.get('/health', async (req, res) => {
    await database.query('SELECT 1');
    res.json({ status: 'ok', database: database.kind, data_mode: config.demo ? 'sample' : 'live' });
  });
  app.get('/api/config', (req, res) => res.json({ demo: config.demo, groq_configured: Boolean(config.groqKey), support_phone: config.supportPhone, beta_enabled: config.betaEnabled !== false, web_enabled: Boolean(config.webSources?.length), payment_mode: paymentMode(config) }));
  const auth = installAuth(app, { database, security, config, mailer });
  app.get(['/admin', '/admin/dashboard'], (req, res) => res.redirect('/bot-metrics-dashboard.html'));
  if (installFeatures) installFeatures(app, { database, security, config, auth });
  const root = path.join(__dirname, '..');
  app.use('/assets', express.static(path.join(root, 'public'), { index: false, dotfiles: 'deny' }));
  app.get('/assets/lucide.js', (req, res) => res.sendFile(path.join(root, 'node_modules/lucide/dist/umd/lucide.min.js')));
  app.use('/assets/fonts', express.static(path.join(root, 'node_modules/@fontsource/manrope/files'), { index: false }));
  app.get(['/admin', '/admin/dashboard', '/bot-metrics-dashboard.html'], (req, res) => res.sendFile(path.join(root, 'bot-metrics-dashboard.html')));
  app.get(['/', '/login', '/register', '/chat'], (req, res) => res.sendFile(path.join(root, 'public/index.html')));
  app.use((req, res) => res.status(404).json({ error: 'Not found.' }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.type === 'entity.too.large' ? 413 : error.type === 'entity.parse.failed' ? 400 : 503;
    res.status(status).json({ error: status === 400 ? 'Invalid JSON.' : status === 413 ? 'Request is too large.' : 'The service is temporarily unavailable. Please try again.' });
  });
  return app;
}

module.exports = { createApp };