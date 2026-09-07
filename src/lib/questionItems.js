import { supabase } from './supabaseClient';

function mapItem(row) {
  return {
    id: row.id,
    text: row.question_text,
    options: [row.option_a, row.option_b, row.option_c, row.option_d],
    correctIndex: { A: 0, B: 1, C: 2, D: 3 }[row.correct_option],
    orderIndex: row.order_index,
  };
}

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

// Fetched at exam time — shaped to drop straight into the exam-taking UI,
// which expects { id, text, options: [...], correctIndex }.
export async function fetchQuestionItems(questionId) {
  const { data, error } = await supabase
    .from('question_items')
    .select('*')
    .eq('question_id', questionId)
    .order('order_index');
  if (error) throw error;
  return data.map(mapItem);
}
