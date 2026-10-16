import { supabase } from './supabaseClient';

function mapResult(row) {
  return {
    id: row.id,
    studentName: row.student_name,
    username: row.username,
    class: row.class,
    subject: row.subject,
    exam: row.exam_title,
    score: row.score,
    total: row.total,
    type: row.type,
    date: row.date,
  };
}

export async function fetchResults(schoolId) {
  const { data, error } = await supabase
    .from('results')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(mapResult);
}
