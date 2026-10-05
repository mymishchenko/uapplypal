// Builds notification emails from the computed view (src/logic/views.js).
// Pure functions: they decide WHAT to send; scheduler.js decides WHEN.
const { daysBetween, formatDate } = require('../logic/dates');
const { CLOSING_TYPES } = require('../logic/windows');

// Alert when a deadline is this many days away (or fewer, if a day was missed).
const THRESHOLDS = [30, 14, 7, 3, 1];
const ALERT_TYPES = new Set([...CLOSING_TYPES, 'document_submission', 'entrance_exam', 'scholarship', 'financial_aid', 'test_registration', 'interview', 'enrollment', 'deposit', 'application_opens']);
const DONE = new Set(['submitted', 'offer', 'waitlisted', 'rejected', 'withdrawn', 'not_applying']);
const OVERDUE_WINDOW = 14; // report a missed deadline for up to 14 days

function thresholdFor(days) {
  if (days < 0) return null;
  // The smallest threshold that is >= days left; null if further away than the first alert.
  const t = THRESHOLDS.slice().reverse().find((x) => days <= x);
  return t ?? null;
}

function when(days) {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 0) return `${-days} day${days === -1 ? '' : 's'} ago`;
  return `in ${days} days`;
}

// Returns the alert items that are due and not yet sent: [{ key, ... }].
function dueAlerts(view, sent, today) {
  const items = [];
  const portfolio = view.applications.filter((a) => a.active);
  for (const a of portfolio) {
    for (const d of a.deadlines) {
      if (!d.date || !ALERT_TYPES.has(d.type)) continue;
      const days = d.days_left;
      const isClosing = CLOSING_TYPES.has(d.type);
      if (days < 0) {
        // Missed: only the last closing deadline of an application not yet
        // submitted (a passed early round is fine if a later round remains).
        if (!isClosing || DONE.has(a.application.status) || days < -OVERDUE_WINDOW) continue;
        if (a.next_deadline) continue;
        const key = `${d.fid}:overdue`;
        if (!sent[key]) items.push(item(key, a, d, days, true));
        continue;
      }
      if (isClosing && DONE.has(a.application.status)) continue;
      const t = thresholdFor(days);
      if (t == null) continue;
      const key = `${d.fid}:${t}`;
      if (!sent[key]) items.push(item(key, a, d, days, false));
    }
  }
  // Exam dates and registration deadlines the student entered.
  for (const [code, plan] of Object.entries(view.student ? examPlans(view) : {})) {
    for (const [field, label] of [['registration_deadline', 'registration deadline'], ['test_date', 'test day']]) {
      const date = plan[field];
      if (!date || (field === 'registration_deadline' && plan.status && plan.status !== 'not_registered')) continue;
      if (plan.status === 'taken') continue;
      const days = daysBetween(today, date);
      const t = thresholdFor(days);
      if (t == null) continue;
      const key = `exam:${code}:${field}:${date}:${t}`;
      if (!sent[key]) {
        items.push({ key, title: `${plan.name}: ${label}`, detail: plan.target ? `Target score ${plan.target}` : '', date, days, verified: true, overdue: false, link: '#/exams' });
      }
    }
  }
  return items.sort((x, y) => x.days - y.days);
}

function examPlans(view) {
  return Object.fromEntries(view.exam_plans.map((e) => [e.code, { ...e.plan, name: e.meta.name }]));
}

function item(key, a, d, days, overdue) {
  return {
    key,
    title: `${a.university.short_name}: ${d.label}`,
    detail: `${a.program.name} · ${a.progress.done}/${a.progress.total} requirements ready · status: ${a.application.status.replace(/_/g, ' ')}`,
    date: d.date,
    days,
    verified: d.status === 'VERIFIED',
    overdue,
    link: `#/app/${a.id}`,
  };
}

