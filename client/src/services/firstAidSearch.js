const normalize = value => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
const compact = value => normalize(value).replace(/\s/g, "");

function editDistance(left, right) {
  const a = normalize(left), b = normalize(right), rows = Array.from({ length: a.length + 1 }, (_, index) => [index]);
  for (let column = 0; column <= b.length; column += 1) rows[0][column] = column;
  for (let row = 1; row <= a.length; row += 1) for (let column = 1; column <= b.length; column += 1) {
    const cost = a[row - 1] === b[column - 1] ? 0 : 1;
    rows[row][column] = Math.min(rows[row - 1][column] + 1, rows[row][column - 1] + 1, rows[row - 1][column - 1] + cost);
    if (row > 1 && column > 1 && a[row - 1] === b[column - 2] && a[row - 2] === b[column - 1]) rows[row][column] = Math.min(rows[row][column], rows[row - 2][column - 2] + 1);
  }
  return rows[a.length][b.length];
}

function fuzzyScore(term, candidate, weight) {
  if (term.length < 4) return 0;
  const difference = Math.abs(term.length - candidate.length), tolerance = Math.min(4, Math.max(1, Math.ceil(term.length * .3)));
  if (difference > tolerance) return 0;
  const distance = editDistance(term, candidate);
  return distance <= tolerance ? Math.round(weight * (1 - distance / Math.max(term.length, candidate.length))) : 0;
}

function tokenScore(term, words, weights) {
  let best = 0;
  for (const word of words) {
    if (word === term) best = Math.max(best, weights.exact);
    else if (word.startsWith(term)) best = Math.max(best, weights.prefix);
    else if (term.length >= 3 && word.length >= term.length) {
      const tolerance = term.length <= 5 ? 1 : 2, prefixDistance = editDistance(term, word.slice(0, term.length));
      if (prefixDistance <= tolerance) best = Math.max(best, Math.round(weights.prefix * (1 - prefixDistance / (term.length + 1))));
    }
    else best = Math.max(best, fuzzyScore(term, word, weights.fuzzy));
  }
  return best;
}

const commonPrefixLength = (left, right) => { const a = normalize(left), b = normalize(right); let index = 0; while (index < a.length && index < b.length && a[index] === b[index]) index += 1; return index; };

function matchDetails(guide, query, aliases) {
  const q = normalize(query), titleWords = normalize(guide.title).split(" "), candidates = [...titleWords, ...aliases.flatMap(alias => normalize(alias).split(" "))].filter(Boolean);
  if (!q) return { matchType: "all", prefixLength: 0 };
  if (normalize(guide.title) === q || titleWords.includes(q)) return { matchType: "exact", prefixLength: q.length };
  const prefix = titleWords.find(word => word.startsWith(q));
  if (prefix) return { matchType: "prefix", prefixLength: q.length };
  if (q.length >= 3) {
    const tolerance = q.length <= 5 ? 1 : 2;
    const fuzzy = candidates.map(word => ({ word, distance: word.length >= q.length ? editDistance(q, word.slice(0, q.length)) : editDistance(q, word) })).filter(item => item.distance <= tolerance).sort((a, b) => a.distance - b.distance)[0];
    if (fuzzy) return { matchType: "fuzzy", prefixLength: fuzzy.word === titleWords[0] ? commonPrefixLength(q, fuzzy.word) : 0 };
  }
  return { matchType: "keyword", prefixLength: 0 };
}

export function scoreFirstAidGuide(guide, query, aliases = []) {
  const q = normalize(query); if (!q) return 1;
  const title = normalize(guide.title), titleWords = title.split(" "), aliasText = normalize(aliases.join(" ")), aliasWords = aliasText.split(" ").filter(Boolean);
  const description = normalize([guide.category, guide.warning, ...(guide.steps || [])].join(" ")), descriptionWords = description.split(" ").filter(Boolean);
  if (title === q || compact(title) === compact(q)) return 1000;
  if (titleWords.includes(q)) return 950;
  let score = 0;
  if (title.startsWith(q) || compact(title).startsWith(compact(q)) || titleWords.some(word => word.startsWith(q))) return 850;
  if (aliasText.split(" ").includes(q) || aliases.some(alias => normalize(alias) === q)) return 700;
  if (aliases.some(alias => normalize(alias).includes(q))) score += 180;
  const terms = q.split(" "), matched = terms.map(term => {
    const titleScore = tokenScore(term, titleWords, { exact: 150, prefix: 125, fuzzy: 115 });
    const aliasScore = tokenScore(term, aliasWords, { exact: 105, prefix: 85, fuzzy: 80 });
    const descriptionScore = tokenScore(term, descriptionWords, { exact: 50, prefix: 35, fuzzy: 28 });
    const best = Math.max(titleScore, aliasScore, descriptionScore); score += best; return best > 0;
  });
  if (terms.length > 1) score += matched.filter(Boolean).length * 35;
  return matched.every(Boolean) ? score : matched.some(Boolean) && terms.length === 1 ? score : 0;
}

export function searchFirstAid(guides, query, aliasesByTitle = {}) {
  return rankFirstAid(guides, query, aliasesByTitle).map(result => result.guide);
}

export function rankFirstAid(guides, query, aliasesByTitle = {}) {
  if (!normalize(query)) return guides.map((guide, index) => ({ guide, index, score: 1, matchType: "all", prefixLength: 0 }));
  return guides.map((guide, index) => { const aliases = aliasesByTitle[guide.title] || []; return { guide, index, score: scoreFirstAidGuide(guide, query, aliases), ...matchDetails(guide, query, aliases) }; }).filter(result => result.score >= 28).sort((left, right) => right.score - left.score || left.index - right.index);
}
