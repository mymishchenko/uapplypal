// Loads reference data from data/ and normalises it into flat entities:
// universities, programs, intakes, scholarships, benefits, sources.
// Every verifiable fact gets a global id (fid) so user verifications/edits
// (stored as overrides) can be applied on top of the committed data.
const fs = require('node:fs');
const path = require('node:path');

const VERIFICATION = ['VERIFIED', 'EXPECTED', 'UNKNOWN'];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function loadRaw(dataDir) {
  const uniDir = path.join(dataDir, 'universities');
  const universities = fs
    .readdirSync(uniDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => readJson(path.join(uniDir, f)));
  return {
    universities,
    templates: readJson(path.join(dataDir, 'requirement-templates.json')),
    sources: readJson(path.join(dataDir, 'sources.json')),
    exams: readJson(path.join(dataDir, 'exams.json')),
    livingCosts: readJson(path.join(dataDir, 'living-costs.json')),
    studentSeed: readJson(path.join(dataDir, 'student.seed.json')),
    rankingSystems: readJson(path.join(dataDir, 'rankings.json')).systems,
  };
}

function expandRequirement(item, templates) {
  const spec = typeof item === 'string' ? { template: item, id: item } : item;
  const base = spec.template ? templates[spec.template] : {};
  if (spec.template && !base) throw new Error(`Unknown requirement template "${spec.template}"`);
  const req = { status: 'EXPECTED', source: 'typical', ...base, ...spec };
  req.key = spec.template || spec.id;
  if (req.exam && !Array.isArray(req.exam)) req.exam = [req.exam];
  return req;
}

// Builds the normalised catalog. `overrides` maps fid -> partial fact.
function buildCatalog(raw, overrides = {}) {
  const sources = {};
  const addSource = (s) => {
    if (sources[s.id]) throw new Error(`Duplicate source id "${s.id}"`);
    sources[s.id] = s;
  };
  raw.sources.forEach(addSource);

  const facts = {};
  const universities = [];
  const programs = [];
  const intakes = [];
  const scholarships = [];
  const benefits = [];

  const registerFact = (fid, fact) => {
    if (facts[fid]) throw new Error(`Duplicate fact id "${fid}"`);
    const override = overrides[fid];
    const merged = { ...fact, ...(override || {}), fid };
    if (override && override.source_url) {
      merged.user_source = {
        id: `user:${fid}`,
        title: override.source_title || 'Source added by user',
        url: override.source_url,
        type: 'user',
        date_checked: override.checked || null,
      };
    }
    if (!VERIFICATION.includes(merged.status)) {
      throw new Error(`Fact "${fid}" has invalid status "${merged.status}"`);
    }
    facts[fid] = merged;
    return merged;
  };

  for (const u of raw.universities) {
    const { programs: rawPrograms, sources: uniSources = [], scholarships: rawSch = [], benefits: rawBen = [], rankings: rawRankings = [], ...uni } = u;
    uniSources.forEach(addSource);
    for (const r of rawRankings) {
      if (!raw.rankingSystems[r.system]) throw new Error(`University "${uni.id}" uses unknown ranking system "${r.system}"`);
    }
    uni.rankings = rawRankings.map((r) => registerFact(`${uni.id}.k.${r.id}`, { ...r, university_id: uni.id }));
    universities.push(uni);

    for (const s of rawSch) {
      scholarships.push(registerFact(`${uni.id}.s.${s.id}`, { ...s, university_id: uni.id }));
    }
    for (const b of rawBen) {
      benefits.push(registerFact(`${uni.id}.b.${b.id}`, { ...b, university_id: uni.id }));
    }

    for (const p of rawPrograms) {
      const { intakes: rawIntakes, ...program } = p;
      programs.push({ ...program, university_id: uni.id });

      for (const i of rawIntakes) {
        const deadlines = (i.deadlines || []).map((d) =>
          registerFact(`${i.id}.d.${d.id}`, { ...d, intake_id: i.id }),
        );
        const t = i.tuition || {};
        const tuition = {
          sticker: t.sticker ? registerFact(`${i.id}.t.sticker`, t.sticker) : null,
          application_fee: t.application_fee ? registerFact(`${i.id}.t.application_fee`, t.application_fee) : null,
          fees: (t.fees || []).map((f) => registerFact(`${i.id}.t.fee.${f.id}`, f)),
        };
        const requirements = (i.requirements || []).map((r) => {
          const req = expandRequirement(r, raw.templates);
          return registerFact(`${i.id}.r.${req.id}`, req);
        });
        intakes.push({
          ...i,
          program_id: program.id,
          university_id: uni.id,
          deadlines,
          tuition,
          requirements,
          windows: i.windows || [],
        });
      }
    }
  }

  // Validate references so data mistakes fail loudly at startup / in tests.
  for (const fact of Object.values(facts)) {
    if (fact.source && !sources[fact.source]) {
      throw new Error(`Fact "${fact.fid}" references unknown source "${fact.source}"`);
    }
  }
  for (const intake of intakes) {
    const ids = new Set(intake.deadlines.map((d) => d.id));
    for (const w of intake.windows) {
      for (const ref of [w.opens, w.closes]) {
        if (ref && !ids.has(ref)) throw new Error(`Intake "${intake.id}" window "${w.id}" references unknown deadline "${ref}"`);
      }
    }
  }

  return {
    universities,
    programs,
    intakes,
    scholarships,
    benefits,
    sources,
    facts,
    exams: raw.exams,
    livingCosts: raw.livingCosts,
    rankingSystems: raw.rankingSystems,
    templates: raw.templates,
  };
}

module.exports = { loadRaw, buildCatalog, VERIFICATION };
