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
    grade: row.grade,
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

export async function createResult(schoolId, studentId, result) {
  const { data, error } = await supabase
    .from('results')
    .insert({
      school_id: schoolId,
      student_id: studentId,
      student_name: result.studentName,
      username: result.username,
      class: result.class,
      subject: result.subject,
      exam_title: result.exam,
      score: result.score,
      total: result.total,
      grade: result.grade,
      type: result.type,
      date: result.date,
    })
    .select()
    .single();
  if (error) throw error;
  return mapResult(data);
}
