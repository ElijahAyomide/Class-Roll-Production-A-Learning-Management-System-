import { supabase } from './supabaseClient';
import { createQuestion, deleteQuestion } from './questions';
import { createQuestionItems } from './questionItems';

// The Library is a shared set of ready-made practice questions (see
// supabase/migration_013_library.sql). Schools never edit it: they copy a
// selection into their own Question Bank, where it behaves like any other set.

// [{ subject, total, topics: [{ topic, count }] }] for the Library screen.
export async function fetchLibrarySubjects() {
  const { data, error } = await supabase
    .from('library_topic_counts')
    .select('subject, topic, question_count')
    .order('subject')
    .order('topic');
  if (error) throw error;
  const bySubject = new Map();
  for (const r of data) {
    if (!bySubject.has(r.subject)) bySubject.set(r.subject, { subject: r.subject, total: 0, topics: [] });
    const s = bySubject.get(r.subject);
    s.topics.push({ topic: r.topic, count: r.question_count });
    s.total += r.question_count;
  }
  return [...bySubject.values()];
}

function shuffle(list) {
  const a = [...list];
  const buf = new Uint32Array(a.length);
  crypto.getRandomValues(buf);
  for (let i = a.length - 1; i > 0; i--) {
    const j = buf[i] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Picks `count` questions from the chosen topics, taking turns between the
// topics so every chosen topic is represented as evenly as possible.
export function pickQuestions(rows, topics, count) {
  const queues = topics.map(t => shuffle(rows.filter(r => r.topic === t)));
  const picked = [];
  while (picked.length < count && queues.some(q => q.length)) {
    for (const q of queues) {
      if (picked.length >= count) break;
      if (q.length) picked.push(q.shift());
    }
  }
  return shuffle(picked);
}

// Copies a selection of library questions into the school's own Question Bank
// as a new "ready" set, and returns that set.
export async function createSetFromLibrary({ schoolId, librarySubject, subject, topics, count, type, cls, title }) {
  const { data, error } = await supabase
    .from('library_questions')
    .select('topic, question_text, option_a, option_b, option_c, option_d, correct_option')
    .eq('subject', librarySubject)
    .in('topic', topics);
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('No questions were found for those topics.');

  const chosen = pickQuestions(data, topics, Math.min(count, data.length));
  const saved = await createQuestion(schoolId, {
    title, subject, class: cls, type, fileName: 'Assessly Library', questionCount: chosen.length, status: 'ready',
  });
  try {
    await createQuestionItems(saved.id, chosen.map((r, i) => ({
      questionText: r.question_text, optionA: r.option_a, optionB: r.option_b, optionC: r.option_c, optionD: r.option_d,
      correctOption: r.correct_option, orderIndex: i,
    })));
  } catch (err) {
    // Don't leave an empty set behind if copying the questions failed.
    try { await deleteQuestion(saved.id); } catch { /* nothing more to do */ }
    throw err;
  }
  return { ...saved, questionCount: chosen.length, fileType: 'docx', uploadDate: new Date().toISOString().slice(0, 10) };
}
