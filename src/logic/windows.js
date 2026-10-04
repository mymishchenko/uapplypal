// "Can I apply now?" for one intake.
//
// Critical rule: OPEN / NOT_YET_OPEN / CLOSED are only shown when the relevant
// dates are VERIFIED for this program + intake. Anything resting on expected or
// missing data is UNKNOWN, with a `likely` hint that the UI labels as unverified.
const { formatDate } = require('./dates');

const CLOSING_TYPES = new Set(['early_round', 'priority_round', 'round', 'regular_round', 'final_application']);

function describeDate(d) {
  if (!d) return 'unknown date';
  if (d.date) return formatDate(d.date);
  return d.date_text || 'unknown date';
}

function evaluate(opens, closes, today, requireVerified) {
  const ok = (d) => d && (!requireVerified || d.status === 'VERIFIED');
  const hasOpened = (d) => d.already_open || (d.date && d.date <= today);

  if (ok(closes) && closes.date && closes.date < today) return { state: 'CLOSED' };
  if (ok(opens) && opens.date && opens.date > today) return { state: 'NOT_YET_OPEN', opens };
  if (ok(opens) && hasOpened(opens)) return { state: 'OPEN', closes };
  return { state: 'UNKNOWN' };
}

function windowStatus(win, deadlinesById, today) {
  const opens = deadlinesById[win.opens];
  const closes = deadlinesById[win.closes];
  const verified = evaluate(opens, closes, today, true);
  if (verified.state !== 'UNKNOWN') return { window: win, ...verified, verified: true };
  const likely = evaluate(opens, closes, today, false);
  return { window: win, state: 'UNKNOWN', likely: likely.state, opens, closes, verified: false };
}

function canApplyNow(intake, today) {
  const byId = Object.fromEntries(intake.deadlines.map((d) => [d.id, d]));
  const statuses = intake.windows.map((w) => windowStatus(w, byId, today));

  const pick = (pred) => statuses.find(pred);
  let result =
    pick((s) => s.state === 'OPEN') ||
    pick((s) => s.state === 'UNKNOWN' && (s.likely === 'OPEN' || s.likely === 'UNKNOWN')) ||
    earliest(statuses.filter((s) => s.state === 'NOT_YET_OPEN')) ||
    earliest(statuses.filter((s) => s.state === 'UNKNOWN' && s.likely === 'NOT_YET_OPEN')) ||
    (statuses.length && statuses.every((s) => s.state === 'CLOSED') ? statuses[statuses.length - 1] : null) ||
    statuses.find((s) => s.state === 'UNKNOWN') ||
    { state: 'UNKNOWN', likely: 'UNKNOWN', window: null };

  return { state: result.state, likely: result.likely || null, verified: !!result.verified, window: result.window ? result.window.label : null, detail: detail(result) };
}

function earliest(list) {
  return list
    .slice()
    .sort((a, b) => ((a.opens && a.opens.date) || '9999').localeCompare((b.opens && b.opens.date) || '9999'))[0];
}

function detail(s) {
  const name = s.window ? s.window.label : 'Application';
  switch (s.state) {
    case 'OPEN':
      return s.closes ? `${name} open until ${describeDate(s.closes)}` : `${name} open`;
    case 'NOT_YET_OPEN':
      return `${name} opens ${describeDate(s.opens)}`;
    case 'CLOSED':
      return `${name} closed`;
    default:
      switch (s.likely) {
        case 'OPEN':
          return `Looks open${s.closes ? ` until ${describeDate(s.closes)}` : ''}: verify on the official page`;
        case 'NOT_YET_OPEN':
          return `Expected to open ${describeDate(s.opens)}: not verified`;
        case 'CLOSED':
          return 'Expected closed: not verified';
        default:
          if (s.opens && s.opens.date_text && s.opens.status !== 'UNKNOWN') return `Expected to open ${s.opens.date_text}: not verified`;
          return 'No reliable dates yet';
      }
  }
}

// Next closing deadline (round/final) that is still ahead, or null.
function nextClosingDeadline(intake, today) {
  return (
    intake.deadlines
      .filter((d) => CLOSING_TYPES.has(d.type) && d.date && d.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))[0] || null
  );
}

module.exports = { canApplyNow, nextClosingDeadline, CLOSING_TYPES, describeDate };
