// A result's score as a percentage of its own total (e.g. 7 of 10 -> 70).
// Used only where results with different totals have to be combined.
export function percentOf(r) {
  return r.total ? (r.score / r.total) * 100 : 0;
}

// Summary numbers shown under a printed results report or on a result slip.
export function resultStats(results) {
  const count = results.length;
  if (count === 0) return { count, average: 0, highest: 0, lowest: 0 };

  let total = 0, highest = -Infinity, lowest = Infinity;
  for (const r of results) {
    const pct = percentOf(r);
    total += pct;
    highest = Math.max(highest, pct);
    lowest = Math.min(lowest, pct);
  }
  return {
    count,
    average: Math.round((total / count) * 10) / 10,
    highest: Math.round(highest),
    lowest: Math.round(lowest),
  };
}

// Groups results by student (username is unique within a school), keeping
// the order in which each student first appears.
export function groupByStudent(results) {
  const map = new Map();
  for (const r of results) {
    if (!map.has(r.username)) map.set(r.username, { username: r.username, studentName: r.studentName, class: r.class, results: [] });
    map.get(r.username).results.push(r);
  }
  return [...map.values()];
}
