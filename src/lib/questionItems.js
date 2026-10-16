import { supabase } from './supabaseClient';


export async function createQuestionItems(questionId, items) {
  const payload = items.map(it => ({
    question_id: questionId,
    question_text: it.questionText,
    option_a: it.optionA,
    option_b: it.optionB,
    option_c: it.optionC,
    option_d: it.optionD,
    correct_option: it.correctOption,
    order_index: it.orderIndex,
  }));
  const { error } = await supabase.from('question_items').insert(payload);
  if (error) throw error;
}

// Loads every question of a set for the editor (the admin can read their own
// questions, including the correct answers).
export async function fetchQuestionItems(questionId) {
  const { data, error } = await supabase
    .from('question_items')
    .select('id, question_text, option_a, option_b, option_c, option_d, correct_option, order_index')
    .eq('question_id', questionId)
    .order('order_index');
  if (error) throw error;
  return data.map(r => ({
    id: r.id,
    text: r.question_text,
    options: [r.option_a, r.option_b, r.option_c, r.option_d],
    correct: r.correct_option,
  }));
}

// Saves an edited set. `items` is the full list in its final order; rows that
// have an id are updated, rows without one are new, and `deletedIds` are
// removed. New rows go in first and deletions last, so a failure part-way can
// never leave the set with fewer questions than it started with.
export async function saveQuestionSet(questionId, { title, items, deletedIds }) {
  const toRow = (it, index) => ({
    question_text: it.text,
    option_a: it.options[0],
    option_b: it.options[1],
    option_c: it.options[2],
    option_d: it.options[3],
    correct_option: it.correct,
    order_index: index,
  });

  const fresh = items.map((it, i) => ({ it, i })).filter(x => !x.it.id);
  if (fresh.length) {
    const { error } = await supabase.from('question_items')
      .insert(fresh.map(x => ({ question_id: questionId, ...toRow(x.it, x.i) })));
    if (error) throw error;
  }

  const existing = items.map((it, i) => ({ it, i })).filter(x => x.it.id);
  const results = await Promise.all(existing.map(x =>
    supabase.from('question_items').update(toRow(x.it, x.i)).eq('id', x.it.id)));
  const failed = results.find(r => r.error);
  if (failed) throw failed.error;

  if (deletedIds.length) {
    const { error } = await supabase.from('question_items').delete().in('id', deletedIds);
    if (error) throw error;
  }

  const { data, error } = await supabase
    .from('questions')
    .update({ title, question_count: items.length })
    .eq('id', questionId)
    .select('title, question_count')
    .single();
  if (error) throw error;
  return { title: data.title, questionCount: data.question_count };
}
