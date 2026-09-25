/** Higher is a stronger name match. 0 means no match. */
export function fuzzyMatchScore(
  query: string,
  fields: Array<string | null | undefined>,
): number {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return 0;
  const limit = q.length <= 4 ? 1 : 2;
  let best = 0;
  for (const raw of fields) {
    const text = (raw ?? "").trim().toLowerCase();
    if (!text) continue;
    if (text.includes(q)) {
      best = Math.max(best, text.startsWith(q) ? 100 : 80);
      continue;
    }
    const words = text.split(/[^a-z0-9]+/).filter((w) => w.length >= 2);
    for (const word of words) {
      if (word.startsWith(q)) {
        best = Math.max(best, 70);
        continue;
      }
      if (Math.abs(word.length - q.length) <= limit) {
        const dist = levenshtein(q, word);
        if (dist > 0 && dist <= limit) best = Math.max(best, 50 - dist);
      }
      if (word.length > q.length) {
        const dist = levenshtein(q, word.slice(0, q.length));
        if (dist > 0 && dist <= limit) best = Math.max(best, 40 - dist);
      }
    }
  }
  return best;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}
