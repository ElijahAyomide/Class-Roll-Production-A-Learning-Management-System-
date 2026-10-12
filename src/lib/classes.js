import { supabase } from './supabaseClient';

function mapClass(row) {
  return {
    id: row.id,
    name: row.name,
    subjects: row.subjects || [],
    sortOrder: row.sort_order,
  };
}

// Tidies a subject list: trims, drops blanks, removes duplicates
// (ignoring upper/lower case), keeps the first spelling typed.
export function cleanSubjects(list) {
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const s = String(raw).trim().replace(/\s+/g, ' ');
    if (!s || seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    out.push(s);
  }
  return out;
}

export async function fetchClasses(schoolId) {
  const { data, error } = await supabase
    .from('school_classes')
    .select('*')
    .eq('school_id', schoolId)
    .order('sort_order')
    .order('created_at');
  if (error) throw error;
  return data.map(mapClass);
}

export async function createClass(schoolId, name, subjects, sortOrder) {
  const { data, error } = await supabase
    .from('school_classes')
    .insert({ school_id: schoolId, name: name.trim(), subjects: cleanSubjects(subjects), sort_order: sortOrder })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') throw new Error(`You already have a class called ${name.trim()}.`);
    throw error;
  }
  return mapClass(data);
}

export async function updateClassSubjects(classId, subjects) {
  const { data, error } = await supabase
    .from('school_classes')
    .update({ subjects: cleanSubjects(subjects) })
    .eq('id', classId)
    .select()
    .single();
  if (error) throw error;
  return mapClass(data);
}

// Renames the class everywhere (students, question sets, results) in one
// step — see rename_class() in migration 007.
export async function renameClass(classId, newName) {
  const { error } = await supabase.rpc('rename_class', { p_class_id: classId, p_new_name: newName });
  if (error) throw new Error(error.message || 'Could not rename this class.');
}

// Refuses to delete a class that still has students or question sets in it,
// so nothing is ever left pointing at a class that doesn't exist.
export async function deleteClass(schoolId, cls) {
  const [{ count: studentCount, error: e1 }, { count: questionCount, error: e2 }] = await Promise.all([
    supabase.from('students').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('class', cls.name),
    supabase.from('questions').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('class', cls.name),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  if (studentCount > 0 || questionCount > 0) {
    const parts = [];
    if (studentCount > 0) parts.push(`${studentCount} student${studentCount === 1 ? '' : 's'}`);
    if (questionCount > 0) parts.push(`${questionCount} question set${questionCount === 1 ? '' : 's'}`);
    throw new Error(`${cls.name} still has ${parts.join(' and ')}. Move or delete those first.`);
  }
  const { error } = await supabase.from('school_classes').delete().eq('id', cls.id);
  if (error) throw error;
}

// The common Nigerian secondary school setup, offered as a starting point
// to edit — never forced on a school.
const JUNIOR = ['Mathematics', 'English Language', 'Basic Science', 'Basic Technology', 'Social Studies', 'Civic Education', 'Agricultural Science', 'Business Studies'];
const SENIOR = ['Mathematics', 'English Language', 'Physics', 'Chemistry', 'Biology', 'Further Mathematics', 'Literature', 'Government', 'History', 'CRS', 'Accounting', 'Commerce', 'Economics', 'Business Studies'];

export async function seedTemplateClasses(schoolId) {
  const rows = [
    ['JSS1', JUNIOR], ['JSS2', JUNIOR], ['JSS3', JUNIOR],
    ['SS1', SENIOR], ['SS2', SENIOR], ['SS3', SENIOR],
  ].map(([name, subjects], i) => ({ school_id: schoolId, name, subjects, sort_order: i + 1 }));
  const { data, error } = await supabase.from('school_classes').insert(rows).select();
  if (error) throw error;
  return data.map(mapClass).sort((a, b) => a.sortOrder - b.sortOrder);
}
