import { supabase } from './supabaseClient';

function mapQuestion(row) {
  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    class: row.class,
    type: row.type,
    fileName: row.file_name || '',
    fileType: (row.file_name || '').split('.').pop().toLowerCase() === 'pdf' ? 'pdf' : 'docx',
    questionCount: row.question_count || 0,
    status: row.status,
    uploadDate: row.upload_date,
    createdAt: row.created_at,
  };
}

export async function fetchQuestionById(questionId) {
  const { data, error } = await supabase.from('questions').select('*').eq('id', questionId).maybeSingle();
  if (error) throw error;
  return data ? mapQuestion(data) : null;
}

export async function fetchQuestions(schoolId) {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(mapQuestion);
}

export async function createQuestion(schoolId, question) {
  const { data, error } = await supabase
    .from('questions')
    .insert({
      school_id: schoolId,
      title: question.title,
      subject: question.subject,
      class: question.class,
      type: question.type,
      file_name: question.fileName,
      question_count: question.questionCount || 0,
      status: question.status || 'draft',
    })
    .select()
    .single();
  if (error) throw error;
  return mapQuestion(data);
}

export async function deleteQuestion(questionId) {
  const { error } = await supabase.from('questions').delete().eq('id', questionId);
  if (error) throw error;
}
