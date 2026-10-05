import { useEffect, useState } from 'react';
import { useApp } from '../state.jsx';

const INTERESTS = ['business', 'entrepreneurship', 'economics', 'management', 'finance', 'marketing', 'international business', 'technology', 'data science'];
const TESTS = [
  ['SAT', 'SAT'],
  ['ACT', 'ACT'],
  ['IELTS', 'IELTS'],
  ['TOEFL', 'TOEFL'],
  ['DUOLINGO', 'Duolingo English Test'],
  ['NMT', 'NMT (Ukraine)'],
];
const ACTIVITY_TYPES = ['entrepreneurship', 'employment', 'volunteering', 'summer school', 'competition', 'leadership', 'extracurricular', 'award'];

const SECTIONS = {
  personal: [
    ['name', 'Name'],
    ['citizenships', 'Citizenship(s)'],
    ['residence_country', 'Country of residence'],
    ['date_of_birth', 'Date of birth', 'date'],
    ['entry_year', 'Intended entry year'],
    ['target_intake', 'Target intake'],
  ],
  education: [
    ['school', 'Current school'],
    ['school_country', 'Country of school'],
    ['school_system', 'School system'],
    ['current_grade', 'Current grade / year'],
    ['graduation_date', 'Expected graduation (YYYY-MM)'],
    ['expected_diploma', 'Expected diploma'],
    ['gpa', 'Average grade / GPA'],
    ['grading_scale', 'Grading scale'],
    ['math', 'Mathematics courses & grades'],
    ['english', 'English courses & grades'],
    ['other_subjects', 'Other relevant subjects'],
  ],
  preferences: [
    ['countries', 'Preferred countries (comma-separated)'],
    ['cities', 'Preferred cities'],
    ['max_tuition', 'Maximum tuition per year (€)'],
    ['max_total_budget', 'Maximum total budget per year (€)'],
    ['instruction_language', 'Language of instruction'],
    ['university_size', 'University size'],
    ['campus_preference', 'Campus / city preference'],
  ],
};

