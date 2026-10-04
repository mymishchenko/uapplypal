// Email agent status, previews and a test send. The site is public, so the
// test send is rate-limited and the recipient address is masked.
const express = require('express');
const { THRESHOLDS } = require('./emails');

const TESTS_PER_DAY = 5;

function mask(email) {
  const [name, domain] = String(email).split('@');
  return domain ? `${name.slice(0, 2)}***@${domain}` : '***';
}

function createNotifyRouter({ store, notifier, mailer }) {
  const router = express.Router();
  let testDay = null;
  let testCount = 0;

  router.get('/notifications', (req, res) => {
    const pending = mailer ? notifier.pendingAlerts() : [];
    res.json({
      configured: !!mailer,
      to: mailer ? mask(mailer.to) : null,
      schedule: { timeZone: 'Europe/Kyiv', sendHour: 8, thresholds: THRESHOLDS, weekly: 'Mondays' },
      pending: pending.map((p) => ({ title: p.title, date: p.date, days: p.days, verified: p.verified, overdue: p.overdue })),
      log: store.get().notifications.log,
    });
  });

  router.get('/notifications/preview/:kind', (req, res) => {
    if (!['weekly', 'alerts'].includes(req.params.kind)) return res.status(404).send('Not found');
    const html = notifier.preview(req.params.kind);
    res.type('html').send(html || '<p style="font-family:Arial;padding:16px">No deadline alerts are due right now.</p>');
  });

  router.post('/notifications/test', async (req, res) => {
    if (!mailer) return res.status(503).json({ error: 'Email is not configured yet: add GMAIL_USER and GMAIL_APP_PASSWORD (see docs/DEPLOY.md).' });
    const today = new Date().toISOString().slice(0, 10);
    if (today !== testDay) {
      testDay = today;
      testCount = 0;
    }
    if (testCount >= TESTS_PER_DAY) return res.status(429).json({ error: 'Test email limit reached for today.' });
    testCount++;
    const ok = await notifier.sendTest();
    res.status(ok ? 200 : 502).json({ ok, log: store.get().notifications.log });
  });

  return router;
}

module.exports = { createNotifyRouter, mask };
