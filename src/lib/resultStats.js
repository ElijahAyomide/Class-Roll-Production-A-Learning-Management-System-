// Summary numbers shown under a printed results report or on a result slip.
export function resultStats(results) {
  const count = results.length;
  const distribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  if (count === 0) return { count, average: 0, highest: 0, lowest: 0, distribution };

  let total = 0, highest = -Infinity, lowest = Infinity;
  for (const r of results) {
    const pct = r.total ? (r.score / r.total) * 100 : 0;
    total += pct;
    highest = Math.max(highest, pct);
    lowest = Math.min(lowest, pct);
    if (distribution[r.grade] !== undefined) distribution[r.grade] += 1;
  }
  return {
    count,
    average: Math.round((total / count) * 10) / 10,
    highest: Math.round(highest),
    lowest: Math.round(lowest),
    distribution,
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
