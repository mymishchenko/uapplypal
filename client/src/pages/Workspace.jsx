import { useEffect, useState } from 'react';
import { useApp } from '../state.jsx';
import { ApplyBadge, CategoryBadge, MatchBadge, VerifyBadge, SourceLink, FactControls, StatusSelect, EligibilityBadges } from '../components/ui.jsx';
import { money, deadlineText, daysLabel, label, fundingAmount } from '../format.js';

const CATEGORIES = [
  ['academic', 'Academic'],
  ['language', 'Language'],
  ['tests', 'Tests'],
  ['materials', 'Written & documents'],
  ['selection', 'Selection & assessment'],
  ['financial', 'Financial'],
  ['application', 'Application'],
];

export default function Workspace({ id }) {
  const { view, mutate } = useApp();
  const a = view.applications.find((x) => x.id === id);
  const [notes, setNotes] = useState(a ? a.application.notes : '');
  useEffect(() => setNotes(a ? a.application.notes : ''), [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!a) return <p>Application not found.</p>;

  const put = (body) => mutate(`/applications/${a.id}`, { method: 'PUT', body });
  const setReq = (fid, progress) => mutate(`/requirements/${encodeURIComponent(fid)}`, { method: 'PUT', body: { progress } });
  const setSch = (fid, progress) => mutate(`/scholarships/${encodeURIComponent(fid)}`, { method: 'PUT', body: { progress } });
  const c = a.cost;

  return (
    <div className="page">
      <a className="small" href="#/compare">
        ← All programs
      </a>
      <header className="page-head">
        <div>
          <h1>
            {a.university.short_name}: {a.program.name}
          </h1>
          <p className="muted">
            {a.university.city}, {a.university.country} · {a.program.degree} · {a.program.duration_years} years · taught in {a.program.language} · {a.intake.label}{' '}
            <a href={a.program.official_url} target="_blank" rel="noreferrer">
              Official page ↗
            </a>
          </p>
        </div>
        <div className="head-controls">
          <label className="small muted">
            My status
            <StatusSelect value={a.application.status} options={view.enums.APPLICATION_STATUSES} onChange={(status) => put({ status })} />
          </label>
        </div>
      </header>

      <section className="summary-row">
        <div className="card tight">
          <div className="muted small">Can I apply now?</div>
          <ApplyBadge apply={a.apply} />
          <div className="small">{a.apply.detail}</div>
        </div>
        <div className="card tight">
          <div className="muted small">Next deadline</div>
          {a.next_deadline ? (
            <>
              <strong>{deadlineText(a.next_deadline)}</strong>
              <div className="small">
                {a.next_deadline.label} · {daysLabel(a.next_deadline.days_left)} <VerifyBadge status={a.next_deadline.status} />
              </div>
            </>
          ) : (
            <span className="muted">No dated deadline yet</span>
          )}
        </div>
        <div className="card tight">
          <div className="muted small">Progress</div>
          <strong>
            {a.progress.done}/{a.progress.total}
          </strong>{' '}
          <span className="small muted">requirements ready</span>
          <div className="progress">
            <div style={{ width: `${a.progress.total ? (100 * a.progress.done) / a.progress.total : 0}%` }} />
          </div>
        </div>
        <div className="card tight">
          <div className="muted small">Your tuition</div>
          <strong>{money(c.student_tuition.annual)}/year</strong>
          <div className="small muted">{c.student_tuition.basis}</div>
        </div>
      </section>

      {a.intake.status_note && <p className="note">{a.intake.status_note}</p>}

      <div className="grid-2">
        <section className="card">
          <h2>Requirements checklist</h2>
          {CATEGORIES.map(([cat, name]) => {
            const items = a.requirements.filter((r) => r.category === cat);
            if (!items.length) return null;
            return (
              <div key={cat} className="req-group">
                <h3>{name}</h3>
                {items.map((r) => (
                  <div key={r.fid} className={`req ${['ready', 'submitted', 'verified', 'na'].includes(r.progress) ? 'done' : ''}`}>
                    <StatusSelect value={r.progress} options={view.enums.REQUIREMENT_STATUSES} labels={{ na: 'Not applicable' }} onChange={(p) => setReq(r.fid, p)} />
                    <div className="req-body">
                      <div>{r.title}</div>
                      {r.detail && <div className="muted small">{r.detail}</div>}
                      <div className="small">
                        <VerifyBadge status={r.status} /> <SourceLink fact={r} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </section>

        <div className="stack">
          <section className="card">
            <h2>Fit for you</h2>
            <p>
              <MatchBadge match={a.assessment.match} /> <CategoryBadge admission={a.assessment.admission} />
            </p>
            <p className="muted small">Admission category is an estimate: {a.assessment.admission.reasons.join('; ')}.</p>
            <div className="pros-risks">
              <ul className="pros">
                {a.assessment.pros.map((p) => (
                  <li key={p}>+ {p}</li>
                ))}
              </ul>
              <ul className="risks">
                {a.assessment.risks.map((r) => (
                  <li key={r}>− {r}</li>
                ))}
              </ul>
            </div>
          </section>

          <section className="card">
            <h2>Deadlines ({a.intake.academic_year})</h2>
            <table className="table compact">
              <tbody>
                {a.deadlines.map((d) => (
                  <tr key={d.fid} className={d.days_left != null && d.days_left < 0 ? 'past' : ''}>
                    <td className="date-col">{deadlineText(d)}</td>
                    <td>
                      {d.label}
                      {d.note && <div className="muted small">{d.note}</div>}
                      <div className="small">
                        <SourceLink fact={d} /> <FactControls fact={d} />
                      </div>
                    </td>
                    <td className="nowrap small">{daysLabel(d.days_left)}</td>
                    <td>
                      <VerifyBadge status={d.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="card">
            <h2>Rankings</h2>
            <p>
              <strong>{a.ranking.score == null ? '—' : `${a.ranking.score} / 100`}</strong> <span className="muted small">{a.ranking.summary}</span>
            </p>
            <table className="table compact">
              <tbody>
                {a.ranking.components.map((c) => (
                  <tr key={c.fid}>
                    <td>
                      {c.name}
                      <div className="muted small">{c.edition ? `Edition ${c.edition}` : 'Edition not stated'}</div>
                    </td>
                    <td className="nowrap">{c.not_ranked ? 'Not ranked' : c.rank_text || '—'}</td>
                    <td className="num">{c.score == null ? '—' : c.score}</td>
                    <td>
                      <VerifyBadge status={c.status} />
                      {c.note && <div className="muted small">{c.note}</div>}
                      <div className="small">
                        <SourceLink fact={c} /> <FactControls fact={{ ...c, label: c.name }} kind="rank" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted small">
              Score = average of the available rankings, each normalised to 0–100: 100 × (1 − (rank − 1) / institutions ranked). Bands use their midpoint.
            </p>
          </section>

          <section className="card">
            <h2>Real cost</h2>
            <table className="table compact">
              <tbody>
                <tr>
                  <td>Official tuition (sticker)</td>
                  <td className="num">
                    {money(c.sticker && c.sticker.annual, { decimals: 2 })}/yr
                    {c.sticker && c.sticker.detail && <div className="muted small">{c.sticker.detail}</div>}
                  </td>
                  <td>
                    {c.sticker && <VerifyBadge status={c.sticker.status} />}
                    <div>
                      {c.sticker && <SourceLink fact={c.sticker} />} <FactControls fact={findFact(a, 'sticker')} kind="amount" />
                    </div>
                  </td>
                </tr>
                {c.sticker && c.sticker.group && (
                  <tr>
                    <td colSpan={3} className="muted small">
                      Rate shown for: {c.sticker.group}
                    </td>
                  </tr>
                )}
                <tr>
                  <td>Your tuition</td>
                  <td className="num">{money(c.student_tuition.annual, { decimals: 2 })}/yr</td>
                  <td className="small muted">{c.student_tuition.basis}</td>
                </tr>
                {c.fees.map((f) => (
                  <tr key={f.label}>
                    <td>{f.label}</td>
                    <td className="num">{money(f.annual, { decimals: 2 })}/yr</td>
                    <td>
                      <VerifyBadge status={f.status} />
                    </td>
                  </tr>
                ))}
                <tr>
                  <td>Application fee</td>
                  <td className="num">{money(c.application_fee && c.application_fee.amount)}</td>
                  <td>
                    {c.application_fee && <VerifyBadge status={c.application_fee.status} />} <FactControls fact={findFact(a, 'application_fee')} kind="amount" />
                  </td>
                </tr>
                <tr>
                  <td>Living costs (estimate)</td>
                  <td className="num">{money(c.living.annual)}/yr</td>
                  <td className="small muted">{c.living.monthly ? `~${money(c.living.monthly)}/month, rough estimate` : 'No estimate'}</td>
                </tr>
                <tr className="total">
                  <td>Estimated total per year</td>
                  <td className="num">{money(c.total_annual)}</td>
                  <td className="small muted">Estimate</td>
                </tr>
                <tr>
                  <td>Best case after aid</td>
                  <td className="num">{c.best_case ? `${money(c.best_case.total)}/yr` : '—'}</td>
                  <td className="small">{c.best_case ? `If “${c.best_case.via}” ${c.best_case.up_to ? '(up to) ' : ''}comes through: ${c.best_case.certainty}` : 'No funding found yet'}</td>
                </tr>
              </tbody>
            </table>
            <p className="small">
              <strong>Cheapest realistic route:</strong> {c.cheapest_route}
            </p>
          </section>

          {(a.benefits.length > 0 || a.scholarships.length > 0) && (
            <section className="card">
              <h2>Scholarships & Ukrainian student rules</h2>
              {a.benefits.map((b) => (
                <div key={b.fid} className={`sch ${b.eligible ? '' : 'dim'}`}>
                  <strong>{b.title}</strong> <span className={`badge ${b.state === 'ACTIVE' ? 'green' : b.state === 'EXPIRED' ? 'grey' : 'amber'}`}>{b.state === 'UNKNOWN' ? `UNKNOWN FOR ${b.academic_year}` : `${b.state} ${b.academic_year}`}</span>{' '}
                  <VerifyBadge status={b.status} /> <EligibilityBadges item={b} />
                  {b.eligibility && <div className="small">{b.eligibility}</div>}
                  {b.note && <div className="muted small">{b.note}</div>}
                  <div className="small row">
                    <SourceLink fact={b} /> <FactControls fact={b} kind="none" />
                  </div>
                </div>
              ))}
              {a.scholarships.map((s) => (
                <div key={s.fid} className={`sch ${s.eligible ? '' : 'dim'}`}>
                  <strong>{s.name}</strong> <EligibilityBadges item={s} />{' '}
                  <span className="muted small">
                    {fundingAmount(s)} · {label(s.type)} ·{' '}
                    {s.availability === 'AVAILABLE' ? 'available' : s.availability === 'NOT_AVAILABLE' ? 'not available' : 'availability unknown'}
                  </span>
                  <div className="small">{s.eligibility}</div>
                  <div className="small row">
                    <StatusSelect value={s.progress} options={['not_started', 'considering', 'applying', 'applied', 'awarded', 'rejected']} onChange={(p) => setSch(s.fid, p)} />
                    <VerifyBadge status={s.status} /> <SourceLink fact={s} /> <FactControls fact={s} kind="amount" />
                  </div>
                </div>
              ))}
            </section>
          )}

          <section className="card">
            <h2>Notes</h2>
            <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Contacts, portal logins (not passwords), ideas…" />
            <div className="row end">
              <button disabled={notes === a.application.notes} onClick={() => put({ notes })}>
                Save notes
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function findFact(a, key) {
  // Tuition facts are exposed with fid on the cost object.
  if (key === 'sticker') return a.cost.sticker && { ...a.cost.sticker, fid: a.cost.sticker.fid, amount: a.cost.sticker.annual, period: 'year', label: 'Tuition' };
  if (key === 'application_fee') return a.cost.application_fee && { ...a.cost.application_fee, label: 'Application fee' };
  return null;
}

