// Dates are ISO strings (YYYY-MM-DD). "Today" is computed in the student's
// time zone so deadlines flip at local midnight, not UTC midnight.
function todayISO(timeZone = 'Europe/Kyiv', now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function daysBetween(fromISO, toISO) {
  const ms = Date.parse(`${toISO}T00:00:00Z`) - Date.parse(`${fromISO}T00:00:00Z`);
  return Math.round(ms / 86400000);
}

function formatDate(iso) {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

module.exports = { todayISO, daysBetween, formatDate };
