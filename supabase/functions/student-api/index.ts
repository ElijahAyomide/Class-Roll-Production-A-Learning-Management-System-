// Supabase Edge Function: student-api
//
// This is the ONLY door students use to reach the database.
//
// Why: students log in with a username + surname, not a real Supabase
// account, so the database can't tell one student from another. Before
// this function existed, the student pages talked straight to the
// database through the public key, which meant anyone could read the
// correct answers or write fake results. Now the browser never touches
// the student tables at all. It asks THIS function, and this function:
//   - checks the login (with a lockout after 5 wrong tries),
//   - only ever returns that one student's own data,
//   - never sends correct answers to the browser,
//   - starts the exam timer on the server, so refreshing can't reset it,
//   - does the grading itself, and refuses to grade the same exam twice.
//
// Deploy: Supabase Dashboard → Edge Functions → Deploy a new function →
// Via Editor → name it exactly "student-api" → paste this file.
// IMPORTANT: after deploying, open the function's settings and turn OFF
// "Verify JWT" (students are not Supabase users, so they have no JWT).
// This function does its own checking instead.
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_FAILURES = 5;
const LOCKOUT_MINUTES = 15;
const SESSION_HOURS = 12;
const LATE_GRACE_SECONDS = 120; // slack for slow networks when time runs out

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// The database client is created lazily (the first time it's needed), not
// while the function is starting up, so a startup problem can never stop
// the function from answering the browser's pre-flight check.
let _client: any = null;
function getClient() {
  if (!_client) {
    _client = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return _client;
}
const supabase: any = new Proxy({}, {
  get: (_t, prop) => {
    const c = getClient();
    const v = c[prop as string];
    return typeof v === 'function' ? v.bind(c) : v;
  },
});

// ---------- small helpers ----------

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Nigeria is UTC+1 all year, so "today" for a school is today in UTC+1.
function todayInLagos(): string {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);
}

function gradeFor(score: number): string {
  if (score >= 75) return 'A';
  if (score >= 65) return 'B';
  if (score >= 55) return 'C';
  if (score >= 45) return 'D';
  return 'F';
}

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, c => '\\' + c);
}

// Turns a session token from the browser into the student it belongs to,
// or throws a 401 so the browser sends the student back to the login page.
async function requireStudent(token: unknown) {
  if (typeof token !== 'string' || token.length < 20) {
    throw new ApiError('Please sign in again.', 401);
  }
  const hash = await sha256Hex(token);
  const { data: session } = await supabase
    .from('student_sessions')
    .select('student_id, expires_at')
    .eq('token_hash', hash)
    .maybeSingle();
  if (!session || new Date(session.expires_at).getTime() < Date.now()) {
    throw new ApiError('Your session has expired. Please sign in again.', 401);
  }
  const { data: student } = await supabase
    .from('students')
    .select('id, school_id, name, username, class, status')
    .eq('id', session.student_id)
    .maybeSingle();
  if (!student) throw new ApiError('Please sign in again.', 401);
  if (student.status === 'suspended') {
    throw new ApiError('Your account has been suspended. Please contact your school admin.', 403);
  }
  return student;
}

async function getAvailableAssignments(studentId: string) {
  const { data, error } = await supabase
    .from('assignments')
    .select('id, type, subject, date, duration_minutes, question_id')
    .eq('student_id', studentId)
    .eq('completed', false)
    .lte('date', todayInLagos())
    .order('date');
  if (error) throw error;
  return data ?? [];
}

// ---------- actions ----------