// ---- Rendering -----------------------------------------------------------

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function layout(title, bodyHtml, siteUrl) {
  return `<!doctype html><html><body style="margin:0;background:#f6f7f9;font-family:Arial,Helvetica,sans-serif;color:#1c2230">
<div style="max-width:640px;margin:0 auto;padding:20px">
<div style="margin-bottom:12px"><img src="${esc(siteUrl)}logo.png" alt="uApplyPal" width="170" style="display:block;width:170px;height:auto;border:0"></div>
<div style="background:#fff;border:1px solid #e3e6ec;border-radius:8px;padding:18px">
<h2 style="margin:0 0 12px;font-size:18px">${esc(title)}</h2>
${bodyHtml}
</div>
<p style="font-size:12px;color:#667085">Sent by your uApplyPal agent · <a href="${esc(siteUrl)}" style="color:#0a5ce0">Open uApplyPal</a> · Dates marked “not verified” must be checked on the official page.</p>
</div></body></html>`;
}

function row(i, siteUrl) {
  const color = i.overdue || i.days <= 3 ? '#b42318' : i.days <= 14 ? '#a15c00' : '#1c2230';
  return `<tr>
<td style="padding:8px 6px;border-bottom:1px solid #e3e6ec;white-space:nowrap;vertical-align:top;color:${color};font-weight:bold">${esc(formatDate(i.date))}<br><span style="font-weight:normal;font-size:12px">${esc(when(i.days))}</span></td>
<td style="padding:8px 6px;border-bottom:1px solid #e3e6ec;vertical-align:top"><a href="${esc(siteUrl + i.link)}" style="color:#0a5ce0;font-weight:bold;text-decoration:none">${esc(i.title)}</a>${i.verified ? '' : ' <span style="color:#a15c00;font-size:12px">(not verified)</span>'}<br><span style="font-size:12px;color:#667085">${esc(i.detail)}</span></td>
</tr>`;
}

function alertEmail(items, siteUrl) {
  const first = items[0];
  const subject =
    items.length === 1
      ? `${first.overdue ? 'Missed' : '⏰'} ${first.title} ${when(first.days)}`
      : `⏰ ${items.length} uApplyPal deadlines: next ${first.title} ${when(first.days)}`;
  const html = layout(
    items.some((i) => i.overdue) ? 'Deadlines need attention' : 'Upcoming deadlines',
    `<table style="width:100%;border-collapse:collapse">${items.map((i) => row(i, siteUrl)).join('')}</table>`,
    siteUrl,
  );
  const text = items.map((i) => `- ${formatDate(i.date)} (${when(i.days)}): ${i.title}${i.verified ? '' : ' [not verified]'}\n  ${i.detail}`).join('\n');
  return { subject, html, text: `Upcoming deadlines\n\n${text}\n\n${siteUrl}` };
}

