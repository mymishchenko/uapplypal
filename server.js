const path = require('node:path');
const { parseArgs } = require('node:util');

// Optional .env file next to server.js (HOST, PORT etc.). Not committed.
try {
  process.loadEnvFile(path.join(__dirname, '.env'));
} catch {
  // no .env file
}

const { createApp } = require('./app');

// Hosting Ukraine assigns each Node.js site a local 127.x.x.x address and
// proxies HTTP traffic to it. Pass it as launch parameters in adm.tools:
//   node server.js --host 127.x.x.x --port 3000
// (HOST / PORT environment variables also work.)
const { values: args } = parseArgs({
  options: { host: { type: 'string' }, port: { type: 'string' } },
  strict: false,
});
const host = args.host || process.env.HOST || '127.0.0.1';
const port = Number(args.port || process.env.PORT) || 3000;

const app = createApp();
app.listen(port, host, () => {
  console.log(`UApplyPal listening on http://${host}:${port}`);
  // The tracking agent: hourly checks for deadline alerts and the Monday summary.
  app.locals.notifier.start();
});
