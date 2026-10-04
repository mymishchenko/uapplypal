import { useApp } from '../state.jsx';
import { StatusSelect, Empty } from '../components/ui.jsx';

export default function Documents() {
  const { view, mutate } = useApp();
  const update = (type, patch) => mutate(`/documents/${type}`, { method: 'PUT', body: patch });

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Document library</h1>
          <p className="muted small">
            Prepare each document once and reuse it. Tracks originals, translations and apostille. File uploads come in a later phase; for now, keep the files in your
            own cloud folder.
          </p>
        </div>
      </header>
      {view.documents.length === 0 ? (
        <Empty>No documents needed yet.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Reused by</th>
                <th>Status</th>
                <th>Translation</th>
                <th>Apostille / legalisation</th>
                <th>Expires</th>
              </tr>
            </thead>
            <tbody>
              {view.documents.map((d) => (
                <tr key={d.type}>
                  <td>
                    <strong>{d.title}</strong>
                  </td>
                  <td className="small">
                    <strong>{d.used_by.length} applications</strong>
                    <div className="muted">{d.used_by.join(', ')}</div>
                  </td>
                  <td>
                    <StatusSelect value={d.state.status} options={['missing', 'in_progress', 'ready', 'expired']} onChange={(status) => update(d.type, { status })} />
                  </td>
                  <td>
                    <StatusSelect value={d.state.translation} options={['not_needed', 'needed', 'done', 'certified']} onChange={(translation) => update(d.type, { translation })} />
                  </td>
                  <td>
                    <StatusSelect value={d.state.apostille} options={['unknown', 'not_needed', 'needed', 'done']} onChange={(apostille) => update(d.type, { apostille })} />
                  </td>
                  <td>
                    <input type="date" value={d.state.expires || ''} onChange={(e) => update(d.type, { expires: e.target.value })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
