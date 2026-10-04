import { useEffect, useState } from 'react';
import { request } from '../api.js';
import { Empty } from '../components/ui.jsx';
import { date, daysLabel } from '../format.js';

export default function Alerts() {
  const [status, setStatus] = useState(null);
  const [preview, setPreview] = useState('weekly');
  const [message, setMessage] = useState(null);
  const [sending, setSending] = useState(false);

  const load = () => request('/notifications').then(setStatus, (e) => setMessage(e.message));
  useEffect(() => {
    load();
  }, []);

  const sendTest = async () => {
    setSending(true);
    setMessage(null);
    try {
      const r = await request('/notifications/test', { method: 'POST' });
      setMessage(r.ok ? 'Test email sent. Check your inbox (and spam folder).' : 'Sending failed: see the log below.');
    } catch (e) {
      setMessage(e.message);
    } finally {
      setSending(false);
      load();
    }
  };

  if (!status) return <p className="muted">{message || 'Loading…'}</p>;
  const s = status.schedule;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Email alerts</h1>
          <p className="muted small">
            Your tracking agent checks every hour and emails you about deadlines and progress. It only reads your UApplyPal data and never searches the web.
          </p>
        </div>
        <button className="primary" disabled={!status.configured || sending} onClick={sendTest}>
          {sending ? 'Sending…' : 'Send test email'}
        </button>
      </header>

      {!status.configured && (
        <div className="note">
          Email isn’t set up yet. Add the <code>GMAIL_USER</code> and <code>GMAIL_APP_PASSWORD</code> secrets in GitHub (see docs/DEPLOY.md), and the next deploy turns
          alerts on.
        </div>
      )}
      {message && <div className="note">{message}</div>}

      <div className="grid-2">
        <section className="card">
          <h2>Schedule</h2>
          <ul className="plain">
            <li>
              <strong>Deadline alerts</strong>: when a deadline is {s.thresholds.join(', ')} days away, and once if a deadline passes before you submit.
            </li>
            <li>
              <strong>Weekly summary</strong>: {s.weekly} from {s.sendHour}:00 ({s.timeZone}): next actions, deadlines in the next 45 days, progress per application,
              exams.
            </li>
            <li>
              <strong>Sent to</strong>: {status.to || 'not configured'}
            </li>
            <li className="muted small">Submitted, withdrawn and “not applying” applications are skipped. Exam dates you enter on the Exams page are included.</li>
          </ul>
        </section>

        <section className="card">
          <h2>Alerts due now ({status.pending.length})</h2>
          {status.pending.length ? (
            <ul className="plain">
              {status.pending.map((p, i) => (
                <li key={i}>
                  {date(p.date)} · {p.overdue ? <span className="amber-text">missed</span> : daysLabel(p.days)}: {p.title}
                  {!p.verified && <span className="muted small"> (not verified)</span>}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nothing due. The next alert goes out when a deadline reaches {s.thresholds[0]} days.</Empty>
          )}
        </section>
      </div>

      <section className="card">
        <div className="row">
          <h2 style={{ margin: 0 }}>Preview</h2>
          <button className={preview === 'weekly' ? 'primary' : ''} onClick={() => setPreview('weekly')}>
            Weekly summary
          </button>
          <button className={preview === 'alerts' ? 'primary' : ''} onClick={() => setPreview('alerts')}>
            Deadline alert
          </button>
        </div>
        <iframe key={preview} className="preview-frame" title="Email preview" src={`/api/notifications/preview/${preview}`} style={{ marginTop: 12 }} />
      </section>

      <section className="card">
        <h2>Sent emails</h2>
        {status.log.length ? (
          <table className="table compact">
            <tbody>
              {status.log.map((l, i) => (
                <tr key={i}>
                  <td className="nowrap small">{new Date(l.at).toLocaleString('en-GB')}</td>
                  <td>
                    {l.subject}
                    {l.error && <div className="small amber-text">{l.error}</div>}
                  </td>
                  <td>
                    <span className={`badge ${l.ok ? 'green' : 'red'}`}>{l.ok ? 'sent' : 'failed'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>No emails sent yet.</Empty>
        )}
      </section>
    </div>
  );
}
