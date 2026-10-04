const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../app');

async function withServer(options, fn) {
  const server = createApp({ storeFile: null, today: () => '2026-10-04', ...options }).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base);
  } finally {
    server.close();
  }
}

const auth = {};

test('health is public', async () => {
  await withServer({}, async (base) => {
    const res = await fetch(`${base}/api/health`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual((await res.json()).status, 'ok');
  });
});

test('app opens without a password', async () => {
  await withServer({}, async (base) => {
    assert.strictEqual((await fetch(`${base}/api/bootstrap`)).status, 200);
  });
});

test('verifying IE dates turns "Can I apply now?" into OPEN, and it persists', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uapplypal-'));
  const storeFile = path.join(dir, 'store.json');
  await withServer({ storeFile }, async (base) => {
    for (const fid of ['ie-bba-2027.d.opens', 'ie-bba-2027.d.r3']) {
      const res = await fetch(`${base}/api/facts/${fid}/verify`, { method: 'POST', headers: auth });
      assert.strictEqual(res.status, 200);
    }
    const view = await (await fetch(`${base}/api/bootstrap`, { headers: auth })).json();
    const ie = view.applications.find((a) => a.id === 'ie-bba-2027');
    assert.strictEqual(ie.apply.state, 'OPEN');
  });
  const saved = JSON.parse(fs.readFileSync(storeFile, 'utf8'));
  assert.strictEqual(saved.overrides['ie-bba-2027.d.r3'].status, 'VERIFIED');
  assert.strictEqual(saved.overrides['ie-bba-2027.d.r3'].checked, '2026-10-04');
});

test('invalid input is rejected', async () => {
  await withServer({}, async (base) => {
    const put = (url, body) => fetch(`${base}/api${url}`, { method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.strictEqual((await put('/applications/ie-bba-2027', { status: 'bogus' })).status, 400);
    assert.strictEqual((await put('/applications/nope', { status: 'preparing' })).status, 400);
    assert.strictEqual((await put('/facts/ie-bba-2027.d.r1', { date: '6/11/2026' })).status, 400);
    assert.strictEqual((await put('/facts/ie-bba-2027.d.r1', { source_url: 'javascript:alert(1)' })).status, 400);
    assert.strictEqual((await put('/applications/ie-bba-2027', { status: 'preparing' })).status, 200);
  });
});