export default function Profile() {
  const { view, mutate } = useApp();
  const [s, setS] = useState(view.student);
  const [saved, setSaved] = useState(true);
  useEffect(() => {
    setS(view.student);
    setSaved(true);
  }, [view.student]);

  const change = (next) => {
    setS(next);
    setSaved(false);
  };
  const setField = (section, key) => (e) => change({ ...s, [section]: { ...s[section], [key]: e.target.value } });
  const setList = (key, i, field) => (e) => {
    const list = s[key].slice();
    list[i] = { ...list[i], [field]: e.target.value };
    change({ ...s, [key]: list });
  };
  const addRow = (key, row) => change({ ...s, [key]: [...(s[key] || []), row] });
  const removeRow = (key, i) => change({ ...s, [key]: s[key].filter((_, j) => j !== i) });
  const setTest = (code, field) => (e) => change({ ...s, tests: { ...s.tests, [code]: { ...(s.tests[code] || {}), [field]: e.target.value } } });
  const cats = s.personal.support_categories || [];
  const toggleCategory = (c) =>
    change({ ...s, personal: { ...s.personal, support_categories: cats.includes(c) ? cats.filter((x) => x !== c) : [...cats, c] } });
  const toggleInterest = (i) => change({ ...s, interests: s.interests.includes(i) ? s.interests.filter((x) => x !== i) : [...s.interests, i] });

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Student profile</h1>
          <p className="muted small">Used for matching, cost (e.g. Ukrainian benefits) and the exam planner.</p>
        </div>
        <button className="primary" disabled={saved} onClick={() => mutate('/student', { method: 'PUT', body: s })}>
          {saved ? 'Saved' : 'Save profile'}
        </button>
      </header>

      <div className="grid-2">
        <Section title="Personal" fields={SECTIONS.personal} data={s.personal} onChange={(k) => setField('personal', k)} />
        <Section title="Preferences" fields={SECTIONS.preferences} data={s.preferences} onChange={(k) => setField('preferences', k)} />
      </div>
      <Section title="Education" fields={SECTIONS.education} data={s.education} onChange={(k) => setField('education', k)} />

      <section className="card">
        <h2>Family & residence status</h2>
        <p className="muted small">
          Some support depends on status, e.g. Ukrainian state compensation of tuition for children of combatants (УБД) or fallen defenders, or university grants for IDPs. Tick what
          applies; it is only used to show which scholarships fit you.
        </p>
        <div className="chips cats">
          {(view.funding_categories || []).map((c) => (
            <button key={c.code} className={`chip ${cats.includes(c.code) ? 'on' : ''}`} title={c.description} onClick={() => toggleCategory(c.code)}>
              {c.label}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Interests</h2>
        <div className="chips">
          {[...new Set([...INTERESTS, ...s.interests])].map((i) => (
            <button key={i} className={`chip ${s.interests.includes(i) ? 'on' : ''}`} onClick={() => toggleInterest(i)}>
              {i}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Languages</h2>
        <div className="table-wrap">
          <table className="table compact">
            <thead>
              <tr>
                <th>Language</th>
                <th>Level (e.g. B2, C1, Native)</th>
                <th>Certificate</th>
                <th>Score</th>
                <th>Date</th>
                <th>Expiry</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {s.languages.map((l, i) => (
                <tr key={i}>
                  {['language', 'level', 'certificate', 'score'].map((f) => (
                    <td key={f}>
                      <input value={l[f] || ''} onChange={setList('languages', i, f)} />
                    </td>
                  ))}
                  <td>
                    <input type="date" value={l.date || ''} onChange={setList('languages', i, 'date')} />
                  </td>
                  <td>
                    <input type="date" value={l.expiry || ''} onChange={setList('languages', i, 'expiry')} />
                  </td>
                  <td>
                    <button className="link" onClick={() => removeRow('languages', i)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={() => addRow('languages', { language: '', level: '' })}>+ Add language</button>
      </section>

      <section className="card">
        <h2>Standardized tests</h2>
        <div className="table-wrap">
          <table className="table compact">
            <thead>
              <tr>
                <th>Test</th>
                <th>Status</th>
                <th>Test date</th>
                <th>Score</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              {TESTS.map(([code, name]) => {
                const t = s.tests[code] || {};
                return (
                  <tr key={code}>
                    <td>{name}</td>
                    <td>
                      <select value={t.status || ''} onChange={setTest(code, 'status')}>
                        <option value="">Not planned</option>
                        <option value="planned">Planned</option>
                        <option value="registered">Registered</option>
                        <option value="taken">Taken</option>
                      </select>
                    </td>
                    <td>
                      <input type="date" value={t.date || ''} onChange={setTest(code, 'date')} />
                    </td>
                    <td>
                      <input value={t.score || ''} onChange={setTest(code, 'score')} />
                    </td>
                    <td>
                      <input value={t.target || ''} onChange={setTest(code, 'target')} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Activities</h2>
        {(s.activities || []).map((a, i) => (
          <div key={i} className="activity">
            <select value={a.type || ''} onChange={setList('activities', i, 'type')}>
              <option value="">Type…</option>
              {ACTIVITY_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <input placeholder="Title / organisation" value={a.title || ''} onChange={setList('activities', i, 'title')} />
            <input placeholder="Dates" value={a.dates || ''} onChange={setList('activities', i, 'dates')} />
            <textarea rows={2} placeholder="What you did, results, numbers" value={a.description || ''} onChange={setList('activities', i, 'description')} />
            <button className="link" onClick={() => removeRow('activities', i)}>
              Remove
            </button>
          </div>
        ))}
        <button onClick={() => addRow('activities', { type: '', title: '', dates: '', description: '' })}>+ Add activity</button>
      </section>
    </div>
  );
}

function Section({ title, fields, data, onChange }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      <div className="form-grid">
        {fields.map(([key, name, type]) => (
          <label key={key}>
            {name}
            <input type={type || 'text'} value={(data && data[key]) ?? ''} onChange={onChange(key)} />
          </label>
        ))}
      </div>
    </section>
  );
}
