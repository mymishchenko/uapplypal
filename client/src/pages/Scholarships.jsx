import { useApp } from '../state.jsx';
import { VerifyBadge, SourceLink, StatusSelect, FactControls } from '../components/ui.jsx';
import { money, label, deadlineText } from '../format.js';

export default function Scholarships() {
  const { view, mutate } = useApp();
  const portfolio = view.applications.filter((a) => a.active);
  const seen = new Set();
  const scholarships = [];
  for (const a of portfolio) {
    for (const s of a.scholarships) {
      if (seen.has(s.fid)) continue;
      seen.add(s.fid);
      scholarships.push({ ...s, uni: a.university.short_name });
    }
  }
  const setSch = (fid, progress) => mutate(`/scholarships/${encodeURIComponent(fid)}`, { method: 'PUT', body: { progress } });

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Scholarships & funding</h1>
          <p className="muted small">Official tuition is kept separate from estimated cost after aid. Funding whose 2027/28 availability is unknown never lowers the base estimate.</p>
        </div>
      </header>

      <section className="card">
        <h2>Cheapest realistic way to attend</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>University</th>
                <th>Official tuition / yr</th>
                <th>Your tuition / yr</th>
                <th>Best case tuition*</th>
                <th>Total / yr (est.)</th>
                <th>Route</th>
              </tr>
            </thead>
            <tbody>
              {portfolio
                .slice()
                .sort((a, b) => (a.cost.best_case ? a.cost.best_case.tuition : a.cost.student_tuition.annual ?? Infinity) - (b.cost.best_case ? b.cost.best_case.tuition : b.cost.student_tuition.annual ?? Infinity))
                .map((a) => (
                  <tr key={a.id}>
                    <td>
                      <a href={`#/app/${a.id}`}>{a.university.short_name}</a>
                      <div className="muted small">{a.program.name}</div>
                    </td>
                    <td className="num">{money(a.cost.sticker && a.cost.sticker.annual)}</td>
                    <td className="num">{money(a.cost.student_tuition.annual)}</td>
                    <td className="num">{a.cost.best_case ? money(a.cost.best_case.tuition) : '—'}</td>
                    <td className="num">{money(a.cost.total_annual)}</td>
                    <td className="small">{a.cost.cheapest_route}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Scholarships found ({scholarships.length})</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Scholarship</th>
                <th>Amount</th>
                <th>Type</th>
                <th>Covers</th>
                <th>2027/28 availability</th>
                <th>Deadline</th>
                <th>Separate application</th>
                <th>My status</th>
                <th>Verification</th>
              </tr>
            </thead>
            <tbody>
              {scholarships.map((s) => (
                <tr key={s.fid}>
                  <td>
                    <strong>{s.name}</strong>
                    <div className="muted small">{s.uni}</div>
                    <div className="small">{s.eligibility}</div>
                  </td>
                  <td className="nowrap">{s.percent != null ? `${s.percent_is_max ? 'up to ' : ''}${s.percent}%` : s.amount != null ? money(s.amount) : 'Unknown'}</td>
                  <td className="small">{label(s.type)}</td>
                  <td className="small">
                    {Object.entries(s.coverage || {})
                      .filter(([, v]) => v)
                      .map(([k]) => k)
                      .join(', ') || '—'}
                  </td>
                  <td>
                    <span className={`badge ${s.availability === 'AVAILABLE' ? 'green' : s.availability === 'NOT_AVAILABLE' ? 'grey' : 'amber'}`}>{s.availability === 'AVAILABLE' ? 'Available' : s.availability === 'NOT_AVAILABLE' ? 'Not available' : 'Needs verification'}</span>
                  </td>
                  <td className="small">{s.deadline ? deadlineText(s.deadline) : '—'}</td>
                  <td>{s.separate_application == null ? '?' : s.separate_application ? 'Yes' : 'No'}</td>
                  <td>
                    <StatusSelect value={s.progress} options={['not_started', 'considering', 'applying', 'applied', 'awarded', 'rejected']} onChange={(p) => setSch(s.fid, p)} />
                  </td>
                  <td className="small">
                    <VerifyBadge status={s.status} />
                    <div>
                      <SourceLink fact={s} />
                    </div>
                    <FactControls fact={s} kind="amount" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
