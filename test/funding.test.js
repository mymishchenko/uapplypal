const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { loadRaw, buildCatalog } = require('../src/catalog');
const { buildView } = require('../src/logic/views');
const { appliesToUniversity, eligibility } = require('../src/logic/funding');
const { emptyState } = require('../src/store');

const raw = loadRaw(path.join(__dirname, '..', 'data'));
const catalog = buildCatalog(raw);
const TODAY = '2026-10-05';

function view(categories) {
  const state = emptyState(raw.studentSeed);
  state.student = { ...state.student, personal: { ...state.student.personal, support_categories: categories } };
  return buildView(catalog, state, TODAY);
}
const app = (v, id) => v.applications.find((a) => a.id === id);

test('national schemes apply by country and university type', () => {
  const uni = (id) => catalog.universities.find((u) => u.id === id);
  const scheme = (id) => [...catalog.benefits, ...catalog.scholarships].find((x) => x.fid === `nat.${id}`);
  const compensation = scheme('ua-defender-children-compensation');
  const targeted = scheme('ua-combatant-children-targeted-support');
  assert.ok(appliesToUniversity(compensation, uni('kse')), 'any ownership type');
  assert.ok(!appliesToUniversity(compensation, uni('bocconi')), 'other country');
  assert.ok(appliesToUniversity(targeted, uni('naukma')), 'public university');
  assert.ok(!appliesToUniversity(targeted, uni('ucu')), 'private university excluded');
});

test('status-based support needs the matching profile category', () => {
  const item = { categories: ['combatant_child'] };
  const ua = { personal: { citizenships: 'Ukraine' } };
  assert.deepStrictEqual(eligibility(item, ua), { eligible: false, reason: 'category' });
  assert.ok(eligibility(item, { personal: { ...ua.personal, support_categories: ['combatant_child'] } }).eligible);
  assert.deepStrictEqual(eligibility({ nationality: ['UA'] }, { personal: { citizenships: 'Poland' } }), { eligible: false, reason: 'nationality' });
});

test('benefits are listed for everyone but only count for eligible students', () => {
  const fid = 'nat.ua-defender-children-compensation';
  const none = app(view([]), 'ucu-ba-2027');
  const listed = none.benefits.find((b) => b.fid === fid);
  assert.ok(listed, 'shown in the application');
  assert.strictEqual(listed.eligible, false);
  assert.ok(!none.cost.benefits.some((b) => b.fid === fid), 'not in cost without the category');

  const child = app(view(['combatant_child']), 'ucu-ba-2027');
  assert.strictEqual(child.benefits.find((b) => b.fid === fid).eligible, true);
  assert.ok(child.cost.benefits.some((b) => b.fid === fid));
  // Not announced for 2027/28, so it never changes the base estimate.
  assert.strictEqual(child.cost.student_tuition.annual, child.cost.sticker.annual);
});

test('category-limited scholarships stay out of the best case unless they fit', () => {
  const v = view([]);
  const kse = app(v, 'kse-be-2027');
  const defenders = kse.scholarships.find((s) => s.fid === 'kse.s.kse-foundation-defenders');
  assert.strictEqual(defenders.eligible, false);
  assert.notStrictEqual(kse.cost.best_case && kse.cost.best_case.via, defenders.name);
  assert.ok(v.funding_categories.some((c) => c.code === 'fallen_defender_child'));
});

test('unknown categories in data fail loudly', () => {
  const bad = structuredClone(raw);
  bad.national.schemes[0].categories = ['no_such_category'];
  assert.throws(() => buildCatalog(bad), /unknown category/);
});

test('every tuition figure has a source and every 2027/28 benefit is unconfirmed unless verified', () => {
  for (const i of catalog.intakes) {
    const s = i.tuition.sticker;
    assert.ok(s && s.source, `${i.id} sticker source`);
  }
  for (const b of catalog.benefits) {
    if (b.academic_year === '2027/28' && b.status !== 'VERIFIED') assert.notStrictEqual(b.state, 'ACTIVE', b.fid);
  }
});
