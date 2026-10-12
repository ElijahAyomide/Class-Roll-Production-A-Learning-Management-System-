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
