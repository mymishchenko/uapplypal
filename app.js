const fs = require('node:fs');
const path = require('node:path');
const express = require('express');

// The deploy workflow writes the deployed commit SHA to VERSION.
function readVersion() {
  try {
    return fs.readFileSync(path.join(__dirname, 'VERSION'), 'utf8').trim();
  } catch {
    return 'dev';
  }
}
const version = process.env.APP_VERSION || readVersion();

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version });
});

module.exports = app;
