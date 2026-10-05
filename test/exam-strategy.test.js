const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { examStrategy } = require('../src/logic/examStrategy');
const { loadRaw, buildCatalog } = require('../src/catalog');
const { buildView } = require('../src/logic/views');
const { emptyState } = require('../src/store');

const exams = [
  { code: 'SAT', name: 'SAT', kind: 'standardized', preference: 1 },
  { code: 'ACT', name: 'ACT', kind: 'standardized', preference: 2 },
  { code: 'UNI1', name: 'Uni 1 test', kind: 'university', preference: 5 },
  { code: 'UNI2', name: 'Uni 2 test', kind: 'university', preference: 5 },
  { code: 'NMT', name: 'NMT', kind: 'standardized', preference: 0 },
  { code: 'DUOLINGO', name: 'Duolingo', kind: 'language', preference: 0 },
  { code: 'IELTS', name: 'IELTS', kind: 'language', preference: 1 },
  { code: 'TOEFL', name: 'TOEFL', kind: 'language', preference: 2 },
];

const app = (id, reqs, status = 'not_started') => ({
  id,
  active: status !== 'not_applying',
  university: { short_name: id },
  program: { name: 'P' },
  next_deadline: null,
  requirements: reqs.map(([exam, category = 'tests']) => ({ exam, category, progress: 'not_started' })),
});

test('an exam with no alternative is a must', () => {
  const s = examStrategy({ applications: [app('KSE', [[['NMT']]]), app('NaUKMA', [[['NMT']]])], exams });
  assert.deepStrictEqual(s.must.map((m) => [m.code, m.count]), [['NMT', 2]]);
  assert.strictEqual(s.recommended.length, 0);
});

test('SAT accepted instead of most own tests is recommended; own tests are alternatives', () => {
  const s = examStrategy({
    applications: [app('A', [[['SAT', 'UNI1']]]), app('B', [[['SAT', 'ACT', 'UNI2']]]), app('C', [[['UNI2', 'SAT']]])],
    exams,
  });
  assert.strictEqual(s.recommended[0].code, 'SAT');
  assert.strictEqual(s.recommended[0].count, 3);
  const uni2 = s.recommended[0].alternatives.find((a) => a.code === 'UNI2');
  assert.strictEqual(uni2.programs.length, 2);
  assert.strictEqual(uni2.not_for.length, 1);
});

test('Duolingo is recommended only when every application accepts it', () => {
  const everywhere = examStrategy({
    applications: ['A', 'B', 'C'].map((id) => app(id, [[['IELTS', 'TOEFL', 'DUOLINGO'], 'language']])),
    exams,
  });
  assert.strictEqual(everywhere.recommended[0].code, 'DUOLINGO');
  assert.ok(everywhere.recommended[0].alternatives.every((a) => a.not_for.length === 0));

  const mostly = examStrategy({
    applications: [...['A', 'B'].map((id) => app(id, [[['IELTS', 'TOEFL', 'DUOLINGO'], 'language']])), app('WU', [[['IELTS', 'TOEFL'], 'language']])],
    exams,
  });
  assert.strictEqual(mostly.recommended[0].code, 'IELTS');
  const det = mostly.recommended[0].alternatives.find((a) => a.code === 'DUOLINGO');
  assert.deepStrictEqual(det.not_for, ['WU: P']);
});

test('an exam already taken wins a tie', () => {
  const s = examStrategy({
    applications: ['A', 'B'].map((id) => app(id, [[['IELTS', 'TOEFL'], 'language']])),
    exams,
    plans: { TOEFL: { status: 'taken' } },
  });
  assert.strictEqual(s.recommended[0].code, 'TOEFL');
});

test('applications marked not applying are ignored', () => {
  const s = examStrategy({ applications: [app('A', [[['NMT']]], 'not_applying')], exams });
  assert.strictEqual(s.must.length, 0);
});

test('real portfolio: NMT is a must, SAT and IELTS are recommended', () => {
  const raw = loadRaw(path.join(__dirname, '..', 'data'));
  const view = buildView(buildCatalog(raw), emptyState(raw.studentSeed), '2026-10-05');
  const st = view.exam_strategy;
  assert.ok(st.must.some((m) => m.code === 'NMT' && m.count === 5));
  assert.deepStrictEqual(st.recommended.map((r) => r.code).sort(), ['IELTS', 'SAT']);
  const det = st.recommended.find((r) => r.code === 'IELTS').alternatives.find((a) => a.code === 'DUOLINGO');
  assert.ok(det.not_for.length > 0, 'Duolingo is not confirmed everywhere, so it stays an alternative');
  assert.ok(view.dashboard.actions.some((a) => a.title === 'Register for SAT (Digital)'));
  assert.ok(!view.dashboard.actions.some((a) => a.title.includes('ACT')));
});
