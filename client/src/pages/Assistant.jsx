import { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useApp } from '../state.jsx';
import { request } from '../api.js';
import { Empty } from '../components/ui.jsx';
import { label } from '../format.js';

const SUGGESTIONS = [
  'What should I work on this week?',
  'Which universities can I apply to right now?',
  'Which applications require the SAT, and by when do I need a score?',
  'Find scholarships for 2027/28 that fit my profile and save the best ones.',
  'Compare Bocconi and WU Vienna for me.',
  'Rebuild my CV for business programs from my profile.',
  'Make me a study plan for the SAT with free and edX resources.',
  'Check for new 2027/28 dates for programs that are missing deadlines.',
];

const TOOL_LABELS = {
  get_overview: 'Checking your dashboard',
  list_programs: 'Looking at your programs',
  get_program: 'Reading program details',
  list_deadlines: 'Checking deadlines',
  list_scholarships: 'Checking scholarships',
  get_exam_plan: 'Checking your exam plan',
  get_profile: 'Reading your profile',
  list_findings: 'Checking saved findings',
  save_finding: 'Saving a finding for your review',
  web_search: 'Searching the web',
  web_fetch: 'Reading a web page',
};

function Markdown({ text }) {
  const html = DOMPurify.sanitize(marked.parse(text || ''), { ADD_ATTR: ['target'] }).replace(/<a /g, '<a target="_blank" rel="noreferrer" ');
  return <div className="md" dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function Assistant() {
  const { mutate } = useApp();
  const [state, setState] = useState(null);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(null); // { user, text, activity }
  const [error, setError] = useState(null);
  const bottom = useRef(null);

  useEffect(() => {
    request('/assistant').then(setState, (e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (bottom.current) bottom.current.scrollIntoView({ block: 'end' });
  }, [state, pending]);

  const send = async (message) => {
    const text = message.trim();
    if (!text || pending) return;
    setInput('');
    setError(null);
    setPending({ user: text, text: '', activity: 'Thinking' });
    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop();
        for (const part of parts) {
          if (!part.startsWith('data: ')) continue;
          const event = JSON.parse(part.slice(6));
          if (event.type === 'text') setPending((p) => ({ ...p, text: p.text + event.text, activity: null }));
          else if (event.type === 'tool') setPending((p) => ({ ...p, activity: TOOL_LABELS[event.name] || 'Working' }));
          else if (event.type === 'error') setError(event.message);
          else if (event.type === 'done') {
            setState({ configured: event.configured, history: event.history, findings: event.findings });
            mutate('/bootstrap'); // refresh dashboard counts (findings)
          }
        }
      }
    } catch (e) {
      setError(e.message);
      setInput(text);
    } finally {
      setPending(null);
    }
  };

  const reset = async () => setState(await request('/assistant/reset', { method: 'POST' }));
  const review = async (id, status) => setState(await request(`/findings/${id}`, { method: 'PUT', body: { status } }));

  if (!state) return <p className="muted">{error || 'Loading…'}</p>;
  const findings = state.findings.slice().sort((a, b) => order(a.status) - order(b.status));

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Assistant</h1>
          <p className="muted small">Answers from your UApplyPal data and researches the web. Anything it finds is saved for your review, never marked verified.</p>
        </div>
        {state.history.length > 0 && <button onClick={reset}>New conversation</button>}
      </header>

      {!state.configured && (
        <div className="note">
          The assistant needs an Anthropic API key on the server. Add it as the <code>ANTHROPIC_API_KEY</code> secret in GitHub (see docs/DEPLOY.md). The next deploy
          turns it on.
        </div>
      )}

      <div className="assistant-layout">
        <section className="card chat">
          <div className="messages">
            {state.history.length === 0 && !pending && (
              <div className="suggestions">
                <p className="muted">Try asking:</p>
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="chip" disabled={!state.configured} onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}
            {state.history.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>
                {m.role === 'user' ? <p>{m.text}</p> : <Markdown text={m.text} />}
              </div>
            ))}
            {pending && (
              <>
                <div className="msg user">
                  <p>{pending.user}</p>
                </div>
                <div className="msg assistant">
                  {pending.text && <Markdown text={pending.text} />}
                  {pending.activity && <p className="muted small activity">{pending.activity}…</p>}
                </div>
              </>
            )}
            {error && <div className="alert">{error}</div>}
            <div ref={bottom} />
          </div>
          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <textarea
              rows={2}
              value={input}
              placeholder={state.configured ? 'Ask about deadlines, costs, scholarships, your CV…' : 'Assistant not configured yet'}
              disabled={!state.configured || !!pending}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
            />
            <button className="primary" disabled={!state.configured || !!pending || !input.trim()}>
              Send
            </button>
          </form>
        </section>

        <section className="card findings">
          <h2>Findings to review ({findings.filter((f) => f.status === 'needs_review').length})</h2>
          {findings.length === 0 ? (
            <Empty>Ask the assistant to research scholarships or programs. What it finds appears here.</Empty>
          ) : (
            findings.map((f) => (
              <div key={f.id} className={`finding ${f.status}`}>
                <div className="row">
                  <span className="badge subtle blue">{label(f.kind)}</span>
                  <span className={`badge ${f.status === 'accepted' ? 'green' : f.status === 'dismissed' ? 'grey' : 'amber'}`}>{label(f.status)}</span>
                </div>
                <strong>{f.title}</strong>
                {f.university && <div className="muted small">{f.university}</div>}
                <div className="small">{f.summary}</div>
                <div className="small muted">
                  {[f.amount, f.deadline && `deadline ${f.deadline}`, f.academic_year].filter(Boolean).join(' · ')}
                </div>
                <div className="row small">
                  <a href={f.url} target="_blank" rel="noreferrer">
                    Source ↗
                  </a>
                  <span className="muted">found {f.found_on}</span>
                  {f.status !== 'accepted' && (
                    <button className="link" onClick={() => review(f.id, 'accepted')}>
                      Keep
                    </button>
                  )}
                  {f.status !== 'dismissed' && (
                    <button className="link" onClick={() => review(f.id, 'dismissed')}>
                      Dismiss
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}

function order(status) {
  return { needs_review: 0, accepted: 1, dismissed: 2 }[status] ?? 3;
}
