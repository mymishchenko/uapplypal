export function money(n, { decimals = 0 } = {}) {
  if (n == null || Number.isNaN(n)) return '—';
  return `€${Number(n).toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

export function date(iso) {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function deadlineText(d) {
  if (!d) return '—';
  if (d.date) return d.date_end ? `${date(d.date)} – ${date(d.date_end)}` : date(d.date);
  return d.date_text || 'Unknown';
}

export function daysLabel(days) {
  if (days == null) return '';
  if (days < 0) return `${-days}d ago`;
  if (days === 0) return 'today';
  return `${days}d left`;
}

export const label = (s) => String(s || '').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

export function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

// Human-readable size of a scholarship (percent, fixed amount or free text).
export function fundingAmount(s) {
  if (s.percent != null) return `${s.percent_is_max ? 'up to ' : ''}${s.percent}%`;
  if (s.amount_text) return s.amount_text;
  if (s.amount != null) return money(s.amount);
  return 'Amount unknown';
}
