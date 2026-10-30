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
    groupId: row.group_id,
    completed: row.completed,
    createdAt: row.created_at,
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
// All rows created in one call share a group_id: that is what makes them
// ONE sitting with ONE total time (durationMinutes is the total for the group).
export async function createAssignments(rows) {
  // One group per student: a group is one student's sitting, with its own
  // timer, so students must never share a group_id.
  const groupByStudent = new Map();
  const payload = rows.map(r => {
    if (!groupByStudent.has(r.studentId)) groupByStudent.set(r.studentId, crypto.randomUUID());
    return {
      group_id: groupByStudent.get(r.studentId),
      student_id: r.studentId,
      question_id: r.questionId,
      type: r.type,
      subject: r.subject,
      date: r.date,
      duration_minutes: r.durationMinutes,
      completed: false,
    };
  });
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

// Assigns the same question set for many students at once (a whole class).
// `plan` is [{ studentId, items: [{ questionId, subject }] }] — each student
// gets only the subjects they take. Returns the created assignment rows.
export async function assignToClass(plan, type, date, durationMinutes) {
  // Replace any pending assignment of the same type+subject, student by
  // student (so a student's other pending work is never touched), 10 at a time.
  for (let i = 0; i < plan.length; i += 10) {
    await Promise.all(plan.slice(i, i + 10).map(p =>
      replaceAssignments(p.studentId, type, [...new Set(p.items.map(it => it.subject))])));
  }
  const rows = plan.flatMap(p => p.items.map(it => ({
    studentId: p.studentId, questionId: it.questionId, type, subject: it.subject, date, durationMinutes,
  })));
  const created = await createAssignments(rows);
  const { error } = await supabase
    .from('students')
    .update({ status: 'test-active' })
    .in('id', plan.map(p => p.studentId));
  if (error) throw error;
  return created;
}
