// Subjects taken together in one sitting are shown side by side: one row per
// student per sitting, one column per subject, then a total. Results that are
// a single subject stay in a normal list. The Results page, the printed
// report, the result slips and the Excel export all use this one function so
// they always look the same.
//
// `results` are the rows already filtered on screen. Returns:
//   tables  [{ cls, subjects: [...], rows: [{ key, studentName, username, class, type, date,
//                                             cells: Map(subject -> result), items: [results],
//                                             score, max, pct }] }]
//   singles [result, ...]   (in the order they were given)
export function groupSittings(results, sortBy = 'newest') {
  const bySitting = new Map();
  const singles = [];
  for (const r of results) {
    if (!r.groupId) { singles.push(r); continue; }
    if (!bySitting.has(r.groupId)) bySitting.set(r.groupId, []);
    bySitting.get(r.groupId).push(r);
  }

  const byClass = new Map();
  for (const [groupId, list] of bySitting) {
    if (list.length < 2) { singles.push(...list); continue; }
    const first = list[0];
    const score = list.reduce((n, r) => n + r.score, 0);
    const max = list.reduce((n, r) => n + r.total, 0);
    const row = {
      key: groupId, studentName: first.studentName, username: first.username, class: first.class,
      type: first.type, date: first.date,
      cells: new Map(list.map(r => [r.subject, r])), items: list,
      score, max, pct: max ? (score / max) * 100 : 0,
    };
    if (!byClass.has(first.class)) byClass.set(first.class, []);
    byClass.get(first.class).push(row);
  }

  const sorter = (a, b) =>
    sortBy === 'name' ? a.studentName.localeCompare(b.studentName)
      : sortBy === 'score' ? b.pct - a.pct
        : 0;

  const tables = [...byClass.entries()].map(([cls, rows]) => ({
    cls,
    subjects: [...new Set(rows.flatMap(r => [...r.cells.keys()]))].sort(),
    rows: [...rows].sort(sorter),
  }));

  const order = new Map(results.map((r, i) => [r.id, i]));
  singles.sort((a, b) => order.get(a.id) - order.get(b.id));
  return { tables, singles };
}

export const pctText = (n) => `${Math.round(n * 10) / 10}%`;
