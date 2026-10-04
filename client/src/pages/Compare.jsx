import { useMemo, useState } from 'react';
import { useApp } from '../state.jsx';
import { ApplyBadge, CategoryBadge, MatchBadge, DeadlineCell, StatusSelect } from '../components/ui.jsx';
import { money } from '../format.js';

const MATCH_ORDER = { 'Strong Match': 0, Match: 1, Possible: 2, 'Weak Match': 3, Ineligible: 4 };
const CAT_ORDER = { Safe: 0, Target: 1, Reach: 2 };
const APPLY_ORDER = { OPEN: 0, UNKNOWN: 1, NOT_YET_OPEN: 2, CLOSED: 3 };

const COLUMNS = [
  ['university', 'University', (a) => a.university.short_name],
  ['program', 'Program', (a) => a.program.name],
  ['country', 'Country', (a) => a.university.country],
  ['match', 'Fit', (a) => MATCH_ORDER[a.assessment.match]],
  ['category', 'Reach/Target/Safe*', (a) => CAT_ORDER[a.assessment.admission.category]],
  ['status', 'My status', (a) => a.application.status],
  ['apply', 'Can apply now?', (a) => APPLY_ORDER[a.apply.state]],
  ['deadline', 'Next deadline', (a) => (a.next_deadline ? a.next_deadline.date : '9999')],
  ['tuition', 'Tuition / yr', (a) => num(a.cost.sticker && a.cost.sticker.annual)],
  ['after', 'Best case after aid*', (a) => num(a.cost.best_case ? a.cost.best_case.tuition : a.cost.student_tuition.annual)],
  ['sch', 'Scholarships', (a) => a.scholarships.length],
  ['sat', 'SAT', (a) => a.flags.sat || ''],
  ['exam', 'Other exam', (a) => a.flags.other_exams.join(',')],
  ['essay', 'Essay', (a) => (a.flags.essay ? 1 : 0)],
  ['interview', 'Interview', (a) => (a.flags.interview ? 1 : 0)],
  ['english', 'English test', (a) => (a.flags.english ? 1 : 0)],
  ['language', 'Taught in', (a) => a.program.language],
  ['duration', 'Years', (a) => a.program.duration_years],
  ['total', 'Total / yr*', (a) => num(a.cost.total_annual)],
];

function num(n) {
  return n == null ? Infinity : n;
}

export default function Compare() {
  const { view, mutate } = useApp();
  const [sort, setSort] = useState({ key: 'deadline', dir: 1 });
  const [q, setQ] = useState('');
  const [country, setCountry] = useState('');
  const [apply, setApply] = useState('');
  const [hideInactive, setHideInactive] = useState(true);

  const examName = Object.fromEntries(view.exams.map((e) => [e.code, e.name]));
  const countries = [...new Set(view.applications.map((a) => a.university.country))].sort();
  const rows = useMemo(() => {
    const getter = COLUMNS.find((c) => c[0] === sort.key)[2];
    return view.applications
      .filter((a) => !hideInactive || a.active)
      .filter((a) => !country || a.university.country === country)
      .filter((a) => !apply || a.apply.state === apply)
      .filter((a) => !q || `${a.university.name} ${a.university.short_name} ${a.program.name} ${a.university.city}`.toLowerCase().includes(q.toLowerCase()))
      .sort((x, y) => {
        const a = getter(x);
        const b = getter(y);
        return (a < b ? -1 : a > b ? 1 : 0) * sort.dir;
      });
  }, [view, sort, q, country, apply, hideInactive]);

  const setStatus = (id, status) => mutate(`/applications/${id}`, { method: 'PUT', body: { status } });

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Compare programs</h1>
          <p className="muted small">
            * Estimates. Reach/Target/Safe is based on selectivity and your entered scores; “best case” assumes the largest available funding comes through. Dots mark
            unverified dates.
          </p>
        </div>
      </header>
      <div className="filters">
        <input placeholder="Search university, program, city…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="">All countries</option>
          {countries.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select value={apply} onChange={(e) => setApply(e.target.value)}>
          <option value="">Any application status</option>
          <option value="OPEN">Open now (verified)</option>
          <option value="NOT_YET_OPEN">Not yet open</option>
          <option value="CLOSED">Closed</option>
          <option value="UNKNOWN">Unknown</option>
        </select>
        <label className="check">
          <input type="checkbox" checked={hideInactive} onChange={(e) => setHideInactive(e.target.checked)} /> Hide “not applying”
        </label>
      </div>
      <div className="table-wrap">
        <table className="table compare">
          <thead>
            <tr>
              {COLUMNS.map(([key, name]) => (
                <th key={key} onClick={() => setSort({ key, dir: sort.key === key ? -sort.dir : 1 })} className="sortable">
                  {name}
                  {sort.key === key ? (sort.dir > 0 ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td>
                  <a href={`#/app/${a.id}`}>
                    <strong>{a.university.short_name}</strong>
                  </a>
                  <div className="muted small">{a.university.city}</div>
                </td>
                <td className="wrap">{a.program.name}</td>
                <td>{a.university.country}</td>
                <td>
                  <MatchBadge match={a.assessment.match} />
                </td>
                <td>
                  <CategoryBadge admission={a.assessment.admission} />
                </td>
                <td>
                  <StatusSelect value={a.application.status} options={view.enums.APPLICATION_STATUSES} onChange={(s) => setStatus(a.id, s)} />
                </td>
                <td>
                  <ApplyBadge apply={a.apply} />
                </td>
                <td className="nowrap">
                  <DeadlineCell d={a.next_deadline} />
                </td>
                <td className="num">{money(a.cost.sticker && a.cost.sticker.annual)}</td>
                <td className="num" title={a.cost.best_case ? `via ${a.cost.best_case.via} (${a.cost.best_case.certainty})` : a.cost.student_tuition.basis}>
                  {money(a.cost.best_case ? a.cost.best_case.tuition : a.cost.student_tuition.annual)}
                  {a.cost.best_case && a.cost.best_case.certainty !== 'confirmed' && <span className="warn-dot" />}
                </td>
                <td className="num">{a.scholarships.length || '—'}</td>
                <td className="small">{a.flags.sat || '—'}</td>
                <td className="small">{a.flags.other_exams.map((c) => examName[c] || c).join(', ') || '—'}</td>
                <td>{a.flags.essay ? 'Yes' : '—'}</td>
                <td>{a.flags.interview ? 'Yes' : '—'}</td>
                <td>{a.flags.english ? 'Yes' : '—'}</td>
                <td>{a.program.language}</td>
                <td className="num">{a.program.duration_years}</td>
                <td className="num">{money(a.cost.total_annual)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">{rows.length} programs shown.</p>
    </div>
  );
}
