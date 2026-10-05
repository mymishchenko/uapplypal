// Exam strategy across the whole portfolio.
//
// Every requirement that lists exams is a "slot" one exam must fill, e.g.
// Bocconi's admission test = {SAT, ACT, BOCCONI_TEST}, NMT = {NMT}.
//   - MUST: an exam that is the only option for some slot (no way around it).
//   - RECOMMENDED: for the remaining slots, the exam that fills the most of
//     them, chosen greedily (set cover). Ties prefer an exam the student has
//     already taken/registered for, then the exam's `preference` (more
//     convenient/general first), then the code. Other options are listed as
//     alternatives, with the applications they would NOT cover.
// Slots already filled by a must-take exam need no extra exam.

const TAKEN = new Set(['taken', 'registered']);

function examStrategy({ applications, exams, plans = {} }) {
  const meta = Object.fromEntries(exams.map((e) => [e.code, e]));
  const name = (code) => (meta[code] ? meta[code].name : code);
  const label = (a) => `${a.university.short_name}: ${a.program.name}`;

  const slots = [];
  for (const a of applications.filter((x) => x.active)) {
    for (const r of a.requirements) {
      if (!r.exam || !r.exam.length || r.progress === 'na') continue;
      slots.push({
        app: a,
        req: r,
        options: [...new Set(r.exam)],
        kind: r.category === 'language' ? 'language' : 'test',
        deadline: a.next_deadline ? a.next_deadline.date : null,
      });
    }
  }

  // MUST: single-option slots, grouped by exam.
  const mustMap = new Map();
  for (const s of slots.filter((x) => x.options.length === 1)) {
    const code = s.options[0];
    const m = mustMap.get(code) || { code, name: name(code), kind: meta[code] ? meta[code].kind : null, programs: [], deadlines: [] };
    m.programs.push(label(s.app));
    if (s.deadline) m.deadlines.push(s.deadline);
    mustMap.set(code, m);
  }
  const must = [...mustMap.values()].map((m) => ({ ...finish(m), plan: plans[m.code] || null }));
  const mustCodes = new Set(must.map((m) => m.code));

  // Choice slots not already filled by a must-take exam.
  const choice = slots.filter((s) => s.options.length > 1);
  const alreadyCovered = choice.filter((s) => s.options.some((o) => mustCodes.has(o)));
  let open = choice.filter((s) => !s.options.some((o) => mustCodes.has(o)));

  const recommended = [];
  while (open.length) {
    const counts = new Map();
    for (const s of open) for (const o of s.options) counts.set(o, (counts.get(o) || 0) + 1);
    const best = [...counts.entries()].sort(
      ([a, ca], [b, cb]) =>
        cb - ca ||
        Number(TAKEN.has((plans[b] || {}).status)) - Number(TAKEN.has((plans[a] || {}).status)) ||
        pref(meta[a]) - pref(meta[b]) ||
        a.localeCompare(b),
    )[0][0];
    const covered = open.filter((s) => s.options.includes(best));
    open = open.filter((s) => !s.options.includes(best));

    // Alternatives: other options in the slots this exam covers.
    const altMap = new Map();
    for (const s of covered) {
      for (const o of s.options) {
        if (o === best) continue;
        const alt = altMap.get(o) || { code: o, name: name(o), kind: meta[o] ? meta[o].kind : null, programs: [] };
        alt.programs.push(label(s.app));
        altMap.set(o, alt);
      }
    }
    const coveredLabels = covered.map((s) => label(s.app));
    const alternatives = [...altMap.values()]
      .map((alt) => ({ ...alt, not_for: coveredLabels.filter((l) => !alt.programs.includes(l)) }))
      .sort((x, y) => y.programs.length - x.programs.length || pref(meta[x.code]) - pref(meta[y.code]));

    recommended.push({
      ...finish({ code: best, name: name(best), kind: meta[best] ? meta[best].kind : null, programs: coveredLabels, deadlines: covered.map((s) => s.deadline).filter(Boolean) }),
      slot_kind: covered[0].kind,
      min_scores: covered
        .filter((s) => s.req.min_score && s.req.min_score[best] != null)
        .map((s) => ({ program: label(s.app), min: s.req.min_score[best] })),
      alternatives,
      plan: plans[best] || null,
    });
  }

  return {
    must: must.sort((x, y) => (x.earliest || '9999').localeCompare(y.earliest || '9999')),
    recommended,
    covered_by_must: alreadyCovered.map((s) => ({ program: label(s.app), by: s.options.filter((o) => mustCodes.has(o)).map(name) })),
  };
}

function pref(m) {
  return m && m.preference != null ? m.preference : 5;
}

function finish(m) {
  const programs = [...new Set(m.programs)];
  const earliest = m.deadlines.sort()[0] || null;
  const { deadlines, ...rest } = m;
  return { ...rest, programs, count: programs.length, earliest };
}

module.exports = { examStrategy };
