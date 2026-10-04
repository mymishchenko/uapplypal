const express = require('express');
const { buildCatalog } = require('./catalog');
const { buildView, APPLICATION_STATUSES, REQUIREMENT_STATUSES } = require('./logic/views');
const { todayISO } = require('./logic/dates');

const SCHOLARSHIP_PROGRESS = ['not_started', 'considering', 'applying', 'applied', 'awarded', 'rejected'];
const DOC_FIELDS = { status: ['missing', 'in_progress', 'ready', 'expired'], translation: ['not_needed', 'needed', 'done', 'certified'], apostille: ['unknown', 'not_needed', 'needed', 'done'] };
const EXAM_STATUSES = ['not_registered', 'registered', 'taken', 'not_needed'];
const FACT_FIELDS = ['date', 'date_end', 'date_text', 'amount', 'status', 'note', 'source_url', 'source_title', 'state', 'availability'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

class BadRequest extends Error {}

function createApi({ raw, store, today = () => todayISO() }) {
  const router = express.Router();

  const catalog = () => buildCatalog(raw, store.get().overrides);
  const view = () => buildView(catalog(), store.get(), today());
  const send = (res) => res.json(view());

  const oneOf = (value, allowed, name) => {
    if (value !== undefined && !allowed.includes(value)) throw new BadRequest(`Invalid ${name}`);
  };
  const dateOrEmpty = (value, name) => {
    if (value !== undefined && value !== '' && value !== null && !ISO_DATE.test(value)) throw new BadRequest(`${name} must be YYYY-MM-DD`);
  };

  router.get('/bootstrap', (req, res) => send(res));

  router.put('/student', (req, res) => {
    const s = req.body;
    if (!s || typeof s !== 'object' || !s.personal) throw new BadRequest('Invalid profile');
    store.update((st) => {
      st.student = s;
    });
    send(res);
  });

  router.put('/applications/:id', (req, res) => {
    const { id } = req.params;
    if (!catalog().intakes.some((i) => i.id === id)) throw new BadRequest('Unknown intake');
    const { status, notes } = req.body || {};
    oneOf(status, APPLICATION_STATUSES, 'status');
    store.update((st) => {
      st.applications[id] = { ...(st.applications[id] || {}), ...(status !== undefined && { status }), ...(notes !== undefined && { notes: String(notes) }) };
    });
    send(res);
  });

  router.put('/requirements/:fid', (req, res) => {
    const { fid } = req.params;
    if (!fid.includes('.r.') || !catalog().facts[fid]) throw new BadRequest('Unknown requirement');
    const { progress } = req.body || {};
    oneOf(progress, REQUIREMENT_STATUSES, 'progress');
    store.update((st) => {
      st.requirementStatus[fid] = progress;
    });
    send(res);
  });

  router.put('/scholarships/:fid', (req, res) => {
    const { fid } = req.params;
    if (!fid.includes('.s.') || !catalog().facts[fid]) throw new BadRequest('Unknown scholarship');
    const { progress } = req.body || {};
    oneOf(progress, SCHOLARSHIP_PROGRESS, 'progress');
    store.update((st) => {
      st.scholarshipStatus[fid] = progress;
    });
    send(res);
  });

  router.put('/documents/:type', (req, res) => {
    const { type } = req.params;
    if (!/^[a-z_]+$/.test(type)) throw new BadRequest('Invalid document type');
    const body = req.body || {};
    for (const [field, allowed] of Object.entries(DOC_FIELDS)) oneOf(body[field], allowed, field);
    dateOrEmpty(body.expires, 'expires');
    store.update((st) => {
      st.documents[type] = { ...(st.documents[type] || {}), ...pick(body, ['status', 'translation', 'apostille', 'expires', 'notes']) };
    });
    send(res);
  });

  router.put('/exams/:code', (req, res) => {
    const { code } = req.params;
    if (!raw.exams.some((e) => e.code === code)) throw new BadRequest('Unknown exam');
    const body = req.body || {};
    oneOf(body.status, EXAM_STATUSES, 'status');
    dateOrEmpty(body.test_date, 'test_date');
    dateOrEmpty(body.registration_deadline, 'registration_deadline');
    store.update((st) => {
      st.exams[code] = { ...(st.exams[code] || {}), ...pick(body, ['status', 'test_date', 'registration_deadline', 'diagnostic', 'score', 'target', 'weekly_hours']) };
    });
    send(res);
  });

  // Mark a fact as verified against its official source (today).
  router.post('/facts/:fid/verify', (req, res) => {
    const { fid } = req.params;
    if (!catalog().facts[fid]) throw new BadRequest('Unknown fact');
    store.update((st) => {
      st.overrides[fid] = { ...(st.overrides[fid] || {}), status: 'VERIFIED', checked: today() };
    });
    send(res);
  });

  // Edit a fact (date, amount, status, source) for this deployment.
  router.put('/facts/:fid', (req, res) => {
    const { fid } = req.params;
    if (!catalog().facts[fid]) throw new BadRequest('Unknown fact');
    const body = pick(req.body || {}, FACT_FIELDS);
    oneOf(body.status, ['VERIFIED', 'EXPECTED', 'UNKNOWN'], 'status');
    dateOrEmpty(body.date, 'date');
    dateOrEmpty(body.date_end, 'date_end');
    if (body.date === '') body.date = null;
    if (body.amount !== undefined) body.amount = body.amount === '' || body.amount === null ? null : Number(body.amount);
    if (body.amount !== undefined && body.amount !== null && !Number.isFinite(body.amount)) throw new BadRequest('amount must be a number');
    if (body.source_url && !/^https?:\/\//.test(body.source_url)) throw new BadRequest('source_url must start with http(s)://');
    store.update((st) => {
      st.overrides[fid] = { ...(st.overrides[fid] || {}), ...body, checked: today() };
    });
    send(res);
  });

  router.delete('/facts/:fid/override', (req, res) => {
    store.update((st) => {
      delete st.overrides[req.params.fid];
    });
    send(res);
  });

  router.use((err, req, res, next) => {
    if (err instanceof BadRequest) return res.status(400).json({ error: err.message });
    next(err);
  });

  return router;
}

function pick(obj, keys) {
  return Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));
}

module.exports = { createApi };
