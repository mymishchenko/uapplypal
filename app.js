const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { loadRaw } = require('./src/catalog');
const { Store } = require('./src/store');
const { createApi } = require('./src/api');
const { buildCatalog } = require('./src/catalog');
const { buildView } = require('./src/logic/views');
const { todayISO } = require('./src/logic/dates');
const { createAssistantRouter } = require('./src/assistant/routes');

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
    today = () => todayISO(),
    assistantClient,
    assistantLimits,
    clientDir = path.join(__dirname, 'client', 'dist'),
  } = options;

  const raw = loadRaw(dataDir);
  const store = new Store(storeFile, raw.studentSeed);
  const version = process.env.APP_VERSION || readVersion();

  const getContext = () => {
    const now = today();
    return { today: now, store, view: buildView(buildCatalog(raw, store.get().overrides), store.get(), now) };
  };

  const app = express();
  app.disable('x-powered-by');
  // Behind Hosting Ukraine's nginx proxy: take the client IP from the one hop it adds.
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', version });
  });

  app.use('/api', createApi({ raw, store, today }));
  app.use(
    '/api',
    createAssistantRouter({
      store,
      getContext,
      limits: assistantLimits,
      ...(assistantClient !== undefined && { client: assistantClient }),
    }),
  );
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
