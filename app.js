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

function createApp(options = {}) {
  const {
    dataDir = path.join(__dirname, 'data'),
    storeFile = process.env.STORE_FILE || path.join(__dirname, 'data', 'runtime', 'store.json'),
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
