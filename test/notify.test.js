const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { createApp } = require('../app');
const { loadRaw, buildCatalog } = require('../src/catalog');
const { buildView } = require('../src/logic/views');
const { Store } = require('../src/store');
const { dueAlerts, thresholdFor, weeklyEmail, alertEmail } = require('../src/notify/emails');
const { createNotifier, localParts } = require('../src/notify/scheduler');
const { mailConfig } = require('../src/notify/mailer');
const { mask } = require('../src/notify/routes');

const raw = loadRaw(path.join(__dirname, '..', 'data'));

function setup(today, mutate = () => {}) {
  const store = new Store(null, raw.studentSeed);
  store.update(mutate);
  const getContext = () => ({ today, store, view: buildView(buildCatalog(raw, store.get().overrides), store.get(), today) });
  return { store, getContext };
}

function fakeMailer({ fail = false } = {}) {
  const sent = [];
  return { to: 'my.example@gmail.com', sent, send: async (m) => (fail ? Promise.reject(new Error('SMTP down')) : sent.push(m)) };
}

test('thresholds pick the nearest alert point at or above the days left', () => {
  assert.strictEqual(thresholdFor(33), null);
  assert.strictEqual(thresholdFor(30), 30);
  assert.strictEqual(thresholdFor(29), 30);
  assert.strictEqual(thresholdFor(8), 14);
  assert.strictEqual(thresholdFor(7), 7);
  assert.strictEqual(thresholdFor(0), 1);
  assert.strictEqual(thresholdFor(-1), null);
});

test('IE Round 1 alerts at 30 days, once per threshold', () => {
  const { store, getContext } = setup('2026-10-07'); // 30 days before 6 Nov
  const { view, today } = getContext();
  const alerts = dueAlerts(view, store.get().notifications.sent, today);
  const ie = alerts.find((a) => a.key === 'ie-bba-2027.d.r1:30');
  assert.ok(ie, 'IE Round 1 30-day alert');
  assert.strictEqual(ie.verified, false);
  assert.ok(!dueAlerts(view, { [ie.key]: 'x' }, today).some((a) => a.key === ie.key));
});

test('submitted applications and passed early rounds with later rounds do not alert', () => {
  const { getContext } = setup('2026-10-07', (st) => {
    st.applications['ie-bba-2027'] = { status: 'submitted' };
  });
  const { view, today } = getContext();
  const alerts = dueAlerts(view, {}, today);
  assert.ok(!alerts.some((a) => a.key.startsWith('ie-bba-2027.d.r1')));
  // Bocconi early session closed 29 Sep but the winter session is still ahead.
  assert.ok(!alerts.some((a) => a.key.startsWith('bocconi-business-2027.d.early-close')));
});

test('a missed final deadline is reported once for unsubmitted applications', () => {
  const { getContext } = setup('2027-01-20'); // RSM Studielink closed 15 Jan; OLAF (31 Jan) is a document deadline
  const { view, today } = getContext();
  const alerts = dueAlerts(view, {}, today);
  assert.ok(alerts.some((a) => a.key === 'rsm-iba-2027.d.studielink:overdue' && a.overdue));
});

test('exam dates entered by the student are included', () => {
  const { getContext } = setup('2026-10-07', (st) => {
    st.exams.SAT = { status: 'registered', test_date: '2026-10-10' };
  });
  const { view, today } = getContext();
  assert.ok(dueAlerts(view, {}, today).some((a) => a.key === 'exam:SAT:test_date:2026-10-10:3'));
});

test('emails render with escaped content and links to the site', () => {
  const { getContext } = setup('2026-10-07');
  const { view, today } = getContext();
  const weekly = weeklyEmail(view, today, 'https://uapplypal.com/');
  assert.match(weekly.subject, /weekly summary/i);
  assert.match(weekly.html, /Progress by application/);
  assert.match(weekly.html, /https:\/\/uapplypal\.com\/#\/app\//);
  const alert = alertEmail([{ title: '<b>X</b>', detail: 'd', date: '2026-11-06', days: 30, verified: false, overdue: false, link: '#/' }], 'https://uapplypal.com/');
  assert.ok(!alert.html.includes('<b>X</b>'));
  assert.match(alert.subject, /in 30 days/);
});

test('scheduler: nothing before 08:00 Kyiv; alerts and Monday summary once; failures retried', async () => {
  // Monday 12 Oct 2026: IE Round 1 is 25 days away (inside the 30-day alert).
  let now = new Date('2026-10-12T04:30:00Z'); // 07:30 Kyiv
  const { store, getContext } = setup('2026-10-12');
  const mailer = fakeMailer();
  const notifier = createNotifier({ store, getContext, mailer, clock: () => now });
  assert.deepStrictEqual(await notifier.runOnce(), []);
  now = new Date('2026-10-12T06:00:00Z'); // 09:00 Kyiv
  assert.deepStrictEqual(await notifier.runOnce(), ['alerts', 'weekly']);
  assert.strictEqual(mailer.sent.length, 2);
  assert.deepStrictEqual(await notifier.runOnce(), []); // nothing new an hour later
  assert.strictEqual(store.get().notifications.log.length, 2);

  const failing = setup('2026-10-12');
  const bad = createNotifier({ store: failing.store, getContext: failing.getContext, mailer: fakeMailer({ fail: true }), clock: () => now });
  await bad.runOnce();
  assert.deepStrictEqual(failing.store.get().notifications.sent, {});
  assert.strictEqual(failing.store.get().notifications.log[0].ok, false);
});

test('local time parts use the Kyiv time zone', () => {
  assert.deepStrictEqual(localParts(new Date('2026-10-11T22:30:00Z'), 'Europe/Kyiv'), { date: '2026-10-12', hour: 1, weekday: 'Mon' });
});

test('mail config needs both Gmail settings; recipient defaults to the sender', () => {
  assert.strictEqual(mailConfig({ GMAIL_USER: 'a@gmail.com' }), null);
  assert.deepStrictEqual(mailConfig({ GMAIL_USER: 'a@gmail.com', GMAIL_APP_PASSWORD: 'abcd efgh ijkl mnop' }), { user: 'a@gmail.com', pass: 'abcdefghijklmnop', to: 'a@gmail.com' });
  assert.strictEqual(mask('my.mishchenko@gmail.com'), 'my***@gmail.com');
});

test('notification API: status, preview and test send', async () => {
  const mailer = fakeMailer();
  const server = createApp({ storeFile: null, today: () => '2026-10-07', mailer }).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const status = await (await fetch(`${base}/api/notifications`)).json();
    assert.strictEqual(status.configured, true);
    assert.strictEqual(status.to, 'my***@gmail.com');
    assert.ok(status.pending.length > 0);
    const preview = await fetch(`${base}/api/notifications/preview/weekly`);
    assert.match(await preview.text(), /Weekly summary/);
    const r = await fetch(`${base}/api/notifications/test`, { method: 'POST' });
    assert.strictEqual(r.status, 200);
    assert.match(mailer.sent[0].subject, /^\[Test\]/);
  } finally {
    server.close();
  }
  const unconfigured = createApp({ storeFile: null, mailer: null }).listen(0);
  try {
    const r = await fetch(`http://127.0.0.1:${unconfigured.address().port}/api/notifications/test`, { method: 'POST' });
    assert.strictEqual(r.status, 503);
  } finally {
    unconfigured.close();
  }
});
