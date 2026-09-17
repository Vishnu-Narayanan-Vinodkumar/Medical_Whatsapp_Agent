const { loadConfig } = require('./src/config');
const { createDatabase } = require('./src/database');
const { createApp } = require('./src/app');
const { createFeatures } = require('./src/features');

async function start() {
  const config = loadConfig();
  const database = await createDatabase(config);
  const mailer = config.smtpUrl ? require('nodemailer').createTransport(config.smtpUrl) : null;
  const app = createApp({ database, config, mailer, installFeatures: createFeatures() });
  await database.cleanup();
  let server;
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      server = await new Promise((resolve, reject) => {
        const listener = app.listen(config.port + attempt, config.host, () => resolve(listener));
        listener.once('error', reject);
      });
      break;
    } catch (error) {
      if (error.code !== 'EADDRINUSE' || config.origin || config.production || attempt === 9) {
        await database.close();
        throw new Error('Unable to listen on the configured address. Check PORT and HOST.', { cause: error });
      }
    }
  }
  const cleanup = setInterval(() => database.cleanup().catch(() => console.error('Scheduled cleanup failed.')), 60000);
  cleanup.unref();
  const address = `http://${config.host}:${server.address().port}`;
  console.log(`DiagnoBot: ${address}`);
  console.log(`Operator dashboard: ${address}/bot-metrics-dashboard.html`);
  console.log(`Data: ${config.demo ? 'LOCAL SAMPLE ONLY' : 'live'} | Storage: ${database.kind}`);
  if (!config.groqKey) console.log('Groq key missing: text classification will offer support.');
  const shutdown = () => {
    clearInterval(cleanup);
    server.close(() => database.close().then(() => process.exit(0)));
    server.closeIdleConnections();
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  return { app, server, database };
}

if (require.main === module) start().catch(error => { console.error(error.message.startsWith('Production requires') || error.message.startsWith('Live mode requires') || error.message.startsWith('Unable to listen') ? error.message : 'Startup failed. Check configuration and database availability.'); process.exitCode = 1; });

module.exports = { start };