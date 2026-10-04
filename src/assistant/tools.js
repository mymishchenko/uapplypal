// Tools the assistant can call. Read tools return compact JSON built from the
// same computed view the UI shows (src/logic/views.js), so answers come from
// structured data instead of the model's memory. The only write tool saves a
// research finding as "needs review"; it never edits verified data.
const { randomUUID } = require('node:crypto');

const FINDING_KINDS = ['scholarship', 'program', 'deadline_update', 'opportunity', 'course', 'other'];

const obj = (properties, required = Object.keys(properties)) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});

const TOOLS = [
  {
    name: 'get_overview',
    description:
      "Today's date, the student's portfolio counts, the next deadline, the prioritised next-actions list, dates that need verification and programs with missing data. Call this first for planning questions like 'what should I do this week?'.",
    strict: true,
    input_schema: obj({}),
  },
  {
    name: 'list_programs',
    description:
      'One row per program in the portfolio: id, university, program, country, language, application status, "can apply now" state, next deadline, tuition, best-case cost after aid, fit and Reach/Target/Safe estimate, and which tests/essays/interviews are needed. Use for comparisons and "which programs require X" questions.',
    strict: true,
    input_schema: obj({}),
  },
  {
    name: 'get_program',
    description:
      'Full details for one program intake: every deadline, requirement (with the student\'s progress), cost breakdown, scholarships, Ukrainian benefits, fit reasons and sources. Use the id from list_programs (e.g. "ie-bba-2027").',
    strict: true,
    input_schema: obj({ id: { type: 'string', description: 'Intake id, e.g. "wu-bbe-2027"' } }),
  },
  {
    name: 'list_deadlines',
    description: 'All deadlines across the portfolio, sorted by date, with days left and verification status.',
    strict: true,
    input_schema: obj({
      scope: { type: 'string', enum: ['upcoming', 'past', 'undated', 'all'], description: 'Which deadlines to return' },
    }),
  },
  {
    name: 'list_scholarships',
    description: 'Scholarships and Ukrainian-student benefits already in the database, with availability for 2027/28, amounts and the student\'s application progress.',
    strict: true,
    input_schema: obj({}),
  },
  {
    name: 'get_exam_plan',
    description: 'Exams consolidated across the portfolio (which programs require/accept each), priority, the student\'s plan (test date, target, scores) and preparation resources.',
    strict: true,
    input_schema: obj({}),
  },
  {
    name: 'get_profile',
    description: "The student's profile: personal details, education, languages, test scores, interests, preferences and activities. Use for matching, CV writing and eligibility checks.",
    strict: true,
    input_schema: obj({}),
  },
  {
    name: 'list_findings',
    description: 'Research findings saved earlier (scholarships, programs, date updates, courses) and their review status. Check this before saving to avoid duplicates.',
    strict: true,
    input_schema: obj({}),
  },
  {
    name: 'save_finding',
    description:
      'Save something found through web research for the student to review: a scholarship, program, deadline update, course or other opportunity. Only save items you found on a page during this conversation, with that page\'s URL. Saved items are marked "needs review" and are never treated as verified.',
    strict: true,
    input_schema: obj(
      {
        kind: { type: 'string', enum: FINDING_KINDS },
        title: { type: 'string', description: 'Short name, e.g. "Erasmus+ ... scholarship"' },
        university: { type: ['string', 'null'], description: 'University or provider, if any' },
        summary: { type: 'string', description: '1-3 sentences: what it is, who is eligible, why it fits this student' },
        amount: { type: ['string', 'null'], description: 'Amount or coverage as stated on the page, if any' },
        deadline: { type: ['string', 'null'], description: 'Deadline as stated on the page (YYYY-MM-DD if exact), if any' },
        academic_year: { type: ['string', 'null'], description: 'Academic year the page refers to, e.g. "2027/28", if stated' },
        url: { type: 'string', description: 'The page where this was found (prefer the official source)' },
      },
      ['kind', 'title', 'university', 'summary', 'amount', 'deadline', 'academic_year', 'url'],
    ),
  },
];

// Server-side tools run by Anthropic (web research).
const SERVER_TOOLS = [
  { type: 'web_search_20260209', name: 'web_search', max_uses: 6 },
  { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 6 },
];

function compactApp(a) {
  return {
    id: a.id,
    university: a.university.short_name,
    program: a.program.name,
    country: a.university.country,
    city: a.university.city,
    language: a.program.language,
    duration_years: a.program.duration_years,
    my_status: a.application.status,
    can_apply_now: a.apply.state,
    can_apply_detail: a.apply.detail,
    next_deadline: a.next_deadline ? { date: a.next_deadline.date, label: a.next_deadline.label, verification: a.next_deadline.status } : null,
    official_tuition_per_year: a.cost.sticker ? a.cost.sticker.annual : null,
    tuition_verification: a.cost.sticker ? a.cost.sticker.status : null,
    student_tuition_per_year: a.cost.student_tuition.annual,
    best_case_tuition: a.cost.best_case ? { amount: a.cost.best_case.tuition, via: a.cost.best_case.via, certainty: a.cost.best_case.certainty } : null,
    estimated_total_per_year: a.cost.total_annual,
    fit: a.assessment.match,
    admission_category_estimate: a.assessment.admission.category,
    sat: a.flags.sat,
    other_exams: a.flags.other_exams,
    essay: a.flags.essay,
    interview: a.flags.interview,
    requirements_ready: `${a.progress.done}/${a.progress.total}`,
  };
}

const src = (f) => (f && f.src ? { title: f.src.title, url: f.src.url, type: f.src.type, checked: f.checked } : null);

