const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { parseRank, normalise, rankingFor } = require('../src/logic/rankings');
const { loadRaw, buildCatalog } = require('../src/catalog');
const { buildView } = require('../src/logic/views');
const { emptyState } = require('../src/store');
const { createApp } = require('../app');

const raw = loadRaw(path.join(__dirname, '..', 'data'));
const systems = raw.rankingSystems;

test('parses exact, tied, banded and unranked positions', () => {
  assert.deepStrictEqual(parseRank('107'), { low: 107, high: 107, value: 107 });
  assert.deepStrictEqual(parseRank('=176'), { low: 176, high: 176, value: 176 });
  assert.deepStrictEqual(parseRank('301–350'), { low: 301, high: 350, value: 325.5 });
  assert.deepStrictEqual(parseRank('not ranked'), { notRanked: true });
  assert.strictEqual(parseRank(null), null);
});

test('normalises by list size: #1 = 100, last ≈ 0', () => {
  assert.strictEqual(normalise(1, 2297), 100);
  assert.strictEqual(normalise(2297, 2297), 0);
  assert.strictEqual(normalise(1149, 2297), 50);
});

test('combined score averages the available systems', () => {
  const uni = {
    rankings: [
      { fid: 'x.k.the', system: 'THE', edition: '2027', rank_text: '1', status: 'VERIFIED' },
      { fid: 'x.k.usnews', system: 'USNEWS', edition: '2026-2027', rank_text: '1126', status: 'VERIFIED' },
    ],
  };
  const r = rankingFor(uni, systems);
  assert.strictEqual(r.used, 2);
  assert.strictEqual(r.components[1].score, 50);
  assert.strictEqual(r.score, 75);
  assert.strictEqual(r.verified, true);

  const one = rankingFor({ rankings: [{ fid: 'y.k.the', system: 'THE', edition: null, rank_text: 'not ranked', status: 'EXPECTED' }, uni.rankings[1]] }, systems);
  assert.strictEqual(one.used, 1);
  assert.strictEqual(one.score, 50);

  const none = rankingFor({ rankings: [{ fid: 'z.k.the', system: 'THE', rank_text: 'not ranked', status: 'EXPECTED' }] }, systems);
  assert.strictEqual(none.score, null);
  assert.match(none.summary, /Not in THE or U.S. News/);
});

test('Ukrainian universities are in the catalog with the national admission cycle', () => {
  const view = buildView(buildCatalog(raw), emptyState(raw.studentSeed), '2026-10-05');
  for (const id of ['kse-be-2027', 'ucu-ba-2027', 'ucu-epe-2027', 'naukma-econ-2027', 'naukma-fin-2027']) {
    const a = view.applications.find((x) => x.id === id);
    assert.ok(a, id);
    assert.strictEqual(a.university.country, 'Ukraine');
    assert.ok(a.requirements.some((r) => r.exam && r.exam.includes('NMT')), `${id} requires NMT`);
    assert.ok(!a.requirements.some((r) => r.key === 'ua_certificate_recognition'), `${id} needs no certificate recognition`);
    assert.strictEqual(a.apply.state, 'UNKNOWN'); // 2027 dates not published: never shown as open/closed
  }
  assert.ok(view.exam_plans.some((e) => e.code === 'NMT' && e.required_by.length === 5));
});

test('a ranking can be corrected and verified through the API', async () => {
  const server = createApp({ storeFile: null, mailer: null, today: () => '2026-10-05' }).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const put = await fetch(`${base}/api/facts/maastricht.k.the`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rank_text: '120', edition: '2027', status: 'VERIFIED', source_url: 'https://www.timeshighereducation.com/world-university-rankings' }),
    });
    assert.strictEqual(put.status, 200);
    const view = await put.json();
    const um = view.applications.find((a) => a.id === 'um-ib-2027');
    const the = um.ranking.components.find((c) => c.system === 'THE');
    assert.strictEqual(the.rank_text, '120');
    assert.strictEqual(the.status, 'VERIFIED');
  } finally {
    server.close();
  }
});