async function login(body: any) {
  const username = String(body.username ?? '').trim();
  const surname = String(body.surname ?? '').trim();
  if (!username || !surname) throw new ApiError('Enter your username and surname.');
  if (username.length > 60 || surname.length > 60) throw new ApiError('Username or surname is incorrect.', 401);

  const key = username.toLowerCase();

  // 1) Is this username currently locked?
  const { data: attempt } = await supabase
    .from('login_attempts')
    .select('failures, locked_until')
    .eq('username_key', key)
    .maybeSingle();
  if (attempt?.locked_until && new Date(attempt.locked_until).getTime() > Date.now()) {
    const mins = Math.ceil((new Date(attempt.locked_until).getTime() - Date.now()) / 60000);
    throw new ApiError(`Too many wrong attempts. Please try again in ${mins} minute${mins === 1 ? '' : 's'}.`, 429);
  }

  // 2) Look for a matching student (case-insensitive).
  const { data: candidates } = await supabase
    .from('students')
    .select('id, school_id, name, username, surname, class, status')
    .ilike('username', escapeLike(username));
  const match = (candidates ?? []).find(
    s => s.username.toLowerCase() === key && s.surname.trim().toLowerCase() === surname.toLowerCase(),
  );

  if (!match) {
    const failures = (attempt?.failures ?? 0) + 1;
    const lock = failures >= MAX_FAILURES;
    await supabase.from('login_attempts').upsert({
      username_key: key,
      failures: lock ? 0 : failures,
      locked_until: lock ? new Date(Date.now() + LOCKOUT_MINUTES * 60000).toISOString() : null,
      updated_at: new Date().toISOString(),
    });
    if (lock) {
      throw new ApiError(`Too many wrong attempts. Please try again in ${LOCKOUT_MINUTES} minutes.`, 429);
    }
    throw new ApiError("Username or surname is incorrect. Check with your school admin if you're not sure.", 401);
  }

  if (match.status === 'suspended') {
    throw new ApiError('Your account has been suspended. Please contact your school admin.', 403);
  }

  const available = await getAvailableAssignments(match.id);
  if (available.length === 0) {
    throw new ApiError("You don't have any test or exam available to take right now. Check with your school admin.", 403);
  }

  // 3) Success: clear failures, create a session, hand back the token.
  await supabase.from('login_attempts').delete().eq('username_key', key);
  await supabase.from('student_sessions').delete().lt('expires_at', new Date().toISOString()); // tidy up old ones

  const token = newToken();
  const { error } = await supabase.from('student_sessions').insert({
    token_hash: await sha256Hex(token),
    student_id: match.id,
    expires_at: new Date(Date.now() + SESSION_HOURS * 3600 * 1000).toISOString(),
  });
  if (error) throw error;

  return { token };
}

async function logout(body: any) {
  if (typeof body.token === 'string' && body.token.length >= 20) {
    await supabase.from('student_sessions').delete().eq('token_hash', await sha256Hex(body.token));
  }
  return { ok: true };
}

async function home(body: any) {
  const student = await requireStudent(body.token);
  const { data: school } = await supabase.from('schools').select('name').eq('id', student.school_id).maybeSingle();
  const assignments = await getAvailableAssignments(student.id);
  return {
    student: { name: student.name, class: student.class },
    schoolName: school?.name ?? '',
    assignments: assignments.map(a => ({
      id: a.id, type: a.type, subject: a.subject, durationMinutes: a.duration_minutes,
    })),
  };
}

async function loadOwnAssignment(studentId: string, assignmentId: unknown) {
  if (typeof assignmentId !== 'string') throw new ApiError('Exam not found.', 404);
  const { data: a } = await supabase
    .from('assignments')
    .select('id, student_id, question_id, type, subject, date, duration_minutes, completed')
    .eq('id', assignmentId)
    .eq('student_id', studentId) // a student can only ever load THEIR OWN assignment
    .maybeSingle();
  if (!a) throw new ApiError('Exam not found.', 404);
  if (a.completed) throw new ApiError('You have already submitted this exam.', 409);
  if (a.date > todayInLagos()) throw new ApiError('This exam is not open yet.', 403);
  return a;
}

