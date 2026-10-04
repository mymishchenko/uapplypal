import { useApp } from '../state.jsx';
import { date, label } from '../format.js';

export default function Sources() {
  const { view } = useApp();
  const sources = view.sources.slice().sort((a, b) => (a.type || '').localeCompare(b.type || ''));
  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Sources</h1>
          <p className="muted small">
            Official admission pages, regulations and scholarship pages are preferred. Blogs and aggregators are not used for critical requirements. “Brief” and
            “estimate” sources must be replaced by official ones before relying on a value.
          </p>
        </div>
      </header>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Source</th>
              <th>Type</th>
              <th>Academic year</th>
              <th>Last checked</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id}>
                <td>
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noreferrer">
                      {s.title} ↗
                    </a>
                  ) : (
                    s.title
                  )}
                </td>
                <td className="small">{label(s.type)}</td>
                <td className="small">{s.academic_year || '—'}</td>
                <td className="small">{s.date_checked ? date(s.date_checked) : <span className="muted">Not checked</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
