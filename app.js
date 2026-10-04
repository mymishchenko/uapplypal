const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { loadRaw } = require('./src/catalog');
const { Store } = require('./src/store');
const { createApi } = require('./src/api');

// The deploy workflow writes the deployed commit SHA to VERSION.
function readVersion() {
  try {
    return fs.readFileSync(path.join(__dirname, 'VERSION'), 'utf8').trim();
  } catch {
    return 'dev';
  }
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// HTTP Basic auth with a single password (any username). Personal data lives
// behind this, so with no password configured the app refuses to serve it
// unless ALLOW_NO_AUTH=1 (local development only).
function authMiddleware({ password, allowNoAuth }) {
  return (req, res, next) => {
    if (!password) {
      if (allowNoAuth) return next();
      return res.status(503).send('UApplyPal is locked: set APP_PASSWORD on the server (see docs/DEPLOY.md).');
    }
    const header = req.headers.authorization || '';
    const [scheme, encoded] = header.split(' ');
    if (scheme === 'Basic' && encoded) {
      const decoded = Buffer.from(encoded, 'base64').toString('utf8');
      const supplied = decoded.slice(decoded.indexOf(':') + 1);
      if (safeEqual(supplied, password)) return next();
    }
    res.set('WWW-Authenticate', 'Basic realm="UApplyPal", charset="UTF-8"');
    return res.status(401).send('Authentication required');
  };
}

function createApp(options = {}) {
  const {
    dataDir = path.join(__dirname, 'data'),
    storeFile = process.env.STORE_FILE || path.join(__dirname, 'data', 'runtime', 'store.json'),
    password = process.env.APP_PASSWORD,
    allowNoAuth = process.env.ALLOW_NO_AUTH === '1',
    today,
    clientDir = path.join(__dirname, 'client', 'dist'),
  } = options;

  const raw = loadRaw(dataDir);
  const store = new Store(storeFile, raw.studentSeed);
  const version = process.env.APP_VERSION || readVersion();

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', version });
  });

  app.use(authMiddleware({ password, allowNoAuth }));
  app.use('/api', createApi({ raw, store, ...(today && { today }) }));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  if (fs.existsSync(clientDir)) {
    app.use(express.static(clientDir, { index: false }));
    app.get(/.*/, (req, res) => res.sendFile(path.join(clientDir, 'index.html')));
  } else {
    app.get('/', (req, res) => res.send('Client not built. Run "npm run build" (or "npm run dev" for development).'));
  }

  return app;
}

module.exports = { createApp };