function weeklyEmail(view, today, siteUrl) {
  const d = view.dashboard;
  const portfolio = view.applications.filter((a) => a.active);
  const upcoming = view.deadlines.filter((x) => x.date && x.days_left >= 0 && x.days_left <= 45);
  const section = (title, html) => `<h3 style="font-size:14px;margin:18px 0 6px;color:#0a2370">${esc(title)}</h3>${html}`;
  const list = (rows) => `<ul style="margin:0;padding-left:18px">${rows.join('')}</ul>`;

  const actions = d.actions.slice(0, 8).map(
    (a) =>
      `<li style="margin-bottom:6px"><a href="${esc(siteUrl + (a.app_id ? `#/app/${a.app_id}` : '#/exams'))}" style="color:#0a5ce0">${esc(a.title)}</a> · ${esc(formatDate(a.date))} (${esc(when(a.days_left))})${a.verified ? '' : ' <span style="color:#a15c00">not verified</span>'}<br><span style="font-size:12px;color:#667085">${esc(a.detail)}</span></li>`,
  );

  const progress = portfolio
    .slice()
    .sort((x, y) => (x.next_deadline ? x.next_deadline.date : '9999').localeCompare(y.next_deadline ? y.next_deadline.date : '9999'))
    .map((a) => {
      const pct = a.progress.total ? Math.round((100 * a.progress.done) / a.progress.total) : 0;
      return `<tr><td style="padding:5px 6px;border-bottom:1px solid #e3e6ec">${esc(a.university.short_name)}<br><span style="font-size:12px;color:#667085">${esc(a.program.name)}</span></td>
<td style="padding:5px 6px;border-bottom:1px solid #e3e6ec;font-size:12px">${esc(a.application.status.replace(/_/g, ' '))}</td>
<td style="padding:5px 6px;border-bottom:1px solid #e3e6ec;font-size:12px;white-space:nowrap">${a.progress.done}/${a.progress.total} (${pct}%)</td>
<td style="padding:5px 6px;border-bottom:1px solid #e3e6ec;font-size:12px;white-space:nowrap">${a.next_deadline ? esc(formatDate(a.next_deadline.date)) : '—'}</td></tr>`;
    });

  const exams = view.exam_plans
    .filter((e) => e.priority !== 'low' || e.plan.test_date)
    .map(
      (e) =>
        `<li>${esc(e.meta.name)}: ${e.plan.status ? esc(e.plan.status.replace(/_/g, ' ')) : 'not registered'}${e.plan.test_date ? `, test ${esc(formatDate(e.plan.test_date))}` : ''}${e.plan.score ? `, score ${esc(e.plan.score)}` : ''} <span style="font-size:12px;color:#667085">(${e.required_by.length + e.accepted_by.length} applications)</span></li>`,
    );

  const c = d.counts;
  const body = [
    `<p style="margin:0 0 6px">${c.applications} applications: ${c.not_started} not started, ${c.preparing} preparing, ${c.ready} ready, ${c.submitted} submitted.</p>`,
    d.next_deadline
      ? `<p style="margin:0">Next deadline: <b>${esc(d.next_deadline.university)}</b>, ${esc(d.next_deadline.label)} on <b>${esc(formatDate(d.next_deadline.date))}</b> (${esc(when(d.next_deadline.days_left))})${d.next_deadline.status === 'VERIFIED' ? '' : ' <span style="color:#a15c00">not verified</span>'}.</p>`
      : '',
    section('This week: what to do next', actions.length ? list(actions) : '<p>No dated actions in the next 6 months.</p>'),
    section(
      'Deadlines in the next 45 days',
      upcoming.length
        ? `<table style="width:100%;border-collapse:collapse">${upcoming
            .map((x) => row({ title: `${x.university}: ${x.label}`, detail: x.program, date: x.date, days: x.days_left, verified: x.status === 'VERIFIED', overdue: false, link: `#/app/${x.app_id}` }, siteUrl))
            .join('')}</table>`
        : '<p>None.</p>',
    ),
    section('Progress by application', `<table style="width:100%;border-collapse:collapse;font-size:13px">${progress.join('')}</table>`),
    exams.length ? section('Exams', list(exams)) : '',
    d.to_verify.length || d.missing_data.length
      ? section(
          'Data to check',
          `<p style="margin:0">${d.to_verify.length} upcoming dates are not verified yet; ${d.missing_data.length} programs have no 2027/28 deadline entered. <a href="${esc(siteUrl)}#/deadlines" style="color:#0a5ce0">Review</a></p>`,
        )
      : '',
  ].join('');

  const textActions = d.actions.slice(0, 8).map((a) => `- ${a.title}: ${formatDate(a.date)} (${when(a.days_left)})${a.verified ? '' : ' [not verified]'}`);
  return {
    subject: `uApplyPal weekly summary: ${formatDate(today)}`,
    html: layout(`Weekly summary: ${formatDate(today)}`, body, siteUrl),
    text: `Weekly summary ${formatDate(today)}\n\nNext actions:\n${textActions.join('\n') || '- none'}\n\n${siteUrl}`,
  };
}

module.exports = { dueAlerts, alertEmail, weeklyEmail, thresholdFor, THRESHOLDS };
