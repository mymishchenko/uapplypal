// Who a scholarship or benefit applies to.
//   - University scope: a university's own items, or national schemes for its
//     country (optionally only public or private universities).
//   - Student fit: nationality (UA-only items) and family/residence categories
//     (e.g. child of a combatant). Categories the student hasn't ticked mean
//     "not eligible as far as we know"; such items are listed but never used
//     for the best-case cost.

function appliesToUniversity(item, university) {
  if (item.university_id) return item.university_id === university.id;
  if (!item.country || item.country !== university.country) return false;
  return !item.university_types || item.university_types.includes(university.type);
}

function isUkrainian(student) {
  return /ukrain/i.test((student.personal && student.personal.citizenships) || '');
}

function studentCategories(student) {
  const c = student.personal && student.personal.support_categories;
  return Array.isArray(c) ? c : [];
}

// Returns { eligible: boolean, reason: string|null }.
function eligibility(item, student, { defaultNationality = null } = {}) {
  const nationality = item.nationality || defaultNationality;
  if (nationality && !(nationality.includes('UA') && isUkrainian(student))) {
    return { eligible: false, reason: 'nationality' };
  }
  if (item.categories && item.categories.length) {
    const mine = studentCategories(student);
    if (!item.categories.some((c) => mine.includes(c))) return { eligible: false, reason: 'category' };
  }
  return { eligible: true, reason: null };
}

module.exports = { appliesToUniversity, eligibility, isUkrainian, studentCategories };
