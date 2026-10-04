// Runtime store for personal data: profile, application progress, documents,
// exam plans and overrides of reference facts. Kept in one JSON file outside
// the committed data (data/runtime/ is excluded from git and from deploys).
const fs = require('node:fs');
const path = require('node:path');

function emptyState(studentSeed) {
  return {
    version: 1,
    student: structuredClone(studentSeed),
    applications: {}, // intakeId -> { status, notes }
    requirementStatus: {}, // fid -> status
    documents: {}, // docType -> { status, translation, apostille, expires, notes }
    exams: {}, // exam code -> { status, test_date, registration_deadline, diagnostic, score, target, weekly_hours }
    scholarshipStatus: {}, // fid -> status
    overrides: {}, // fact fid -> partial fact
    notifications: { sent: {}, log: [] }, // email agent: alert keys already sent, delivery log
  };
}

class Store {
  constructor(file, studentSeed) {
    this.file = file;
    this.state = emptyState(studentSeed);
    if (file && fs.existsSync(file)) {
      this.state = { ...this.state, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
    }
  }

  get() {
    return this.state;
  }

  update(mutator) {
    const next = structuredClone(this.state);
    mutator(next);
    this.state = next;
    if (this.file) {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(next, null, 2));
      fs.renameSync(tmp, this.file);
    }
    return next;
  }
}

module.exports = { Store, emptyState };
