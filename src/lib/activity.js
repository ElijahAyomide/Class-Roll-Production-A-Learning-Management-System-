// Builds the Dashboard's "Recent activity" list from data the app already
// has (students, question sets, assignments, results, license purchases).
// Nothing extra is stored: each item is worked out from a row's created_at.
// Bulk actions (an import of 22 students, a class assignment) are merged
// into ONE line so one action doesn't flood the list.

const MINUTE = 60 * 1000;

export function timeAgo(ts, now = Date.now()) {
  const diff = Math.max(0, now - ts);
  if (diff < MINUTE) return 'Just now';
  if (diff < 60 * MINUTE) { const m = Math.floor(diff / MINUTE); return `${m} minute${m === 1 ? '' : 's'} ago`; }
  const hours = Math.floor(diff / (60 * MINUTE));
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const t = (v) => (v ? new Date(v).getTime() : NaN);

// Merge rows whose key matches and whose timestamps are within `gapMs`
// of each other (a bulk action writes its rows within a few seconds).
function cluster(items, keyOf, gapMs) {
  const sorted = [...items].filter(i => !Number.isNaN(i.ts)).sort((a, b) => a.ts - b.ts);
  const groups = [];
  const lastByKey = new Map();
  for (const it of sorted) {
    const key = keyOf(it);
    const g = lastByKey.get(key);
    if (g && it.ts - g.end <= gapMs) { g.items.push(it); g.end = it.ts; }
    else { const ng = { key, items: [it], end: it.ts }; groups.push(ng); lastByKey.set(key, ng); }
  }
  return groups;
}

export function buildActivity({ students = [], questions = [], results = [], license = null }, limit = 8, now = Date.now()) {
  const events = [];

  // Students added (an import becomes one line per class).
  cluster(students.map(s => ({ ...s, ts: t(s.createdAt) })), s => s.class, 2 * MINUTE).forEach((g, i) => {
    const n = g.items.length;
    events.push({
      id: `st-${i}-${g.end}`, ts: g.end,
      text: n === 1 ? `Added ${g.items[0].name} to ${g.key}` : `Added ${plural(n, 'student')} to ${g.key}`,
    });
  });

  // Question sets uploaded.
  questions.forEach(q => {
    const ts = t(q.createdAt);
    if (!Number.isNaN(ts)) events.push({ id: `q-${q.id}`, ts, text: `Uploaded ${q.subject} ${q.type} for ${q.class}` });
  });

  // Question sets assigned (one line per class and type per action).
  const studentClass = new Map(students.map(s => [s.id, s.class]));
  const assigns = students.flatMap(s => s.assignments.map(a => ({
    ...a, ts: t(a.createdAt), cls: studentClass.get(a.studentId) || s.class,
  })));
  cluster(assigns, a => `${a.cls}`, 2 * MINUTE).forEach((g, i) => {
    const ids = new Set(g.items.map(a => a.studentId));
    const subjects = [...new Set(g.items.map(a => a.subject))];
    const [cls] = g.key.split('|');
    const subj = subjects.length > 3 ? `${subjects.slice(0, 3).join(', ')} +${subjects.length - 3} more` : subjects.join(', ');
    events.push({
      id: `as-${i}-${g.end}`, ts: g.end,
      text: `Assigned questions to ${ids.size === 1 ? '1 student' : plural(ids.size, 'student')} in ${cls}: ${subj}`,
    });
  });

  // Students who finished a question set (one line per exam and class, per day).
  cluster(results.map(r => ({ ...r, ts: t(r.createdAt) })),
    r => `${r.class}|${r.subject}`, 6 * 60 * MINUTE).forEach((g, i) => {
    const n = g.items.length;
    const [cls, subject] = g.key.split('|');
    events.push({
      id: `rs-${i}-${g.end}`, ts: g.end,
      text: `${n === 1 ? g.items[0].studentName : plural(n, 'student')} completed the ${subject} questions (${cls})`,
    });
  });

  // Credit purchases.
  (license?.history || []).forEach(h => {
    const ts = t(h.createdAt);
    if (!Number.isNaN(ts) && h.status === 'successful') events.push({ id: `lc-${h.id}`, ts, text: `Purchased ${plural(h.exams, 'exam credit')}` });
  });

  return events
    .sort((a, b) => b.ts - a.ts)
    .slice(0, limit)
    .map(e => ({ id: e.id, text: e.text, time: timeAgo(e.ts, now) }));
}