function detailApp(a) {
  return {
    ...compactApp(a),
    intake: a.intake,
    official_url: a.program.official_url,
    deadlines: a.deadlines.map((d) => ({
      label: d.label,
      type: d.type,
      date: d.date,
      date_end: d.date_end || null,
      date_text: d.date_text || null,
      days_left: d.days_left,
      verification: d.status,
      note: d.note || null,
      source: src(d),
    })),
    requirements: a.requirements.map((r) => ({
      category: r.category,
      title: r.title,
      detail: r.detail || null,
      exams: r.exam || null,
      min_score: r.min_score || null,
      progress: r.progress,
      verification: r.status,
    })),
    cost: {
      sticker: a.cost.sticker,
      student_tuition: a.cost.student_tuition,
      fees: a.cost.fees,
      application_fee: a.cost.application_fee,
      living: a.cost.living,
      total_annual: a.cost.total_annual,
      best_case: a.cost.best_case,
      cheapest_route: a.cost.cheapest_route,
      ukrainian_benefits: a.cost.benefits,
    },
    scholarships: a.scholarships.map(scholarshipRow),
    fit: { pros: a.assessment.pros, risks: a.assessment.risks, admission: a.assessment.admission },
    notes: a.application.notes || null,
  };
}

function scholarshipRow(s) {
  return {
    name: s.name,
    type: s.type,
    amount: s.amount ?? null,
    percent: s.percent ?? null,
    up_to: !!s.percent_is_max,
    availability_2027: s.availability,
    eligibility: s.eligibility,
    separate_application: s.separate_application ?? null,
    deadline: s.deadline || null,
    verification: s.status,
    my_progress: s.progress,
    source: src(s),
  };
}

// Executes one tool call. Returns a JSON-serialisable result, or throws an
// Error whose message is returned to the model as an error result.
function runTool(name, input, { view, store, today }) {
  const portfolio = view.applications.filter((a) => a.active);
  switch (name) {
    case 'get_overview': {
      const d = view.dashboard;
      return {
        today,
        target_intake: view.student.personal.target_intake,
        counts: d.counts,
        next_deadline: d.next_deadline,
        next_actions: d.actions,
        dates_to_verify: d.to_verify.map((x) => ({ university: x.university, label: x.label, date: x.date, source: src(x) })),
        programs_missing_deadlines: d.missing_data,
      };
    }
    case 'list_programs':
      return portfolio.map(compactApp);
    case 'get_program': {
      const a = view.applications.find((x) => x.id === input.id);
      if (!a) throw new Error(`No program with id "${input.id}". Use list_programs to see ids.`);
      return detailApp(a);
    }
    case 'list_deadlines': {
      const scope = input.scope;
      return view.deadlines
        .filter((d) => (scope === 'upcoming' ? d.date && d.days_left >= 0 : scope === 'past' ? d.date && d.days_left < 0 : scope === 'undated' ? !d.date : true))
        .map((d) => ({
          date: d.date,
          date_end: d.date_end || null,
          date_text: d.date_text || null,
          days_left: d.days_left,
          university: d.university,
          program: d.program,
          label: d.label,
          type: d.type,
          verification: d.status,
          source: src(d),
        }));
    }
    case 'list_scholarships': {
      const seen = new Set();
      const rows = [];
      for (const a of portfolio) {
        for (const s of a.scholarships) {
          if (seen.has(s.fid)) continue;
          seen.add(s.fid);
          rows.push({ university: a.university.short_name, ...scholarshipRow(s) });
        }
        for (const b of a.cost.benefits) {
          if (seen.has(b.fid)) continue;
          seen.add(b.fid);
          rows.push({ university: a.university.short_name, ukrainian_benefit: b.title, academic_year: b.academic_year, state: b.state, verification: b.status, note: b.note || null });
        }
      }
      return rows;
    }
    case 'get_exam_plan':
      return view.exam_plans.map((e) => ({
        exam: e.meta.name,
        code: e.code,
        priority: e.priority,
        required_by: e.required_by.map((r) => r.name),
        accepted_by: e.accepted_by.map((r) => r.name),
        min_scores: [...e.required_by, ...e.accepted_by].filter((r) => r.min_score).map((r) => ({ program: r.name, min: r.min_score })),
        score_needed_before: e.earliest_deadline,
        plan: e.plan,
        syllabus: e.meta.syllabus,
        resources: e.meta.resources || [],
      }));
    case 'get_profile':
      return view.student;
    case 'list_findings':
      return store.get().findings || [];
    case 'save_finding': {
      if (!/^https?:\/\//.test(input.url)) throw new Error('url must be an http(s) URL of the page where this was found');
      if (!FINDING_KINDS.includes(input.kind)) throw new Error('invalid kind');
      const existing = (store.get().findings || []).find((f) => f.url === input.url && f.title === input.title);
      if (existing) return { saved: false, reason: 'already saved', id: existing.id };
      const finding = {
        id: randomUUID(),
        ...pickStrings(input, ['kind', 'title', 'university', 'summary', 'amount', 'deadline', 'academic_year', 'url']),
        status: 'needs_review',
        found_on: today,
      };
      store.update((st) => {
        st.findings = [...(st.findings || []), finding];
      });
      return { saved: true, id: finding.id };
    }
    default:
      throw new Error(`Unknown tool "${name}"`);
  }
}

function pickStrings(input, keys) {
  return Object.fromEntries(keys.map((k) => [k, input[k] == null ? null : String(input[k]).slice(0, 2000)]));
}

module.exports = { TOOLS, SERVER_TOOLS, runTool, FINDING_KINDS };
