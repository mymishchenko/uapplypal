import { useState } from 'react';
import { useApp } from '../state.jsx';
import { date, deadlineText, label } from '../format.js';

const APPLY = {
  OPEN: ['OPEN NOW', 'green'],
  NOT_YET_OPEN: ['NOT YET OPEN', 'blue'],
  CLOSED: ['CLOSED', 'grey'],
  UNKNOWN: ['UNKNOWN', 'amber'],
};

export function ApplyBadge({ apply, showDetail = false }) {
  const [text, tone] = APPLY[apply.state];
  return (
    <span className="apply">
      <span className={`badge ${tone}`} title={apply.detail}>
        {text}
      </span>
      {showDetail && <span className="muted small"> {apply.detail}</span>}
    </span>
  );
}

const VERIFY = {
  VERIFIED: ['✓ Verified', 'green'],
  EXPECTED: ['Needs verification', 'amber'],
  UNKNOWN: ['Unknown', 'grey'],
};

export function VerifyBadge({ status }) {
  const [text, tone] = VERIFY[status] || VERIFY.UNKNOWN;
  return <span className={`badge subtle ${tone}`}>{text}</span>;
}

const PRIORITY_TONE = { critical: 'red', high: 'amber', medium: 'blue', low: 'grey', done: 'green' };
export function PriorityBadge({ priority }) {
  return <span className={`badge ${PRIORITY_TONE[priority] || 'grey'}`}>{label(priority)}</span>;
}

const MATCH_TONE = { 'Strong Match': 'green', Match: 'blue', Possible: 'amber', 'Weak Match': 'grey', Ineligible: 'red' };
export function MatchBadge({ match }) {
  return <span className={`badge subtle ${MATCH_TONE[match]}`}>{match}</span>;
}

const CATEGORY_TONE = { Reach: 'red', Target: 'blue', Safe: 'green' };
export function CategoryBadge({ admission }) {
  return (
    <span className={`badge subtle ${CATEGORY_TONE[admission.category]}`} title={`Estimate: ${admission.reasons.join('; ')}`}>
      {admission.category}*
    </span>
  );
}

const PROGRESS_TONE = {
  not_started: 'grey', in_progress: 'blue', ready: 'green', submitted: 'green', verified: 'green', problem: 'red', na: 'grey',
  preparing: 'blue', offer: 'green', waitlisted: 'amber', rejected: 'red', withdrawn: 'grey', not_applying: 'grey',
  missing: 'grey', expired: 'red', considering: 'grey', applying: 'blue', applied: 'green', awarded: 'green',
  not_registered: 'grey', registered: 'blue', taken: 'green', not_needed: 'grey',
};

export function StatusSelect({ value, options, onChange, labels = {} }) {
  return (
    <select className={`status ${PROGRESS_TONE[value] || 'grey'}`} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o} value={o}>
          {labels[o] || label(o)}
        </option>
      ))}
    </select>
  );
}

export function SourceLink({ fact }) {
  const src = fact && fact.src;
  if (!src) return <span className="muted small">No source</span>;
  const checked = fact.checked ? ` · checked ${date(fact.checked)}` : ' · not checked';
  return (
    <span className="small muted source">
      {src.url ? (
        <a href={src.url} target="_blank" rel="noreferrer" title={src.title}>
          View source ↗
        </a>
      ) : (
        <span title={src.title}>{label(src.type)}</span>
      )}
      {checked}
    </span>
  );
}

// Verify / edit controls for any fact with an fid.
export function FactControls({ fact, kind = 'date' }) {
  const { mutate } = useApp();
  const [editing, setEditing] = useState(false);
  if (!fact || !fact.fid) return null;
  return (
    <span className="fact-controls">
      {fact.status !== 'VERIFIED' && (
        <button
          className="link"
          title="I checked the official source and this value is correct for this intake"
          onClick={() => mutate(`/facts/${encodeURIComponent(fact.fid)}/verify`, { method: 'POST' })}
        >
          Mark verified
        </button>
      )}
      <button className="link" onClick={() => setEditing(true)}>
        Edit
      </button>
      {editing && <EditFactDialog fact={fact} kind={kind} onClose={() => setEditing(false)} />}
    </span>
  );
}

function EditFactDialog({ fact, kind, onClose }) {
  const { mutate } = useApp();
  const [form, setForm] = useState({
    date: fact.date || '',
    date_text: fact.date_text || '',
    amount: fact.amount ?? '',
    rank_text: fact.rank_text ?? '',
    edition: fact.edition ?? '',
    status: fact.status,
    source_url: (fact.user_source && fact.user_source.url) || '',
    note: fact.note || '',
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const save = async () => {
    const body = { status: form.status, note: form.note };
    if (kind === 'date') Object.assign(body, { date: form.date, date_text: form.date_text });
    if (kind === 'amount') body.amount = form.amount;
    if (kind === 'rank') Object.assign(body, { rank_text: form.rank_text, edition: form.edition });
    if (form.source_url) body.source_url = form.source_url;
    if (await mutate(`/facts/${encodeURIComponent(fact.fid)}`, { method: 'PUT', body })) onClose();
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Edit: {fact.label || fact.title || fact.name || 'value'}</h3>
        <div className="form-grid">
          {kind === 'date' && (
            <>
              <label>
                Date
                <input type="date" value={form.date} onChange={set('date')} />
              </label>
              <label>
                Text (if no exact date)
                <input value={form.date_text} onChange={set('date_text')} placeholder="e.g. Spring 2027" />
              </label>
            </>
          )}
          {kind === 'rank' && (
            <>
              <label>
                Rank (e.g. 107, =176, 301–350, not ranked)
                <input value={form.rank_text} onChange={set('rank_text')} />
              </label>
              <label>
                Edition (e.g. 2027, 2026-2027)
                <input value={form.edition} onChange={set('edition')} />
              </label>
            </>
          )}
          {kind === 'amount' && (
            <label>
              Amount (€ per {fact.period || 'year'})
              <input type="number" step="0.01" value={form.amount} onChange={set('amount')} />
            </label>
          )}
          <label>
            Verification
            <select value={form.status} onChange={set('status')}>
              <option value="VERIFIED">Verified: official source confirms this intake</option>
              <option value="EXPECTED">Expected: previous cycle / unconfirmed</option>
              <option value="UNKNOWN">Unknown</option>
            </select>
          </label>
          <label className="wide">
            Official source URL
            <input value={form.source_url} onChange={set('source_url')} placeholder="https://…" />
          </label>
          <label className="wide">
            Note
            <input value={form.note} onChange={set('note')} />
          </label>
        </div>
        <p className="muted small">Only mark “Verified” if an official page explicitly confirms the value for this intake.</p>
        <div className="row end">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export function DeadlineCell({ d }) {
  if (!d) return <span className="muted">—</span>;
  return (
    <span>
      {deadlineText(d)}
      {d.status !== 'VERIFIED' && <span className="warn-dot" title="Not verified" />}
    </span>
  );
}

export function Empty({ children }) {
  return <p className="muted empty">{children}</p>;
}
