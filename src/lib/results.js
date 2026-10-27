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
    createdAt: row.created_at,
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

// Removes one result (for example when the wrong test or exam was assigned).
// Row-level security only lets a school delete its own results. We ask for the
// deleted row back so we can tell "deleted" from "nothing matched".
export async function deleteResult(id) {
  const { data, error } = await supabase.from('results').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('That result could not be deleted. Refresh the page and try again.');
}
