const bcrypt = require('bcryptjs');
const { randomUUID } = require('node:crypto');
const { rateLimit } = require('express-rate-limit');
const { token, validEmail, validPassword } = require('./security');

function installAuth(app, { database, security, config, mailer }) {
  const dummyHash = bcrypt.hashSync(token(), 12);
  const cookieOptions = { httpOnly: true, sameSite: 'strict', secure: config.production, path: '/' };
  const loginLimiter = rateLimit({ windowMs: 5 * 60 * 1000, limit: 3, skipSuccessfulRequests: true, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many attempts. Try again in five minutes.' } });
  app.use('/api/auth', rateLimit({ windowMs: 5 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many requests. Try again in five minutes.' } }));
  const emailHash = email => security.hash(email.trim().toLowerCase());
  const publicUser = user => ({ id: user.id, full_name: security.open(user.profile).full_name, role: user.role, verified: user.verified });
  const audit = (userId, action, success = true) => database.query('INSERT INTO audit_logs (user_id,action,success) VALUES ($1,$2,$3)', [userId, action, success]);

  async function sendToken(email, value, kind) {
    const url = `${config.origin}/#${kind}=${value}`;
    await mailer.sendMail({ from: config.mailFrom, to: email, subject: kind === 'verify' ? 'Verify your DiagnoBot account' : 'Reset your DiagnoBot password', text: `Open this link within 15 minutes: ${url}\nIgnore this email if you did not request it.` });
  }

  async function startSession(user, res) {
    const sessionToken = token();
    const csrf = token();
    const expires = new Date(Date.now() + config.sessionMs);
    await database.query(`INSERT INTO sessions (token_hash,user_id,csrf,context,expires_at) VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (user_id) DO UPDATE SET token_hash=EXCLUDED.token_hash,csrf=EXCLUDED.csrf,context=EXCLUDED.context,expires_at=EXCLUDED.expires_at,created_at=NOW()`,
    [security.hash(sessionToken), user.id, csrf, security.seal({ turns: [] }), expires]);
    await audit(user.id, 'login');
    res.cookie('session', sessionToken, { ...cookieOptions, maxAge: config.sessionMs });
    return res.json({ user: publicUser(user), csrf, expires_at: expires });
  }

  async function authenticate(req, res, next) {
    const sessionToken = req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith('session='))?.slice(8);
    if (!/^[a-f0-9]{64}$/.test(sessionToken || '')) return res.status(401).json({ error: 'Please sign in to continue.' });
    const hash = security.hash(sessionToken);
    const result = await database.query(`SELECT users.id,users.profile,users.role,users.verified,sessions.csrf,sessions.context,sessions.expires_at
      FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=$1 AND expires_at>NOW()`, [hash]);
    if (!result.rows.length) {
      res.clearCookie('session', cookieOptions);
      return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    }
    req.user = result.rows[0];
    req.profile = security.open(req.user.profile);
    req.context = security.open(req.user.context);
    req.sessionHash = hash;
    if (!['GET', 'HEAD'].includes(req.method) && req.headers['x-csrf-token'] !== req.user.csrf) return res.status(403).json({ error: 'Session check failed. Reload the page.' });
    next();
  }

  async function refresh(req, res, context = req.context) {
    const expires = new Date(Date.now() + config.sessionMs);
    await database.query('UPDATE sessions SET expires_at=$1,context=$2 WHERE token_hash=$3 AND expires_at>NOW()', [expires, security.seal(context), req.sessionHash]);
    const sessionToken = req.headers.cookie.split(';').map(part => part.trim()).find(part => part.startsWith('session=')).slice(8);
    res.cookie('session', sessionToken, { ...cookieOptions, maxAge: config.sessionMs });
    return expires;
  }

  function adminOnly(req, res, next) {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Operator access required.' });
    next();
  }

  app.post('/api/auth/register', async (req, res) => {
    const { email, password, full_name } = req.body;
    if (!validEmail(email) || !validPassword(password) || typeof full_name !== 'string' || full_name.trim().length < 2 || full_name.trim().length > 50 || req.body.consent !== true) {
      return res.status(400).json({ error: 'Enter a name, valid email, consent, and a 12+ character password with uppercase, lowercase, number and symbol (maximum 72 bytes).' });
    }
    const verification = token();
    const result = await database.query(`INSERT INTO users (id,email_hash,profile,password_hash,verified,verify_hash,verify_expires)
      VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (email_hash) DO NOTHING RETURNING id`,
    [randomUUID(), emailHash(email), security.seal({ email: email.trim().toLowerCase(), full_name: full_name.trim() }), await bcrypt.hash(password, 12), config.demo, config.demo ? null : security.hash(verification), config.demo ? null : new Date(Date.now() + 15 * 60 * 1000)]);
    if (result.rows.length) {
      await audit(result.rows[0].id, 'register');
      if (!config.demo) await sendToken(email.trim().toLowerCase(), verification, 'verify');
    }
    res.status(201).json({ requires_email_verification: !config.demo, message: config.demo ? 'You can now sign in. Email verification is disabled in this local sample environment.' : 'Check your inbox to verify your account. Existing accounts can sign in or reset their password.' });
  });

  app.post('/api/auth/login', loginLimiter, async (req, res) => {
    const { email, password } = req.body;
    if (!validEmail(email) || typeof password !== 'string' || Buffer.byteLength(password) > 72) return res.status(401).json({ error: 'Invalid email or password.' });
    const user = (await database.query('SELECT * FROM users WHERE email_hash=$1', [emailHash(email)])).rows[0];
    const matches = await bcrypt.compare(password, user?.password_hash || dummyHash);
    if (!user || !matches) {
      await audit(user?.id || null, 'login', false);
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    if (!user.verified) return res.status(403).json({ error: 'Verify your email before signing in.' });
    return startSession(user, res);
  });

  app.post('/api/auth/verify', async (req, res) => {
    if (!/^[a-f0-9]{64}$/.test(req.body.token || '')) return res.status(400).json({ error: 'Invalid or expired verification link.' });
    const result = await database.query('UPDATE users SET verified=TRUE,verify_hash=NULL,verify_expires=NULL WHERE verify_hash=$1 AND verify_expires>NOW() RETURNING id', [security.hash(req.body.token)]);
    if (!result.rows.length) return res.status(400).json({ error: 'Invalid or expired verification link.' });
    await audit(result.rows[0].id, 'email_verified');
    res.json({ message: 'Email verified. You can now sign in.' });
  });

  app.post('/api/auth/recover', async (req, res) => {
    if (!validEmail(req.body.email) || !['verify', 'reset'].includes(req.body.kind)) return res.status(400).json({ error: 'Enter a valid email and recovery action.' });
    if (config.demo) return res.status(409).json({ error: 'Email delivery is unavailable in local sample mode. Use a demo account or create another sample account.' });
    const user = (await database.query('SELECT * FROM users WHERE email_hash=$1', [emailHash(req.body.email)])).rows[0];
    if (user && (req.body.kind === 'reset' || !user.verified)) {
      const value = token();
      const fields = req.body.kind === 'reset' ? ['reset_hash', 'reset_expires'] : ['verify_hash', 'verify_expires'];
      await database.query(`UPDATE users SET ${fields[0]}=$1,${fields[1]}=$2 WHERE id=$3`, [security.hash(value), new Date(Date.now() + 15 * 60 * 1000), user.id]);
      try { await sendToken(security.open(user.profile).email, value, req.body.kind); }
      catch { await audit(user.id, 'email_delivery', false); }
    }
    res.json({ message: 'If the account is eligible, a link has been sent to its email address.' });
  });

  app.post('/api/auth/reset', async (req, res) => {
    if (!validPassword(req.body.password) || !/^[a-f0-9]{64}$/.test(req.body.token || '')) return res.status(400).json({ error: 'Use a valid reset link and a strong 12+ character password.' });
    const result = await database.query(`WITH changed AS (
      UPDATE users SET password_hash=$1,reset_hash=NULL,reset_expires=NULL WHERE reset_hash=$2 AND reset_expires>NOW() RETURNING id
      ), removed AS (DELETE FROM sessions WHERE user_id IN (SELECT id FROM changed)) SELECT id FROM changed`, [await bcrypt.hash(req.body.password, 12), security.hash(req.body.token)]);
    if (!result.rows.length) return res.status(400).json({ error: 'Invalid or expired reset link.' });
    await audit(result.rows[0].id, 'password_reset');
    res.json({ message: 'Password changed. Sign in again.' });
  });

  app.post('/api/auth/demo/:role', async (req, res) => {
    if (!config.demo || !['patient', 'admin'].includes(req.params.role)) return res.sendStatus(404);
    const role = req.params.role;
    const email = `${role}@demo.invalid`;
    const profile = { email, full_name: role === 'admin' ? 'Demo Operator' : 'Demo Patient' };
    await database.query(`INSERT INTO users (id,email_hash,profile,password_hash,role,verified) VALUES ($1,$2,$3,$4,$5,TRUE) ON CONFLICT (email_hash) DO NOTHING`,
      [randomUUID(), emailHash(email), security.seal(profile), dummyHash, role]);
    const user = (await database.query('SELECT * FROM users WHERE email_hash=$1', [emailHash(email)])).rows[0];
    return startSession(user, res);
  });

  app.get('/api/auth/me', authenticate, (req, res) => res.json({ user: publicUser(req.user), csrf: req.user.csrf, expires_at: req.user.expires_at }));
  app.post('/api/auth/session', authenticate, async (req, res) => res.json({ expires_at: await refresh(req, res) }));
  app.post('/api/auth/logout', authenticate, async (req, res) => {
    await database.query('DELETE FROM sessions WHERE token_hash=$1', [req.sessionHash]);
    await audit(req.user.id, 'logout');
    res.clearCookie('session', cookieOptions).json({ message: 'Signed out.' });
  });
  return { authenticate, adminOnly, refresh, audit };
}

module.exports = { installAuth };