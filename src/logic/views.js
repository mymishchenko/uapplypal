// Assembles everything the UI shows from catalog (reference data) + state
// (personal data). All derived logic lives here or in sibling modules; the
// client only renders.
const { daysBetween } = require('./dates');
const { canApplyNow, nextClosingDeadline, CLOSING_TYPES } = require('./windows');
const { costFor } = require('./cost');
const { assess } = require('./match');
const { rankingFor } = require('./rankings');

const APPLICATION_STATUSES = ['not_started', 'preparing', 'ready', 'submitted', 'offer', 'waitlisted', 'rejected', 'withdrawn', 'not_applying'];
const INACTIVE = new Set(['withdrawn', 'not_applying', 'rejected']);
const REQUIREMENT_STATUSES = ['not_started', 'in_progress', 'ready', 'submitted', 'verified', 'problem', 'na'];
const DONE_REQ = new Set(['ready', 'submitted', 'verified', 'na']);
const ACTION_DEADLINE_TYPES = new Set([...CLOSING_TYPES, 'document_submission', 'entrance_exam', 'scholarship', 'financial_aid', 'test_registration', 'interview', 'enrollment', 'deposit']);

function priorityFor(days) {
  if (days == null) return 'low';
  if (days <= 14) return 'critical';
  if (days <= 45) return 'high';
  if (days <= 90) return 'medium';
  return 'low';
}

function withSource(fact, sources) {
  if (!fact) return fact;
  const src = fact.user_source || sources[fact.source] || null;
  return { ...fact, src, checked: fact.checked || (src && src.date_checked) || null };
}

