// Real cost of a program for this student.
// Always separates OFFICIAL figures (sticker tuition, fees) from ESTIMATES
// (living costs, cost after aid). Unverified benefits/scholarships never reduce
// the base estimate; they only appear in the "best case".

function annualise(fact) {
  if (!fact || fact.amount == null) return null;
  return fact.period === 'semester' ? fact.amount * 2 : fact.amount;
}

const { appliesToUniversity, eligibility, isUkrainian } = require('./funding');

function costFor({ intake, university, benefits, scholarships, livingCosts, student }) {
  const sticker = intake.tuition.sticker;
  const stickerAnnual = annualise(sticker);

  // Benefits in the data are Ukraine-specific rules unless they say otherwise;
  // they must also match the student's categories (e.g. child of a combatant).
  const relevantBenefits = benefits.filter(
    (b) =>
      appliesToUniversity(b, university) &&
      b.academic_year === intake.academic_year &&
      eligibility(b, student, { defaultNationality: ['UA'] }).eligible,
  );
  const confirmed = relevantBenefits.find((b) => b.state === 'ACTIVE' && b.status === 'VERIFIED' && b.effect);
  let studentTuition = stickerAnnual;
  let studentBasis = 'Sticker tuition';
  if (confirmed && stickerAnnual != null) {
    studentTuition = applyEffect(stickerAnnual, confirmed.effect);
    studentBasis = `${confirmed.title} (${confirmed.academic_year}, verified)`;
  }

  const fees = intake.tuition.fees.map((f) => ({ label: f.label, annual: annualise(f), status: f.status }));
  const feesAnnual = fees.reduce((sum, f) => sum + (f.annual || 0), 0);
  const monthly = livingCosts[university.city] || null;
  const livingAnnual = monthly ? monthly * 12 : null;

  // Best case: the single biggest reduction among benefits/scholarships that
  // could plausibly apply (active, unknown or available) and fit the student.
  const options = [];
  for (const b of relevantBenefits) {
    if (b.state === 'EXPIRED' || !b.effect || stickerAnnual == null) continue;
    options.push({ name: b.title, tuition: applyEffect(stickerAnnual, b.effect), certainty: certainty(b.state === 'ACTIVE' && b.status === 'VERIFIED') });
  }
  for (const s of scholarships.filter((x) => appliesToUniversity(x, university))) {
    if (s.availability === 'NOT_AVAILABLE' || !eligibility(s, student).eligible || stickerAnnual == null) continue;
    let tuition = null;
    if (s.percent != null) tuition = stickerAnnual * (1 - s.percent / 100);
    else if (s.amount != null) tuition = Math.max(0, stickerAnnual - s.amount);
    if (tuition == null) continue;
    options.push({
      name: s.name,
      tuition,
      certainty: certainty(s.availability === 'AVAILABLE' && s.status === 'VERIFIED'),
      upTo: !!s.percent_is_max,
    });
  }
  options.sort((a, b) => a.tuition - b.tuition);
  const best = options[0] && studentTuition != null && options[0].tuition < studentTuition ? options[0] : null;

  const total = studentTuition != null && livingAnnual != null ? studentTuition + feesAnnual + livingAnnual : null;

  return {
    currency: 'EUR',
    sticker: sticker
      ? { annual: stickerAnnual, detail: sticker.detail || null, group: sticker.group || null, status: sticker.status, fid: sticker.fid }
      : null,
    student_tuition: { annual: studentTuition, basis: studentBasis },
    application_fee: intake.tuition.application_fee
      ? { amount: intake.tuition.application_fee.amount, status: intake.tuition.application_fee.status, fid: intake.tuition.application_fee.fid }
      : null,
    fees,
    fees_annual: feesAnnual,
    living: { monthly, annual: livingAnnual, estimate: true },
    total_annual: total,
    best_case: best
      ? {
          tuition: best.tuition,
          total: livingAnnual != null ? best.tuition + feesAnnual + livingAnnual : null,
          via: best.name,
          certainty: best.certainty,
          up_to: best.upTo,
        }
      : null,
    benefits: relevantBenefits.map((b) => ({ fid: b.fid, title: b.title, state: b.state, status: b.status, academic_year: b.academic_year, note: b.note, national: !b.university_id })),
    cheapest_route: best
      ? `${best.name}${best.upTo ? ' (up to)' : ''}: ${best.certainty === 'confirmed' ? 'confirmed' : 'not confirmed'}`
      : studentTuition == null
        ? 'Tuition not entered yet'
        : 'No funding found yet: pay listed tuition',
  };
}

function applyEffect(amount, effect) {
  if (effect.tuition_percent_off != null) return amount * (1 - effect.tuition_percent_off / 100);
  if (effect.tuition != null) return effect.tuition;
  return amount;
}

function certainty(confirmed) {
  return confirmed ? 'confirmed' : 'unconfirmed';
}

module.exports = { costFor, isUkrainian };
