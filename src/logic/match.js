// Personalised fit (Strong Match … Ineligible) and an admission-category
// ESTIMATE (Reach/Target/Safe) with reasons. No admission probabilities are
// produced: there is no reliable data for them.

const LEVELS = ['Weak Match', 'Possible', 'Match', 'Strong Match'];
const SAFER = { Reach: 'Target', Target: 'Safe', Safe: 'Safe' };

function studentLanguages(student) {
  return (student.languages || []).map((l) => ({ language: (l.language || '').toLowerCase(), level: (l.level || '').toUpperCase() }));
}

function knowsLanguage(student, language) {
  const l = studentLanguages(student).find((x) => x.language === language.toLowerCase());
  if (!l) return false;
  return /NATIVE|C1|C2|B2/.test(l.level);
}

function testScore(student, code) {
  const t = (student.tests || {})[code];
  return t && t.score ? Number(t.score) : null;
}

function assess({ program, intake, university, student, cost, apply }) {
  const pros = [];
  const risks = [];
  let score = 0;
  let ineligible = null;

  // Language of instruction
  if (program.language === 'English') {
    pros.push('English-taught');
    score += 2;
  } else if (knowsLanguage(student, program.language)) {
    pros.push(`Taught in ${program.language}, which you speak`);
    score += 1;
  } else {
    risks.push(`Taught in ${program.language}${program.language_status === 'VERIFIED' ? '' : ' (to verify)'}; you don't list ${program.language} at B2+`);
    score -= 3;
    if (program.language_status === 'VERIFIED') ineligible = `Requires ${program.language}`;
  }

  // Field fit
  const interests = (student.interests || []).map((i) => i.toLowerCase());
  const overlap = program.fields.filter((f) => interests.includes(f.toLowerCase()));
  if (overlap.length >= 2) {
    pros.push(`Matches your interests: ${overlap.join(', ')}`);
    score += 2;
  } else if (overlap.length === 1) {
    pros.push(`Matches your interest in ${overlap[0]}`);
    score += 1;
  } else {
    risks.push('Field does not match your listed interests');
    score -= 1;
  }

  // Location preference
  const prefs = student.preferences || {};
  const countries = splitList(prefs.countries);
  if (countries.length) {
    if (countries.includes(university.country.toLowerCase())) {
      pros.push(`In a preferred country (${university.country})`);
      score += 1;
    } else {
      risks.push(`${university.country} is not in your preferred countries`);
      score -= 1;
    }
  }

  // Budget
  const tuition = cost.student_tuition.annual;
  const maxTuition = Number(prefs.max_tuition) || null;
  if (tuition == null) {
    risks.push('Tuition for 2027/28 not entered yet');
  } else {
    if (tuition <= 3000) {
      pros.push('Low tuition');
      score += 1;
    }
    if (maxTuition) {
      if (tuition <= maxTuition) {
        pros.push('Tuition within your maximum');
        score += 1;
      } else if (cost.best_case && cost.best_case.tuition <= maxTuition) {
        risks.push(`Over your max tuition unless "${cost.best_case.via}" comes through`);
      } else {
        risks.push('Tuition above your maximum');
        score -= 2;
      }
    }
  }
  const maxBudget = Number(prefs.max_total_budget) || null;
  if (maxBudget && cost.total_annual != null && cost.total_annual > maxBudget) {
    risks.push('Estimated total annual cost above your budget');
    score -= 1;
  }

  // Requirements that need action
  const examReqs = intake.requirements.filter((r) => r.exam && r.category === 'tests');
  for (const r of examReqs) {
    const done = r.exam.some((code) => testScore(student, code) != null);
    if (!done) risks.push(`${r.title}: not taken yet`);
  }
  if (intake.requirements.some((r) => r.key === 'ua_certificate_recognition')) {
    risks.push('Ukrainian school certificate requirements must be verified');
  }
  for (const r of program.risks || []) if (!risks.includes(r)) risks.push(r);
  for (const h of program.highlights || []) pros.push(h);

  if (apply.state === 'CLOSED') risks.push('All application windows for this intake are closed');

  const level = ineligible ? 'Ineligible' : LEVELS[Math.max(0, Math.min(3, score >= 5 ? 3 : score >= 3 ? 2 : score >= 1 ? 1 : 0))];

  return { match: level, ineligible_reason: ineligible, pros, risks, admission: admissionCategory(program, student) };
}

function admissionCategory(program, student) {
  const base = { very_high: 'Reach', high: 'Reach', medium: 'Target', low: 'Safe' }[program.selectivity] || 'Target';
  const sat = testScore(student, 'SAT');
  let category = base;
  const reasons = [`Program selectivity: ${String(program.selectivity || 'unknown').replace('_', ' ')}`];
  if (program.selectivity === 'high' && sat == null) {
    reasons.push('No test scores entered yet');
  }
  if (sat != null) {
    if (sat >= 1450) {
      category = SAFER[base];
      reasons.push(`SAT ${sat} is strong`);
    } else if (sat < 1250 && base !== 'Safe') {
      category = 'Reach';
      reasons.push(`SAT ${sat} is below typical competitive levels`);
    } else {
      reasons.push(`SAT ${sat}`);
    }
  }
  return { category, estimate: true, reasons };
}

function splitList(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

module.exports = { assess };