function buildView(catalog, state, today) {
  const { universities, programs, intakes, scholarships, benefits, sources, livingCosts, exams, rankingSystems } = catalog;
  const student = state.student;
  const uniById = Object.fromEntries(universities.map((u) => [u.id, u]));
  const programById = Object.fromEntries(programs.map((p) => [p.id, p]));

  // ---- Per-intake application view ----------------------------------------
  const apps = intakes.map((intake) => {
    const program = programById[intake.program_id];
    const university = uniById[intake.university_id];
    const application = { status: 'not_started', notes: '', ...(state.applications[intake.id] || {}) };
    const apply = canApplyNow(intake, today);
    const cost = costFor({ intake, university, benefits, scholarships, livingCosts, student });
    const assessment = assess({ program, intake, university, student, cost, apply });
    const ranking = rankingFor(university, rankingSystems);
    ranking.components = ranking.components.map((c) => ({ ...c, ...pickSource(university.rankings.find((r) => r.fid === c.fid), sources) }));
    const next = nextClosingDeadline(intake, today);

    const requirements = intake.requirements.map((r) => ({
      ...withSource(r, sources),
      progress: state.requirementStatus[r.fid] || 'not_started',
    }));
    const applicable = requirements.filter((r) => r.progress !== 'na');
    const done = applicable.filter((r) => DONE_REQ.has(r.progress)).length;

    const deadlines = intake.deadlines
      .map((d) => ({ ...withSource(d, sources), days_left: d.date ? daysBetween(today, d.date) : null }))
      .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));

    const uniScholarships = scholarships
      .filter((s) => s.university_id === university.id)
      .map((s) => ({ ...withSource(s, sources), progress: state.scholarshipStatus[s.fid] || 'not_started' }));

    const examInfo = (codes) => {
      const r = intake.requirements.find((x) => x.exam && x.exam.some((c) => codes.includes(c)));
      if (!r) return null;
      const options = r.exam.length > 1 ? ` (or ${r.exam.filter((c) => !codes.includes(c)).join('/')})` : '';
      return r.exam.length > 1 || r.exam_mode === 'option' ? `Accepted${options}` : 'Required';
    };
    const otherExams = intake.requirements
      .filter((r) => r.exam && r.category === 'tests')
      .flatMap((r) => r.exam)
      .filter((c) => c !== 'SAT' && c !== 'ACT');

    return {
      id: intake.id,
      intake: { id: intake.id, academic_year: intake.academic_year, label: intake.label, start: intake.start, status_note: intake.status_note },
      program,
      university,
      application,
      active: !INACTIVE.has(application.status),
      apply,
      cost: {
        ...cost,
        sticker: cost.sticker ? { ...cost.sticker, ...pickSource(intake.tuition.sticker, sources) } : null,
      },
      assessment,
      ranking,
      next_deadline: next ? { ...withSource(next, sources), days_left: daysBetween(today, next.date) } : null,
      deadlines,
      requirements,
      progress: { done, total: applicable.length },
      scholarships: uniScholarships,
      flags: {
        sat: examInfo(['SAT']),
        other_exams: [...new Set(otherExams)],
        essay: intake.requirements.some((r) => r.doc_type === 'motivation_letter'),
        interview: intake.requirements.some((r) => /interview/i.test(r.title)),
        english: intake.requirements.some((r) => r.category === 'language' && r.exam && r.exam.some((c) => ['IELTS', 'TOEFL'].includes(c))),
        math: intake.requirements.some((r) => /math/i.test(r.title)),
      },
    };
  });

  const portfolio = apps.filter((a) => a.active);

  // ---- Exam planner: shared requirements across the portfolio --------------
  const examMeta = Object.fromEntries(exams.map((e) => [e.code, e]));
  const examMap = {};
  for (const a of portfolio) {
    for (const r of a.requirements) {
      if (!r.exam) continue;
      for (const code of r.exam) {
        const entry = (examMap[code] = examMap[code] || { code, required_by: [], accepted_by: [], deadlines: [] });
        const ref = { app_id: a.id, name: `${a.university.short_name}: ${a.program.name}`, min_score: r.min_score ? r.min_score[code] || null : null };
        if (r.exam.length === 1 && r.exam_mode !== 'option') entry.required_by.push(ref);
        else entry.accepted_by.push(ref);
        if (a.next_deadline) entry.deadlines.push({ date: a.next_deadline.date, app: a.university.short_name, status: a.next_deadline.status });
      }
    }
  }
  const examPlans = Object.values(examMap)
    .map((e) => {
      const plan = state.exams[e.code] || {};
      const earliest = e.deadlines.sort((x, y) => x.date.localeCompare(y.date))[0] || null;
      const count = e.required_by.length + e.accepted_by.length;
      const days = earliest ? daysBetween(today, earliest.date) : null;
      const done = plan.status === 'taken' && plan.score;
      const soon = days != null && days <= 120;
      let priority = done ? 'done' : count >= 3 || (soon && (e.required_by.length || count >= 2)) ? 'high' : count >= 2 ? 'medium' : 'low';
      if (!done && e.required_by.length && days != null && days <= 45) priority = 'critical';
      const meta = examMeta[e.code] || { code: e.code, name: e.code };
      return {
        ...e,
        meta,
        plan: { target: meta.suggested_target || null, ...plan },
        earliest_deadline: earliest,
        days_to_deadline: days,
        priority,
        weeks_to_test: plan.test_date ? Math.max(0, Math.floor(daysBetween(today, plan.test_date) / 7)) : null,
      };
    })
    .sort((a, b) => rank(a.priority) - rank(b.priority) || b.required_by.length + b.accepted_by.length - (a.required_by.length + a.accepted_by.length));

  // ---- Document library: one upload, many applications --------------------
  const docTypes = {};
  for (const a of portfolio) {
    for (const r of a.requirements) {
      if (!r.doc_type) continue;
      const d = (docTypes[r.doc_type] = docTypes[r.doc_type] || { type: r.doc_type, title: r.title, used_by: [] });
      d.used_by.push(`${a.university.short_name}`);
    }
  }
  const documents = Object.values(docTypes)
    .map((d) => ({ ...d, used_by: [...new Set(d.used_by)], state: { status: 'missing', translation: 'not_needed', apostille: 'unknown', ...(state.documents[d.type] || {}) } }))
    .sort((a, b) => b.used_by.length - a.used_by.length);

  // ---- Deadlines across the portfolio -------------------------------------
  const allDeadlines = portfolio
    .flatMap((a) => a.deadlines.map((d) => ({ ...d, app_id: a.id, university: a.university.short_name, program: a.program.name })))
    .sort((x, y) => (x.date || '9999').localeCompare(y.date || '9999'));

  // ---- Next actions --------------------------------------------------------
  const actions = [];
  const perUni = {};
  portfolio.forEach((a) => (perUni[a.university.id] = (perUni[a.university.id] || 0) + 1));
  const appName = (a) => (perUni[a.university.id] > 1 ? `${a.university.short_name} (${a.program.name})` : a.university.short_name);
  for (const a of portfolio) {
    if (['submitted', 'offer', 'waitlisted'].includes(a.application.status)) continue;
    const upcoming = a.deadlines.filter((d) => d.date && d.days_left >= 0 && ACTION_DEADLINE_TYPES.has(d.type));
    const firstClosing = upcoming.find((d) => CLOSING_TYPES.has(d.type));
    const chosen = upcoming.filter((d) => !CLOSING_TYPES.has(d.type) || d === firstClosing);
    for (const d of chosen) {
      if (d.days_left > 180) continue;
      actions.push({
        kind: 'deadline',
        title: CLOSING_TYPES.has(d.type) ? `${appName(a)} application: ${d.label}` : `${appName(a)}: ${d.label}`,
        detail: `${a.program.name} · ${a.progress.done}/${a.progress.total} requirements ready`,
        date: d.date,
        days_left: d.days_left,
        priority: priorityFor(d.days_left),
        verified: d.status === 'VERIFIED',
        app_id: a.id,
        fid: d.fid,
      });
    }
  }
  const ENGLISH = ['IELTS', 'TOEFL', 'DUOLINGO'];
  const englishDone = examPlans.some((e) => ENGLISH.includes(e.code) && e.plan.status && e.plan.status !== 'not_registered');
  let englishAdded = false;
  for (const e of examPlans) {
    if (e.priority === 'done' || !e.earliest_deadline || (e.plan.status && e.plan.status !== 'not_registered')) continue;
    if (e.meta.kind === 'university') continue; // university tests are covered by the application deadlines
    if (!e.required_by.length && e.accepted_by.length < 2) continue; // a rarely-accepted alternative, not a task
    const isEnglish = ENGLISH.includes(e.code);
    if (isEnglish && (englishDone || englishAdded)) continue;
    if (isEnglish) englishAdded = true;
    actions.push({
      kind: 'exam',
      title: isEnglish ? 'Book an English test (IELTS or TOEFL)' : `Register for ${e.meta.name}`,
      detail: `Needed by ${e.required_by.length + e.accepted_by.length} applications · score needed before ${e.earliest_deadline.app} (${e.earliest_deadline.date})`,
      date: e.earliest_deadline.date,
      days_left: e.days_to_deadline,
      priority: e.priority === 'critical' ? 'critical' : 'high',
      verified: e.earliest_deadline.status === 'VERIFIED',
      exam: e.code,
    });
  }
  actions.sort((x, y) => rank(x.priority) - rank(y.priority) || (x.days_left ?? 9999) - (y.days_left ?? 9999));

  const toVerify = allDeadlines.filter((d) => d.date && d.status !== 'VERIFIED' && d.days_left >= 0 && d.days_left <= 120);
  const missingData = portfolio
    .filter((a) => !a.deadlines.some((d) => d.date && CLOSING_TYPES.has(d.type)))
    .map((a) => ({ app_id: a.id, title: `${a.university.short_name}: find 2027/28 application deadline`, program: a.program.name }));

  // ---- Dashboard -----------------------------------------------------------
  const byStatus = (s) => portfolio.filter((a) => a.application.status === s).length;
  const portfolioScholarships = portfolio.flatMap((a) => a.scholarships);
  const uniqueScholarships = [...new Map(portfolioScholarships.map((s) => [s.fid, s])).values()];
  const nextDeadline = portfolio
    .filter((a) => a.next_deadline)
    .sort((x, y) => x.next_deadline.date.localeCompare(y.next_deadline.date))[0];

  const dashboard = {
    universities: new Set(portfolio.map((a) => a.university.id)).size,
    counts: {
      applications: portfolio.length,
      not_started: byStatus('not_started'),
      preparing: byStatus('preparing'),
      ready: byStatus('ready'),
      submitted: byStatus('submitted') + byStatus('offer') + byStatus('waitlisted'),
      scholarships_found: uniqueScholarships.length,
      scholarships_applied: uniqueScholarships.filter((s) => ['applied', 'awarded'].includes(s.progress)).length,
      upcoming_exams: Object.values(state.exams).filter((p) => p.test_date && p.test_date >= today).length,
      open_now: portfolio.filter((a) => a.apply.state === 'OPEN').length,
    },
    next_deadline: nextDeadline
      ? { app_id: nextDeadline.id, university: nextDeadline.university.short_name, program: nextDeadline.program.name, ...nextDeadline.next_deadline }
      : null,
    actions: actions.slice(0, 12),
    to_verify: toVerify.slice(0, 10),
    missing_data: missingData,
    upcoming_deadlines: allDeadlines.filter((d) => d.date && d.days_left >= 0).slice(0, 10),
  };

  return {
    today,
    student,
    applications: apps,
    exam_plans: examPlans,
    documents,
    deadlines: allDeadlines,
    dashboard,
    exams: exams,
    sources: Object.values(sources),
    enums: { APPLICATION_STATUSES, REQUIREMENT_STATUSES },
  };
}

function pickSource(fact, sources) {
  if (!fact) return {};
  const f = withSource(fact, sources);
  return { src: f.src, checked: f.checked, note: f.note || null };
}

function rank(priority) {
  return { critical: 0, high: 1, medium: 2, low: 3, done: 4 }[priority] ?? 5;
}

module.exports = { buildView, APPLICATION_STATUSES, REQUIREMENT_STATUSES };
