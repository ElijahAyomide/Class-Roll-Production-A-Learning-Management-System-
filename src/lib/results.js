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
    // Results taken together (several subjects in one sitting) share a group id.
    groupId: row.assignments?.group_id || null,
  };
}

export async function fetchResults(schoolId) {
  // Ask for each result's sitting (group) too. If that lookup is ever refused,
  // fall back to plain results so the page still works (just without side-by-side subjects).
  let res = await supabase
    .from('results')
    .select('*, assignments(group_id)')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });
  if (res.error) {
    res = await supabase.from('results').select('*').eq('school_id', schoolId).order('created_at', { ascending: false });
  }
  if (res.error) throw res.error;
  return res.data.map(mapResult);
}

// Removes one result (for example when the wrong test or exam was assigned).
// Row-level security only lets a school delete its own results. We ask for the
// deleted row back so we can tell "deleted" from "nothing matched".
export async function deleteResult(id) {
  const { data, error } = await supabase.from('results').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('That result could not be deleted. Refresh the page and try again.');
}

// Removes several results at once (every subject of one sitting).
export async function deleteResults(ids) {
  if (!ids.length) return;
  const { data, error } = await supabase.from('results').delete().in('id', ids).select('id');
  if (error) throw error;
  if (!data || data.length !== ids.length) throw new Error('Some results could not be deleted. Refresh the page and try again.');
}
