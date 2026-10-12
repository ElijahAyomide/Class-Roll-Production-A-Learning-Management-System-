import { supabase } from './supabaseClient';

function mapAssignment(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    questionId: row.question_id,
    type: row.type,
    subject: row.subject,
    date: row.date,
    durationMinutes: row.duration_minutes,
    completed: row.completed,
  };
}
// Fetches every assignment belonging to any student at this school, in one
// query (via a join on students.school_id), rather than one query per
// student. The caller (App.jsx) groups these back onto each student.
export async function fetchAssignmentsForSchool(schoolId) {
  const { data, error } = await supabase
    .from('assignments')
    .select('*, students!inner(school_id)')
    .eq('students.school_id', schoolId);
  if (error) throw error;
  return data.map(mapAssignment);
}

// Creates one row per selected subject in a single batch insert — this is
// what powers "assign multiple subjects at once" from the Dashboard.
export async function createAssignments(rows) {
  const payload = rows.map(r => ({
    student_id: r.studentId,
    question_id: r.questionId,
    type: r.type,
    subject: r.subject,
    date: r.date,
    duration_minutes: r.durationMinutes,
    completed: false,
  }));
  const { data, error } = await supabase.from('assignments').insert(payload).select();
  if (error) throw error;
  return data.map(mapAssignment);
}

// Removes any existing, not-yet-completed assignment of the same type+subject
// for this student before a new one is created — mirrors the old client-side
// "replace rather than duplicate" behavior from before this was persisted.
export async function replaceAssignments(studentId, type, subjects) {
  const { error } = await supabase
    .from('assignments')
    .delete()
    .eq('student_id', studentId)
    .eq('type', type)
    .eq('completed', false)
    .in('subject', subjects);
  if (error) throw error;
}