async function startExam(body: any) {
  const student = await requireStudent(body.token);
  const a = await loadOwnAssignment(student.id, body.assignmentId);

  const { data: qs } = await supabase.from('questions').select('title').eq('id', a.question_id).maybeSingle();
  if (!qs) throw new ApiError('This exam could not be found. Please contact your school admin.', 404);

  const { data: items, error } = await supabase
    .from('question_items')
    .select('id, question_text, option_a, option_b, option_c, option_d, order_index')
    .eq('question_id', a.question_id)
    .order('order_index');
  if (error) throw error;
  if (!items || items.length === 0) {
    throw new ApiError('No questions were found for this exam yet. Please contact your school admin.', 404);
  }

  // The first time only, record when the student started. If a row already
  // exists (page refresh), we keep the ORIGINAL start time.
  await supabase
    .from('exam_attempts')
    .upsert({ assignment_id: a.id, student_id: student.id }, { onConflict: 'assignment_id', ignoreDuplicates: true });
  const { data: attempt, error: attErr } = await supabase
    .from('exam_attempts')
    .select('started_at')
    .eq('assignment_id', a.id)
    .single();
  if (attErr) throw attErr;

  const elapsed = Math.floor((Date.now() - new Date(attempt.started_at).getTime()) / 1000);
  const secondsLeft = Math.max(0, a.duration_minutes * 60 - elapsed);

  return {
    assignment: { id: a.id, type: a.type, subject: a.subject, durationMinutes: a.duration_minutes },
    title: qs.title,
    secondsLeft,
    // NOTE: no correct answers here. That's the whole point.
    questions: items.map(i => ({
      id: i.id,
      text: i.question_text,
      options: [i.option_a, i.option_b, i.option_c, i.option_d],
    })),
  };
}

async function submitExam(body: any) {
  const student = await requireStudent(body.token);
  const a = await loadOwnAssignment(student.id, body.assignmentId);

  const { data: attempt } = await supabase
    .from('exam_attempts')
    .select('started_at')
    .eq('assignment_id', a.id)
    .maybeSingle();
  if (!attempt) throw new ApiError('This exam was never started.', 400);

  const elapsed = (Date.now() - new Date(attempt.started_at).getTime()) / 1000;
  const tooLate = elapsed > a.duration_minutes * 60 + LATE_GRACE_SECONDS;

  const { data: qs } = await supabase.from('questions').select('title').eq('id', a.question_id).maybeSingle();
  const { data: items, error } = await supabase
    .from('question_items')
    .select('id, correct_option')
    .eq('question_id', a.question_id);
  if (error) throw error;
  if (!items || items.length === 0) throw new ApiError('This exam has no questions.', 400);

  // Answers arrive as { questionItemId: 0|1|2|3 }. Anything else is ignored.
  // If the student submitted long after time ran out, their answers don't count.
  const answers: Record<string, unknown> = (!tooLate && body.answers && typeof body.answers === 'object') ? body.answers : {};
  const letterToIndex: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
  let correct = 0;
  for (const item of items) {
    if (answers[item.id] === letterToIndex[item.correct_option]) correct += 1;
  }
  const score = Math.round((correct / items.length) * 100);

  // The unique index on results.assignment_id means a double-submit
  // (two tabs, double-click) can only ever save ONE result.
  const { error: insErr } = await supabase.from('results').insert({
    school_id: student.school_id,
    student_id: student.id,
    assignment_id: a.id,
    student_name: student.name,
    username: student.username,
    class: student.class,
    subject: a.subject,
    exam_title: qs?.title ?? a.subject,
    score,
    total: 100,
    grade: gradeFor(score),
    type: a.type,
    date: todayInLagos(),
  });
  if (insErr && insErr.code !== '23505') throw insErr; // 23505 = already submitted, which is fine

  await supabase.from('assignments').update({ completed: true }).eq('id', a.id);
  await supabase.from('exam_attempts').update({ submitted_at: new Date().toISOString() }).eq('assignment_id', a.id);

  // Students are never shown their score. Results are admin-only.
  return { ok: true };
}

// ---------- entry point ----------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const body = await req.json();
    switch (body.action) {
      case 'login': return json(await login(body));
      case 'logout': return json(await logout(body));
      case 'home': return json(await home(body));
      case 'start': return json(await startExam(body));
      case 'submit': return json(await submitExam(body));
      default: return json({ error: 'Unknown action.' }, 400);
    }
  } catch (err) {
    if (err instanceof ApiError) return json({ error: err.message }, err.status);
    console.error('student-api error:', err);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
