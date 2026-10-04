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
