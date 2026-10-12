import { supabase } from './supabaseClient';

function mapStudent(row) {
  return {
    id: row.id,
    schoolId: row.school_id,
    name: row.name,
    username: row.username,
    surname: row.surname,
    class: row.class,
    subjects: row.subjects || [],
    status: row.status,
    // Assignments live in their own table and are fetched separately
    // (see fetchAssignmentsForSchool / fetchAssignmentsForStudent in
    // assignments.js) — every student gets an empty array by default
    // here so callers that haven't merged assignments in yet don't break.
    // persist across a reload until the assignments table is connected.
    assignments: [],
  };
}

export async function fetchStudents(schoolId) {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at');
  if (error) throw error;
  return data.map(mapStudent);
}
export async function createStudent(schoolId, student) {
  const { data, error } = await supabase
    .from('students')
    .insert({
      school_id: schoolId,
      name: student.name,
      username: student.username,
      surname: student.surname,
      class: student.class,
      subjects: student.subjects,
      status: student.status || 'pending',
    })
    .select()
    .single();
  if (error) throw error;
  return mapStudent(data);
}

export async function updateStudent(studentId, updates) {
  const payload = {};
  if ('name' in updates) payload.name = updates.name;
  if ('class' in updates) payload.class = updates.class;
  if ('subjects' in updates) payload.subjects = updates.subjects;
  if ('status' in updates) payload.status = updates.status;

  const { data, error } = await supabase
    .from('students')
    .update(payload)
    .eq('id', studentId)
    .select()
    .single();
  if (error) throw error;
  return mapStudent(data);
}

export async function deleteStudent(studentId) {
  const { error } = await supabase.from('students').delete().eq('id', studentId);
  if (error) throw error;
}
