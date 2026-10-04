import { useState } from 'react';
import { useApp } from '../state.jsx';
import { VerifyBadge, SourceLink, FactControls } from '../components/ui.jsx';
import { deadlineText, daysLabel, label } from '../format.js';

export default function Deadlines() {
  const { view } = useApp();
  const [filter, setFilter] = useState('upcoming');
  const rows = view.deadlines.filter((d) =>
    filter === 'upcoming' ? d.date && d.days_left >= 0 : filter === 'past' ? d.date && d.days_left < 0 : filter === 'undated' ? !d.date : true,
  );

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Deadlines</h1>
          <p className="muted small">
            Every date shows its academic year, source and verification status. Dates from a previous cycle are never shown as current. They stay “Needs verification”
            with the old date in the text.
          </p>
        </div>
      </header>
      <div className="filters">
        {['upcoming', 'undated', 'past', 'all'].map((f) => (
          <button key={f} className={filter === f ? 'primary' : ''} onClick={() => setFilter(f)}>
            {label(f)}
          </button>
        ))}
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Days</th>
              <th>University</th>
              <th>What</th>
              <th>Type</th>
              <th>Verification</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.fid}>
                <td className="nowrap">{deadlineText(d)}</td>
                <td className="nowrap small">{daysLabel(d.days_left)}</td>
                <td>
                  <a href={`#/app/${d.app_id}`}>{d.university}</a>
                  <div className="muted small">{d.program}</div>
                </td>
                <td>
                  {d.label}
                  {d.note && <div className="muted small">{d.note}</div>}
                </td>
                <td className="small">{label(d.type)}</td>
                <td>
                  <VerifyBadge status={d.status} />
                </td>
                <td className="small">
                  <SourceLink fact={d} />
                  <div>
                    <FactControls fact={d} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
