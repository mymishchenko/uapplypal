// The tracking agent: checks every hour and emails deadline alerts and a
// Monday weekly summary. Each alert key is sent once (recorded in the store),
// so a missed hour or a restart never causes duplicates or skipped alerts.
const { dueAlerts, alertEmail, weeklyEmail } = require('./emails');

const HOUR = 3600_000;
const LOG_LIMIT = 50;

function localParts(date, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short' })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), weekday: parts.weekday };
}

function createNotifier({ store, getContext, mailer, siteUrl = 'https://uapplypal.com/', clock = () => new Date(), timeZone = 'Europe/Kyiv', sendHour = 8 }) {
  let running = false;

  const record = (entry, keys = []) =>
    store.update((st) => {
      const n = st.notifications;
      for (const k of keys) n.sent[k] = entry.at;
      n.log = [entry, ...n.log].slice(0, LOG_LIMIT);
    });

  async function deliver(kind, email, keys) {
    const at = clock().toISOString();
    try {
      await mailer.send(email);
      record({ at, kind, subject: email.subject, ok: true }, keys);
      return true;
    } catch (err) {
      // Not marked as sent, so the next hourly check retries.
      record({ at, kind, subject: email.subject, ok: false, error: String(err.message || err).slice(0, 300) });
      return false;
    }
  }

  // One check. Returns what was sent (for tests and logs).
  async function runOnce() {
    if (!mailer || running) return [];
    running = true;
    try {
      const local = localParts(clock(), timeZone);
      if (local.hour < sendHour) return [];
      const { view, today } = getContext();
      const { sent } = store.get().notifications;
      const done = [];

      const alerts = dueAlerts(view, sent, today);
      if (alerts.length && (await deliver('alerts', alertEmail(alerts, siteUrl), alerts.map((a) => a.key)))) done.push('alerts');

      const weeklyKey = `weekly:${local.date}`;
      if (local.weekday === 'Mon' && !sent[weeklyKey] && (await deliver('weekly', weeklyEmail(view, today, siteUrl), [weeklyKey]))) done.push('weekly');
      return done;
    } finally {
      running = false;
    }
  }

  function start() {
    if (!mailer) return;
    const tick = () => runOnce().catch((err) => console.error('notifier error', err));
    setTimeout(tick, 60_000).unref();
    setInterval(tick, HOUR).unref();
  }

  // Sends the weekly summary now, without marking anything as sent.
  async function sendTest() {
    const { view, today } = getContext();
    const email = weeklyEmail(view, today, siteUrl);
    return deliver('test', { ...email, subject: `[Test] ${email.subject}` }, []);
  }

  function preview(kind) {
    const { view, today } = getContext();
    if (kind === 'weekly') return weeklyEmail(view, today, siteUrl).html;
    const alerts = dueAlerts(view, store.get().notifications.sent, today);
    return alerts.length ? alertEmail(alerts, siteUrl).html : null;
  }

  return { runOnce, start, sendTest, preview, pendingAlerts: () => dueAlerts(getContext().view, store.get().notifications.sent, getContext().today) };
}

module.exports = { createNotifier, localParts };
