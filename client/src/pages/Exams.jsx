import { useEffect, useState } from 'react';
import { useApp } from '../state.jsx';
import { PriorityBadge, StatusSelect } from '../components/ui.jsx';
import { date } from '../format.js';

export default function Exams() {
  const { view } = useApp();
  const planned = new Set(view.exam_plans.map((e) => e.code));
  const others = view.exams.filter((e) => !planned.has(e.code));

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Exam planner</h1>
          <p className="muted small">Exams are consolidated across your whole portfolio: one SAT score can serve several applications.</p>
        </div>
      </header>
      <Strategy strategy={view.exam_strategy} />
      <h2 className="section-title">All exams in your applications</h2>
      {view.exam_plans.map((e) => (
        <ExamCard key={e.code} exam={e} />
      ))}
      {others.length > 0 && (
        <section className="card">
          <h2>Other exams</h2>
          <p className="muted small">Not required by any program in your portfolio, but possibly useful.</p>
          <ul className="plain">
            {others.map((e) => (
              <li key={e.code}>
                <strong>{e.name}</strong>: {e.syllabus} {e.note && <span className="muted small">{e.note}</span>}{' '}
                <a href={e.registration_url} target="_blank" rel="noreferrer" className="small">
                  Website ↗
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Strategy({ strategy }) {
  const status = (plan) => (plan && plan.status ? plan.status.replace(/_/g, ' ') : 'not registered');
  return (
    <section className="card strategy">
      <h2>Your exam strategy</h2>
      <p className="muted small">
        Worked out from the requirements of every application you’re considering. “Must” means there is no way around it for at least one application.
        “Recommended” is the single exam that covers the most applications where you have a choice; the others are alternatives.
      </p>

      <h3>(a) Must take: no alternative</h3>
      {strategy.must.length ? (
        <table className="table compact">
          <tbody>
            {strategy.must.map((m) => (
              <tr key={m.code}>
                <td>
                  <strong>{m.name}</strong>
                  <div className="muted small">{status(m.plan)}</div>
                </td>
                <td className="small">
                  Required by {m.count}: {m.programs.join('; ')}
                </td>
                <td className="nowrap small">{m.earliest ? `before ${date(m.earliest)}` : 'date not set'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted">None: every exam requirement has alternatives.</p>
      )}

      <h3>(b) Recommended: one exam covers several applications</h3>
      {strategy.recommended.length ? (
        strategy.recommended.map((r) => (
          <div key={r.code} className="rec">
            <div className="row">
              <span className="badge green">Recommended</span>
              <strong>{r.name}</strong>
              <span className="muted small">
                {r.slot_kind === 'language' ? 'English proof' : 'Admission test'} · covers {r.count} application{r.count === 1 ? '' : 's'}
                {r.earliest ? ` · first needed before ${date(r.earliest)}` : ''} · {status(r.plan)}
              </span>
            </div>
            <div className="small muted">{r.programs.join('; ')}</div>
            {r.min_scores.length > 0 && (
              <div className="small">Minimum scores: {[...new Set(r.min_scores.map((m) => `${m.program.split(':')[0]} ${m.min}`))].join(', ')}</div>
            )}
            {r.alternatives.length > 0 && (
              <ul className="plain small alts">
                {r.alternatives.map((a) => (
                  <li key={a.code}>
                    <span className="badge subtle grey">Alternative</span> <strong>{a.name}</strong>:{' '}
                    {a.not_for.length === 0 ? (
                      <span>accepted by all {a.programs.length} of them</span>
                    ) : (
                      <span>
                        accepted by {a.programs.length} of {r.count}
                        {a.programs.length <= 3 ? ` (${a.programs.map((p) => p.split(':')[0]).join(', ')})` : ''}; you’d still need {r.name} for the other {a.not_for.length}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))
      ) : (
        <p className="muted">No exam choices in your applications.</p>
      )}
      {strategy.covered_by_must.length > 0 && (
        <p className="small muted">Already covered by a must-take exam: {strategy.covered_by_must.map((c) => c.program).join('; ')}.</p>
      )}
      <p className="small muted">
        Acceptance comes from your program data: exams not confirmed for a program are not counted as accepted. Mark applications “Not applying” on the Compare page
        and the strategy updates.
      </p>
    </section>
  );
}

function ExamCard({ exam: e }) {
  const { mutate } = useApp();
  const [plan, setPlan] = useState(e.plan);
  useEffect(() => setPlan(e.plan), [e.plan]);
  const set = (k) => (ev) => setPlan({ ...plan, [k]: ev.target.value });
  const save = (patch = {}) => mutate(`/exams/${e.code}`, { method: 'PUT', body: { ...pick(plan), ...patch } });
  const gap = plan.target && plan.diagnostic ? Number(plan.target) - Number(plan.diagnostic) : null;

  return (
    <section className="card exam">
      <div className="exam-head">
        <h2>
          {e.meta.name} <PriorityBadge priority={e.priority} />
        </h2>
        <StatusSelect value={plan.status || 'not_registered'} options={['not_registered', 'registered', 'taken', 'not_needed']} onChange={(status) => save({ status })} />
      </div>
      <div className="grid-2">
        <div>
          <p className="small">
            {e.required_by.length > 0 && (
              <>
                <strong>Required by:</strong> {e.required_by.map((r) => r.name + (r.min_score ? ` (min ${r.min_score})` : '')).join('; ')}
                <br />
              </>
            )}
            {e.accepted_by.length > 0 && (
              <>
                <strong>Accepted by:</strong> {e.accepted_by.map((r) => r.name + (r.min_score ? ` (min ${r.min_score})` : '')).join('; ')}
              </>
            )}
          </p>
          {e.earliest_deadline && (
            <p className="small">
              Score needed before the <strong>{e.earliest_deadline.app}</strong> deadline: {date(e.earliest_deadline.date)}
              {e.earliest_deadline.status !== 'VERIFIED' && <span className="amber-text"> (date not verified)</span>}
            </p>
          )}
          <p className="small">
            <strong>Format:</strong> {e.meta.syllabus} {e.meta.scale && <span className="muted">Scale {e.meta.scale}.</span>}
          </p>
          {e.meta.study_hours_hint && <p className="small muted">{e.meta.study_hours_hint}</p>}
          {e.meta.resources && e.meta.resources.length > 0 && (
            <ul className="plain small">
              {e.meta.resources.map((r) => (
                <li key={r.url}>
                  <span className="badge subtle green">{r.type}</span>{' '}
                  <a href={r.url} target="_blank" rel="noreferrer">
                    {r.title} ↗
                  </a>
                </li>
              ))}
            </ul>
          )}
          {e.meta.registration_url && (
            <a className="small" href={e.meta.registration_url} target="_blank" rel="noreferrer">
              Registration / official info ↗
            </a>
          )}
        </div>
        <div>
          <div className="form-grid">
            <label>
              Test date
              <input type="date" value={plan.test_date || ''} onChange={set('test_date')} />
            </label>
            <label>
              Registration deadline
              <input type="date" value={plan.registration_deadline || ''} onChange={set('registration_deadline')} />
            </label>
            <label>
              Diagnostic score
              <input value={plan.diagnostic || ''} onChange={set('diagnostic')} />
            </label>
            <label>
              Target score
              <input value={plan.target || ''} onChange={set('target')} />
            </label>
            <label>
              Actual score
              <input value={plan.score || ''} onChange={set('score')} />
            </label>
            <label>
              Study hours / week
              <input value={plan.weekly_hours || ''} onChange={set('weekly_hours')} />
            </label>
          </div>
          <p className="small muted">
            {e.weeks_to_test != null && `${e.weeks_to_test} weeks to test day. `}
            {gap != null && gap > 0 && `Gap to target: ${gap} points. `}
            {e.weeks_to_test != null && plan.weekly_hours && `≈ ${e.weeks_to_test * Number(plan.weekly_hours)} study hours available.`}
          </p>
          <div className="row end">
            <button className="primary" onClick={() => save()}>
              Save plan
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function pick(plan) {
  const keys = ['status', 'test_date', 'registration_deadline', 'diagnostic', 'score', 'target', 'weekly_hours'];
  return Object.fromEntries(keys.filter((k) => plan[k] !== undefined && plan[k] !== null).map((k) => [k, plan[k]]));
}
