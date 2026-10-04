const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { createApp } = require('../app');
const { loadRaw, buildCatalog } = require('../src/catalog');
const { buildView } = require('../src/logic/views');
const { Store } = require('../src/store');
const { runTool, TOOLS } = require('../src/assistant/tools');
const { createLimiter } = require('../src/assistant/routes');

const raw = loadRaw(path.join(__dirname, '..', 'data'));
const TODAY = '2026-10-04';

function context() {
  const store = new Store(null, raw.studentSeed);
  return { store, today: TODAY, view: buildView(buildCatalog(raw), store.get(), TODAY) };
}

// Fake Anthropic client: replays scripted assistant messages and records requests.
function fakeClient(script) {
  const requests = [];
  return {
    requests,
    beta: {
      messages: {
        stream(params) {
          requests.push(structuredClone(params));
          const message = script.shift();
          const handlers = {};
          return {
            on(event, fn) {
              handlers[event] = fn;
              return this;
            },
            async finalMessage() {
              for (const b of message.content) if (b.type === 'text' && handlers.text) handlers.text(b.text);
              return message;
            },
          };
        },
      },
    },
  };
}

test('every custom tool has a strict object schema', () => {
  for (const t of TOOLS) {
    assert.strictEqual(t.strict, true, t.name);
    assert.strictEqual(t.input_schema.additionalProperties, false, t.name);
  }
});

test('data tools answer from the structured view', () => {
  const ctx = context();
  const programs = runTool('list_programs', {}, ctx);
  assert.ok(programs.length >= 15);
  const ie = runTool('get_program', { id: 'ie-bba-2027' }, ctx);
  assert.strictEqual(ie.university, 'IE University');
  assert.ok(ie.deadlines.some((d) => d.date === '2026-11-06' && d.verification === 'EXPECTED'));
  assert.throws(() => runTool('get_program', { id: 'nope' }, ctx), /No program/);
  const sat = runTool('get_exam_plan', {}, ctx).find((e) => e.code === 'SAT');
  assert.ok(sat.accepted_by.length >= 3);
});

test('save_finding stores a review item once and requires a URL', () => {
  const ctx = context();
  const input = { kind: 'scholarship', title: 'Test grant', university: null, summary: 's', amount: '€1,000', deadline: null, academic_year: '2027/28', url: 'https://example.org/grant' };
  assert.deepStrictEqual(runTool('save_finding', input, ctx).saved, true);
  assert.deepStrictEqual(runTool('save_finding', input, ctx).saved, false);
  assert.throws(() => runTool('save_finding', { ...input, url: 'not a url' }, ctx), /url/);
  const [f] = ctx.store.get().findings;
  assert.strictEqual(f.status, 'needs_review');
  assert.strictEqual(f.found_on, TODAY);
});

test('limiter enforces hourly and daily caps', () => {
  let t = Date.parse('2026-10-04T10:00:00Z');
  const limit = createLimiter({ perHour: 2, perDay: 3, now: () => t });
  assert.strictEqual(limit('a'), null);
  assert.strictEqual(limit('a'), null);
  assert.match(limit('a'), /this hour/);
  assert.strictEqual(limit('b'), null);
  assert.match(limit('c'), /daily limit/);
  t += 24 * 3600_000;
  assert.strictEqual(limit('c'), null);
});

async function chat(base, message) {
  const res = await fetch(`${base}/api/assistant/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) });
  const body = await res.text();
  const events = body.split('\n\n').filter(Boolean).map((chunk) => JSON.parse(chunk.replace(/^data: /, '')));
  return { res, events };
}

test('chat runs the tool loop, streams text and saves history', async () => {
  const client = fakeClient([
    { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'get_overview', input: {} }] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Your next deadline is IE Round 1 on 6 Nov 2026 (not verified).' }] },
  ]);
  const server = createApp({ storeFile: null, today: () => TODAY, assistantClient: client }).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const { res, events } = await chat(base, 'What is next?');
    assert.strictEqual(res.headers.get('content-type'), 'text/event-stream; charset=utf-8');
    assert.ok(events.some((e) => e.type === 'tool' && e.name === 'get_overview'));
    assert.ok(events.some((e) => e.type === 'text' && /IE Round 1/.test(e.text)));
    const done = events.find((e) => e.type === 'done');
    assert.deepStrictEqual(done.history.map((m) => m.role), ['user', 'assistant']);

    // The model received the tool result as JSON, and the request used the agreed settings.
    const second = client.requests[1];
    const toolResult = second.messages.at(-1).content[0];
    assert.strictEqual(toolResult.type, 'tool_result');
    assert.strictEqual(JSON.parse(toolResult.content).today, TODAY);
    assert.strictEqual(second.model, 'claude-opus-5-5');
    assert.strictEqual(second.fallbacks, 'default');
    assert.ok(second.tools.some((t) => t.type === 'web_search_20260209'));
  } finally {
    server.close();
  }
});

test('chat without an API key explains how to configure it', async () => {
  const server = createApp({ storeFile: null, assistantClient: null }).listen(0);
  try {
    const { status } = await fetch(`http://127.0.0.1:${server.address().port}/api/assistant/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hi' }),
    });
    assert.strictEqual(status, 503);
  } finally {
    server.close();
  }
});
