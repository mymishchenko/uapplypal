const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { loadRaw, buildCatalog } = require('../src/catalog');
const { canApplyNow } = require('../src/logic/windows');
const { buildView } = require('../src/logic/views');
const { emptyState } = require('../src/store');

const raw = loadRaw(path.join(__dirname, '..', 'data'));
const TODAY = '2026-10-04';

function intake(deadlines, windows = [{ id: 'w', label: 'Application', opens: 'o', closes: 'c' }]) {
  return { deadlines, windows };
}

test('reference data loads and every fact has a valid source and status', () => {
  const catalog = buildCatalog(raw);
  assert.ok(catalog.intakes.length >= 15);
  for (const fact of Object.values(catalog.facts)) {
    assert.ok(['VERIFIED', 'EXPECTED', 'UNKNOWN'].includes(fact.status), fact.fid);
    assert.ok(catalog.sources[fact.source], `${fact.fid} has a source`);
  }
});

test('program and intake are separate records', () => {
  const catalog = buildCatalog(raw);
  for (const i of catalog.intakes) {
    assert.ok(i.academic_year, `${i.id} has an academic year`);
    assert.ok(catalog.programs.some((p) => p.id === i.program_id));
  }
});

test('unverified dates never produce OPEN / NOT YET OPEN / CLOSED', () => {
  const r = canApplyNow(intake([
    { id: 'o', date: '2026-09-01', status: 'EXPECTED' },
    { id: 'c', date: '2026-12-01', status: 'EXPECTED' },
  ]), TODAY);
  assert.strictEqual(r.state, 'UNKNOWN');
  assert.strictEqual(r.likely, 'OPEN');
});

test('verified window states', () => {
  const open = canApplyNow(intake([
    { id: 'o', date: '2026-09-01', status: 'VERIFIED' },
    { id: 'c', date: '2026-12-01', status: 'VERIFIED' },
  ]), TODAY);
  assert.strictEqual(open.state, 'OPEN');

  const notYet = canApplyNow(intake([
    { id: 'o', date: '2026-11-25', status: 'VERIFIED' },
    { id: 'c', date: '2027-01-26', status: 'VERIFIED' },
  ]), TODAY);
  assert.strictEqual(notYet.state, 'NOT_YET_OPEN');

  const closed = canApplyNow(intake([
    { id: 'o', date: '2026-09-01', status: 'VERIFIED' },
    { id: 'c', date: '2026-09-29', status: 'VERIFIED' },
  ]), TODAY);
  assert.strictEqual(closed.state, 'CLOSED');
});

test('an open portal alone (opens verified, close date passed) is not OPEN', () => {
  const r = canApplyNow(intake([
    { id: 'o', already_open: true, status: 'VERIFIED' },
    { id: 'c', date: '2026-09-01', status: 'VERIFIED' },
  ]), TODAY);
  assert.strictEqual(r.state, 'CLOSED');
});

test('Bocconi: early session closed + winter not yet open (both verified) → NOT YET OPEN', () => {
  const overrides = {};
  for (const id of ['early-opens', 'early-close', 'winter-opens', 'winter-close']) overrides[`bocconi-business-2027.d.${id}`] = { status: 'VERIFIED' };
  const catalog = buildCatalog(raw, overrides);
  const bocconi = catalog.intakes.find((i) => i.id === 'bocconi-business-2027');
  const r = canApplyNow(bocconi, TODAY);
  assert.strictEqual(r.state, 'NOT_YET_OPEN');
  assert.match(r.detail, /Winter Session opens 25 Nov 2026/);
});

test('a benefit that is unknown for the intake year does not lower the base cost', () => {
  const view = buildView(buildCatalog(raw), emptyState(raw.studentSeed), TODAY);
  const wu = view.applications.find((a) => a.id === 'wu-bbe-2027');
  assert.strictEqual(wu.cost.student_tuition.annual, wu.cost.sticker.annual);
  assert.strictEqual(wu.cost.best_case.tuition, 0);
  assert.strictEqual(wu.cost.best_case.certainty, 'unconfirmed');
});

test('a verified active benefit lowers the student tuition', () => {
  const overrides = { 'wu-vienna.b.ua-waiver-2027': { state: 'ACTIVE', status: 'VERIFIED' } };
  const view = buildView(buildCatalog(raw, overrides), emptyState(raw.studentSeed), TODAY);
  const wu = view.applications.find((a) => a.id === 'wu-bbe-2027');
  assert.strictEqual(wu.cost.student_tuition.annual, 0);
});

test('Ukraine benefits do not apply to non-Ukrainian students', () => {
  const state = emptyState(raw.studentSeed);
  state.student.personal.citizenships = 'Poland';
  const overrides = { 'wu-vienna.b.ua-waiver-2027': { state: 'ACTIVE', status: 'VERIFIED' } };
  const view = buildView(buildCatalog(raw, overrides), state, TODAY);
  const wu = view.applications.find((a) => a.id === 'wu-bbe-2027');
  assert.strictEqual(wu.cost.student_tuition.annual, wu.cost.sticker.annual);
});

test('exam planner consolidates SAT across applications', () => {
  const view = buildView(buildCatalog(raw), emptyState(raw.studentSeed), TODAY);
  const sat = view.exam_plans.find((e) => e.code === 'SAT');
  assert.ok(sat.accepted_by.length + sat.required_by.length >= 3);
});

test('dashboard next deadline is the earliest upcoming closing deadline', () => {
  const view = buildView(buildCatalog(raw), emptyState(raw.studentSeed), TODAY);
  assert.strictEqual(view.dashboard.next_deadline.university, 'IE University');
  assert.strictEqual(view.dashboard.next_deadline.date, '2026-11-06');
});
