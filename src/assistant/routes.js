// HTTP routes for the assistant. Chat replies stream as Server-Sent Events.
// The site has no login, so usage is capped (per visitor per hour and per day
// overall) to protect the API budget.
const express = require('express');
const { runTurn, createClient, Anthropic } = require('./agent');

const FINDING_STATUSES = ['needs_review', 'accepted', 'dismissed'];
const MAX_HISTORY_MESSAGES = 40;

function createLimiter({ perHour, perDay, now = () => Date.now() }) {
  const hits = new Map(); // ip -> timestamps (last hour)
  let day = null;
  let dayCount = 0;
  return (ip) => {
    const t = now();
    const today = new Date(t).toISOString().slice(0, 10);
    if (today !== day) {
      day = today;
      dayCount = 0;
    }
    const recent = (hits.get(ip) || []).filter((x) => t - x < 3600_000);
    if (recent.length >= perHour) return 'Too many messages this hour. Try again later.';
    if (dayCount >= perDay) return 'The assistant has reached its daily limit. Try again tomorrow.';
    recent.push(t);
    hits.set(ip, recent);
    dayCount++;
    return null;
  };
}

function createAssistantRouter({ store, getContext, client = createClient(), limits = {} }) {
  const router = express.Router();
  const limit = createLimiter({
    perHour: limits.perHour ?? (Number(process.env.ASSISTANT_HOURLY_LIMIT) || 30),
    perDay: limits.perDay ?? (Number(process.env.ASSISTANT_DAILY_LIMIT) || 150),
  });
  let busy = false;

  const state = () => {
    const s = store.get();
    return { configured: !!client, history: (s.assistant && s.assistant.history) || [], findings: s.findings || [] };
  };

  router.get('/assistant', (req, res) => res.json(state()));

  router.post('/assistant/reset', (req, res) => {
    store.update((st) => {
      st.assistant = { history: [] };
    });
    res.json(state());
  });

  router.put('/findings/:id', (req, res) => {
    const { status } = req.body || {};
    if (!FINDING_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    if (!(store.get().findings || []).some((f) => f.id === req.params.id)) return res.status(404).json({ error: 'Unknown finding' });
    store.update((st) => {
      st.findings = st.findings.map((f) => (f.id === req.params.id ? { ...f, status } : f));
    });
    res.json(state());
  });

  router.post('/assistant/chat', async (req, res) => {
    const text = String((req.body && req.body.message) || '').trim();
    if (!text) return res.status(400).json({ error: 'Empty message' });
    if (text.length > 8000) return res.status(400).json({ error: 'Message too long' });
    if (!client) return res.status(503).json({ error: 'The assistant is not configured yet: add ANTHROPIC_API_KEY (see docs/DEPLOY.md).' });
    if (busy) return res.status(409).json({ error: 'The assistant is still answering the previous message.' });
    const blocked = limit(req.ip);
    if (blocked) return res.status(429).json({ error: blocked });

    busy = true;
    const controller = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) controller.abort();
    });
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    });
    const emit = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);

    try {
      const history = state().history;
      const reply = await runTurn({ client, getContext, history, userText: text, emit, signal: controller.signal });
      store.update((st) => {
        const prev = (st.assistant && st.assistant.history) || [];
        st.assistant = {
          history: [...prev, { role: 'user', text }, { role: 'assistant', text: reply || '(no answer)' }].slice(-MAX_HISTORY_MESSAGES),
        };
      });
      emit({ type: 'done', ...state() });
    } catch (err) {
      if (!controller.signal.aborted) emit({ type: 'error', message: describeError(err) });
    } finally {
      busy = false;
      res.end();
    }
  });

  return router;
}

function describeError(err) {
  if (err instanceof Anthropic.AuthenticationError) return 'The API key was rejected. Check ANTHROPIC_API_KEY.';
  if (err instanceof Anthropic.PermissionDeniedError) return 'The API key is not allowed to use this model.';
  if (err instanceof Anthropic.RateLimitError) return 'The AI service is busy (rate limited). Try again in a minute.';
  if (err instanceof Anthropic.APIConnectionError) return 'Could not reach the AI service from the server.';
  if (err instanceof Anthropic.APIError) return `AI service error (${err.status}). Try again.`;
  console.error('assistant error', err);
  return 'Something went wrong while answering. Try again.';
}

module.exports = { createAssistantRouter, createLimiter };
