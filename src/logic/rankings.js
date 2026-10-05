// Combined ranking score: the normalised average of THE World University
// Rankings and U.S. News Best Global Universities.
//
// Each rank is normalised by the size of its edition, so ranks from lists of
// different lengths are comparable:   score = 100 × (1 − (rank − 1) / ranked)
// #1 scores 100; the last-ranked institution scores ~0. Bands ("301–350") use
// the midpoint. The combined score averages the systems that rank the
// university; it is labelled with how many systems that is.

function parseRank(text) {
  if (text == null || String(text).trim() === '') return null;
  const t = String(text).trim();
  if (/not ranked/i.test(t)) return { notRanked: true };
  const band = t.match(/(\d+)\s*[–—-]\s*(\d+)/);
  if (band) {
    const low = Number(band[1]);
    const high = Number(band[2]);
    return { low, high, value: (low + high) / 2 };
  }
  const plus = t.match(/(\d+)\s*\+/);
  if (plus) return { low: Number(plus[1]), high: null, value: Number(plus[1]) };
  const n = t.match(/(\d+)/);
  if (n) return { low: Number(n[1]), high: Number(n[1]), value: Number(n[1]) };
  return null;
}

function editionSize(system, edition) {
  const e = (edition && system.editions[edition]) || null;
  if (e) return { ranked: e.ranked, assumed: false };
  return { ranked: system.editions[system.latest].ranked, assumed: true };
}

function normalise(value, ranked) {
  const score = 100 * (1 - (value - 1) / ranked);
  return Math.round(Math.max(0, Math.min(100, score)) * 10) / 10;
}

function rankingFor(university, systems) {
  const components = (university.rankings || []).map((r) => {
    const system = systems[r.system];
    const parsed = parseRank(r.rank_text);
    const base = {
      fid: r.fid,
      system: r.system,
      name: system.name,
      edition: r.edition,
      rank_text: r.rank_text,
      status: r.status,
      note: r.note || null,
      not_ranked: !!(parsed && parsed.notRanked),
      score: null,
    };
    if (!parsed || parsed.notRanked) return base;
    const size = editionSize(system, r.edition);
    return { ...base, score: normalise(parsed.value, size.ranked), out_of: size.ranked, size_assumed: size.assumed };
  });
  const scored = components.filter((c) => c.score != null);
  const score = scored.length ? Math.round((scored.reduce((s, c) => s + c.score, 0) / scored.length) * 10) / 10 : null;
  return {
    score,
    used: scored.length,
    of: Object.keys(systems).length,
    verified: scored.length > 0 && scored.every((c) => c.status === 'VERIFIED'),
    components,
    summary:
      score == null
        ? components.some((c) => c.not_ranked)
          ? 'Not in THE or U.S. News overall rankings'
          : 'No ranking data'
        : `Average of ${scored.map((c) => (c.system === 'THE' ? 'THE' : 'U.S. News')).join(' + ')}${scored.length < Object.keys(systems).length ? ' (only one ranks this university)' : ''}`,
  };
}

module.exports = { rankingFor, parseRank, normalise };
