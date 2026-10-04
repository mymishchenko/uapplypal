import { useApp } from '../state.jsx';
import { ApplyBadge, PriorityBadge, VerifyBadge, FactControls, Empty } from '../components/ui.jsx';
import { date, daysLabel, deadlineText, greeting, money } from '../format.js';

export default function Dashboard() {
  const { view } = useApp();
  const { dashboard: d, student, applications } = view;
  const name = (student.personal.name || '').split(' ')[0];
  const portfolio = applications.filter((a) => a.active);
  const scholarships = portfolio
    .flatMap((a) => a.scholarships.map((s) => ({ ...s, uni: a.university.short_name })))
    .filter((s, i, arr) => arr.findIndex((x) => x.fid === s.fid) === i);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>
            {greeting()}
            {name ? `, ${name}` : ''}
          </h1>
          <p className="muted">
            {student.personal.target_intake || 'September 2027'} intake · {d.universities} universities · {d.counts.applications} programs being considered
          </p>
        </div>
        {d.next_deadline && (
          <a className="next-deadline" href={`#/app/${d.next_deadline.app_id}`}>
            <span className="muted small">Next deadline</span>
            <strong>{d.next_deadline.university}</strong>
            <span>
              {d.next_deadline.label}: {date(d.next_deadline.date)}
            </span>
            <span className="small">
              {daysLabel(d.next_deadline.days_left)} {d.next_deadline.status !== 'VERIFIED' && <VerifyBadge status={d.next_deadline.status} />}
            </span>
          </a>
        )}
      </header>

      <section className="stats">
        <Stat label="Applications" value={d.counts.applications} />
        <Stat label="Not started" value={d.counts.not_started} />
        <Stat label="Preparing" value={d.counts.preparing} />
        <Stat label="Ready" value={d.counts.ready} />
        <Stat label="Submitted" value={d.counts.submitted} />
        <Stat label="Open now (verified)" value={d.counts.open_now} />
        <Stat label="Scholarships found" value={d.counts.scholarships_found} />
        <Stat label="Scholarships applied" value={d.counts.scholarships_applied} />
        <Stat label="Upcoming exams" value={d.counts.upcoming_exams} />
      </section>

      <div className="grid-2">
        <section className="card">
          <h2>What should I do next?</h2>
          {d.actions.length ? (
            <ol className="actions">
              {d.actions.map((a, i) => (
                <li key={i}>
                  <div className="action-main">
                    <a href={a.app_id ? `#/app/${a.app_id}` : '#/exams'}>{a.title}</a>
                    <div className="muted small">{a.detail}</div>
                  </div>
                  <div className="action-meta">
                    <PriorityBadge priority={a.priority} />
                    <span className="small">
                      {date(a.date)} · {daysLabel(a.days_left)}
                    </span>
                    {!a.verified && <span className="small amber-text">date not verified</span>}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <Empty>No dated actions in the next 6 months.</Empty>
          )}
        </section>

        <section className="card">
          <h2>Upcoming deadlines</h2>
          <table className="table compact">
            <tbody>
              {d.upcoming_deadlines.map((x) => (
                <tr key={x.fid}>
                  <td className="nowrap">{deadlineText(x)}</td>
                  <td>
                    <a href={`#/app/${x.app_id}`}>{x.university}</a>
                    <div className="muted small">{x.label}</div>
                  </td>
                  <td className="nowrap small">{daysLabel(x.days_left)}</td>
                  <td>
                    <VerifyBadge status={x.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <a className="small" href="#/deadlines">
            All deadlines →
          </a>
        </section>
      </div>

      <div className="grid-2">
        <section className="card">
          <h2>Can I apply now?</h2>
          <table className="table compact">
            <tbody>
              {portfolio
                .slice()
                .sort((a, b) => order(a.apply) - order(b.apply))
                .map((a) => (
                  <tr key={a.id}>
                    <td>
                      <a href={`#/app/${a.id}`}>{a.university.short_name}</a>
                      <div className="muted small">{a.program.name}</div>
                    </td>
                    <td>
                      <ApplyBadge apply={a.apply} />
                      <div className="muted small">{a.apply.detail}</div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>

        <div className="stack">
          <section className="card">
            <h2>Verify these dates</h2>
            <p className="muted small">Dated deadlines in the next 4 months that aren't confirmed on an official page yet.</p>
            {d.to_verify.length ? (
              <ul className="plain">
                {d.to_verify.map((x) => (
                  <li key={x.fid}>
                    <a href={`#/app/${x.app_id}`}>{x.university}</a>: {x.label}, {deadlineText(x)}{' '}
                    {x.src && x.src.url && (
                      <a href={x.src.url} target="_blank" rel="noreferrer" className="small">
                        source ↗
                      </a>
                    )}{' '}
                    <FactControls fact={x} />
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Nothing to verify.</Empty>
            )}
          </section>

          <section className="card">
            <h2>Missing data</h2>
            {d.missing_data.length ? (
              <ul className="plain">
                {d.missing_data.map((m) => (
                  <li key={m.app_id}>
                    <a href={`#/app/${m.app_id}`}>{m.title}</a> <span className="muted small">{m.program}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>All programs have dated deadlines.</Empty>
            )}
          </section>

          <section className="card">
            <h2>Scholarship opportunities</h2>
            <ul className="plain">
              {scholarships.map((s) => (
                <li key={s.fid}>
                  <strong>{s.uni}</strong>: {s.name}{' '}
                  <span className="muted small">
                    {s.percent != null ? `${s.percent_is_max ? 'up to ' : ''}${s.percent}%` : s.amount != null ? money(s.amount) : 'amount unknown'} · {s.availability === 'AVAILABLE' ? 'available' : '2027 availability unknown'}
                  </span>
                </li>
              ))}
            </ul>
            <a className="small" href="#/scholarships">
              All scholarships →
            </a>
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="muted small">{label}</div>
    </div>
  );
}

function order(apply) {
  const base = { OPEN: 0, UNKNOWN: 1, NOT_YET_OPEN: 2, CLOSED: 3 }[apply.state];
  const likely = { OPEN: 0, NOT_YET_OPEN: 1, UNKNOWN: 2, CLOSED: 3 }[apply.likely] ?? 2;
  return base * 10 + likely;
}
