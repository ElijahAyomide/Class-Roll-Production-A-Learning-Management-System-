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
//   - runs ONE timer per sitting on the server (all subjects set together share
//     the same total time), so refreshing or signing out can't reset it,
//   - saves answers as the student goes, so they can continue after signing back in,
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
// If a student signs out in the middle of a test, their clock is paused while
// they are away, but only up to this much in total, so signing out can't be
// used to get unlimited extra time. Change this number to be more or less generous.
const MAX_PAUSE_SECONDS = 600;

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

// ---------- the shared timer ----------
//
// All subjects set together belong to one "group" and share one clock.
// started_at is set by the server the first time ANY subject of the group is
// opened. If the student signs out, the clock is paused (up to
// MAX_PAUSE_SECONDS in total) and resumes when they sign back in.

function elapsedSeconds(s: any, nowMs = Date.now()): number {
  let paused = s.paused_seconds ?? 0;
  if (s.paused_at) {
    const awaySoFar = Math.floor((nowMs - new Date(s.paused_at).getTime()) / 1000);
    paused += Math.max(0, Math.min(awaySoFar, MAX_PAUSE_SECONDS - paused));
  }
  return Math.max(0, Math.floor((nowMs - new Date(s.started_at).getTime()) / 1000) - paused);
}

async function getSession(groupId: string) {
  const { data } = await supabase.from('exam_sessions').select('*').eq('group_id', groupId).maybeSingle();
  return data;
}

// Un-pauses a session, crediting the (capped) time the student was away.
async function resumeSession(s: any) {
  if (!s || !s.paused_at || s.finished_at) return s;
  const away = Math.max(0, Math.floor((Date.now() - new Date(s.paused_at).getTime()) / 1000));
  const credit = Math.max(0, Math.min(away, MAX_PAUSE_SECONDS - (s.paused_seconds ?? 0)));
  const next = { paused_at: null, paused_seconds: (s.paused_seconds ?? 0) + credit };
  await supabase.from('exam_sessions').update(next).eq('group_id', s.group_id);
  return { ...s, ...next };
}

async function ensureSession(groupId: string, studentId: string) {
  await supabase
    .from('exam_sessions')
    .upsert({ group_id: groupId, student_id: studentId }, { onConflict: 'group_id', ignoreDuplicates: true });
  const s = await getSession(groupId);
  if (!s) throw new ApiError('Could not start the exam. Please try again.', 500);
  return s;
}

// ---------- question order ----------

// Every student gets the same questions in their own random-looking order.
// The order is worked out from the student's own assignment id, so it is
// different for each student but always the SAME for that student: it doesn't
// change if they refresh, sign out and back in, or look back at their answers.
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
async function shuffleFor<T>(items: T[], seedText: string): Promise<T[]> {
  const hex = await sha256Hex(seedText);
  const rand = mulberry32(parseInt(hex.slice(0, 8), 16));
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {   // Fisher-Yates shuffle
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------- grading ----------

// Keeps only answers that belong to this exam's questions and are 0-3.
function cleanAnswers(raw: unknown, validIds: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return out;
  const valid = new Set(validIds);
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (valid.has(k) && Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 3) out[k] = v as number;
  }
  return out;
}

async function getStoredAnswers(assignmentId: string): Promise<Record<string, number>> {
  const { data } = await supabase.from('attempt_answers').select('answers').eq('assignment_id', assignmentId).maybeSingle();
  return (data?.answers && typeof data.answers === 'object') ? data.answers : {};
}

// Grades one subject and records it. Safe to call twice (unique index on results).
async function gradeAssignment(student: any, a: any, rawAnswers: unknown) {
  const { data: qs } = await supabase.from('questions').select('title').eq('id', a.question_id).maybeSingle();
  const { data: items, error } = await supabase
    .from('question_items').select('id, correct_option').eq('question_id', a.question_id);
  if (error) throw error;
  if (!items || items.length === 0) throw new ApiError('This exam has no questions.', 400);

  const answers = cleanAnswers(rawAnswers, items.map((i: any) => i.id));
  const letterToIndex: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
  let correct = 0;
  for (const item of items) {
    if (answers[item.id] === letterToIndex[item.correct_option]) correct += 1;
  }
  const score = Math.round((correct / items.length) * 100);

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

  await supabase.from('attempt_answers').upsert(
    { assignment_id: a.id, student_id: student.id, answers, updated_at: new Date().toISOString() },
    { onConflict: 'assignment_id' },
  );
  await supabase.from('assignments').update({ completed: true }).eq('id', a.id);
  await supabase.from('exam_attempts').upsert(
    { assignment_id: a.id, student_id: student.id, submitted_at: new Date().toISOString() },
    { onConflict: 'assignment_id' },
  );
}

async function markGroupFinishedIfDone(groupId: string) {
  const { count } = await supabase
    .from('assignments').select('id', { count: 'exact', head: true })
    .eq('group_id', groupId).eq('completed', false);
  if (count === 0) {
    await supabase.from('exam_sessions').update({ finished_at: new Date().toISOString() }).eq('group_id', groupId);
  }
}

// When a group's total time has run out, every subject still unsubmitted is
// graded from the answers saved so far (subjects never opened score 0).
async function finalizeGroup(student: any, groupId: string) {
  const { data: pending } = await supabase
    .from('assignments')
    .select('id, student_id, question_id, type, subject, group_id')
    .eq('group_id', groupId).eq('student_id', student.id).eq('completed', false);
  for (const a of pending ?? []) {
    try {
      await gradeAssignment(student, a, await getStoredAnswers(a.id));
    } catch (e) {
      console.error('finalizeGroup: could not grade', a.id, e);
    }
  }
  await markGroupFinishedIfDone(groupId);
}

// Called before showing anything: if a started group is out of time, close it.
async function finalizeExpiredGroups(student: any, groupIds: string[]) {
  for (const gid of groupIds) {
    const s = await getSession(gid);
    if (!s || s.finished_at) continue;
    const { data: one } = await supabase
      .from('assignments').select('duration_minutes').eq('group_id', gid).limit(1).maybeSingle();
    if (!one) continue;
    if (elapsedSeconds(s) >= one.duration_minutes * 60) await finalizeGroup(student, gid);
  }
}

// ---------- what a student can see ----------

const ASSIGNMENT_COLS = 'id, type, subject, date, duration_minutes, question_id, group_id, completed';

async function listForStudent(studentId: string) {
  const { data: todo, error } = await supabase
    .from('assignments').select(ASSIGNMENT_COLS)
    .eq('student_id', studentId).eq('completed', false).lte('date', todayInLagos()).order('date');
  if (error) throw error;

  // Submitted subjects stay available for review until the student signs out.
  const { data: recent } = await supabase
    .from('exam_attempts').select('assignment_id')
    .eq('student_id', studentId).not('submitted_at', 'is', null).is('closed_at', null);
  const ids = (recent ?? []).map((r: any) => r.assignment_id);
  let done: any[] = [];
  if (ids.length) {
    const { data } = await supabase
      .from('assignments').select(ASSIGNMENT_COLS)
      .eq('student_id', studentId).eq('completed', true).in('id', ids).order('date');
    done = data ?? [];
  }
  return { todo: todo ?? [], done };
}

// Closes any out-of-time groups first, then lists what is left.
async function freshList(student: any) {
  const first = await listForStudent(student.id);
  const groupIds = [...new Set(first.todo.map((a: any) => a.group_id))] as string[];
  if (groupIds.length === 0) return first;
  await finalizeExpiredGroups(student, groupIds);
  return await listForStudent(student.id);
}

// Ends the review window for everything the student has submitted.
async function closeSubmitted(studentId: string) {
  await supabase.from('exam_attempts')
    .update({ closed_at: new Date().toISOString() })
    .eq('student_id', studentId).not('submitted_at', 'is', null).is('closed_at', null);
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

  // Signing in again ends the review of anything submitted earlier.
  await closeSubmitted(match.id);

  // Resume the clock of any sitting they signed out of in the middle, then check what's available.
  const mine = await listForStudent(match.id);
  for (const gid of new Set(mine.todo.map((a: any) => a.group_id))) {
    await resumeSession(await getSession(gid as string));
  }
  const list = await freshList(match);
  if (list.todo.length === 0) {
    throw new ApiError("You have no test or exam to take right now. You can sign in again when your school sets a new one.", 403);
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
    const hash = await sha256Hex(body.token);
    const { data: session } = await supabase.from('student_sessions').select('student_id').eq('token_hash', hash).maybeSingle();
    if (session) {
      // Anything already submitted can no longer be reviewed after signing out.
      await closeSubmitted(session.student_id);
      // Pause the clock of any sitting that is still running.
      const { data: running } = await supabase
        .from('exam_sessions').select('group_id')
        .eq('student_id', session.student_id).is('finished_at', null).is('paused_at', null);
      if ((running ?? []).length) {
        await supabase.from('exam_sessions').update({ paused_at: new Date().toISOString() })
          .in('group_id', running.map((r: any) => r.group_id));
      }
    }
    await supabase.from('student_sessions').delete().eq('token_hash', hash);
  }
  return { ok: true };
}

async function home(body: any) {
  const student = await requireStudent(body.token);
  const { data: school } = await supabase.from('schools').select('name').eq('id', student.school_id).maybeSingle();
  const { todo, done } = await freshList(student);

  // One timer per group that still has something to do.
  const groups: Record<string, any> = {};
  for (const gid of new Set(todo.map((a: any) => a.group_id))) {
    const s = await resumeSession(await getSession(gid as string)); // being on this page means they're back
    const total = todo.find((a: any) => a.group_id === gid).duration_minutes * 60;
    groups[gid as string] = {
      totalMinutes: total / 60,
      started: !!s,
      secondsLeft: s ? Math.max(0, total - elapsedSeconds(s)) : total,
    };
  }

  const shape = (a: any, status: string) => ({
    id: a.id, type: a.type, subject: a.subject, groupId: a.group_id, status,
    opened: status === 'todo' ? !!groups[a.group_id]?.started : true,
  });
  return {
    student: { name: student.name, class: student.class },
    schoolName: school?.name ?? '',
    pauseMinutes: MAX_PAUSE_SECONDS / 60,
    groups,
    assignments: [...todo.map((a: any) => shape(a, 'todo')), ...done.map((a: any) => shape(a, 'done'))],
  };
}

// All the still-open subjects of one sitting (group) for this student.
async function openSubjects(studentId: string, groupId: unknown) {
  if (typeof groupId !== 'string') throw new ApiError('Exam not found.', 404);
  const { data } = await supabase
    .from('assignments')
    .select('id, student_id, question_id, type, subject, date, duration_minutes, completed, group_id')
    .eq('group_id', groupId).eq('student_id', studentId).eq('completed', false)
    .lte('date', todayInLagos()).order('subject');
  return data ?? [];
}

// Starts (or resumes) the whole sitting: every subject comes back together.
async function startSitting(body: any) {
  const student = await requireStudent(body.token);
  if (typeof body.groupId !== 'string') throw new ApiError('Exam not found.', 404);

  // If the sitting is already out of time, close it and send the student back.
  await finalizeExpiredGroups(student, [body.groupId]);
  const subjects = await openSubjects(student.id, body.groupId);
  if (subjects.length === 0) throw new ApiError('This sitting is already finished.', 409);

  const out: any[] = [];
  for (const a of subjects) {
    const { data: qs } = await supabase.from('questions').select('title').eq('id', a.question_id).maybeSingle();
    const { data: items, error } = await supabase
      .from('question_items')
      .select('id, question_text, option_a, option_b, option_c, option_d, order_index')
      .eq('question_id', a.question_id).order('order_index');
    if (error) throw error;
    if (!qs || !items || items.length === 0) {
      throw new ApiError(`No questions were found for ${a.subject} yet. Please contact your school admin.`, 404);
    }
    const ordered = await shuffleFor(items, a.id); // this student's own question order
    out.push({
      id: a.id, subject: a.subject, type: a.type, title: qs.title,
      answers: cleanAnswers(await getStoredAnswers(a.id), items.map((i: any) => i.id)), // continue where they stopped
      // NOTE: no correct answers here. That's the whole point.
      questions: ordered.map((i: any) => ({
        id: i.id, text: i.question_text, options: [i.option_a, i.option_b, i.option_c, i.option_d],
      })),
    });
  }

  // The ONE clock for the sitting starts the first time it is opened.
  const session = await resumeSession(await ensureSession(body.groupId, student.id));
  const total = subjects[0].duration_minutes * 60;
  const secondsLeft = Math.max(0, total - elapsedSeconds(session));

  await supabase.from('exam_attempts').upsert(
    subjects.map((a: any) => ({ assignment_id: a.id, student_id: student.id })),
    { onConflict: 'assignment_id', ignoreDuplicates: true },
  );

  return { groupId: body.groupId, type: subjects[0].type, totalMinutes: subjects[0].duration_minutes, secondsLeft, subjects: out };
}

// Saves answers as the student goes. body.answers = { assignmentId: { questionId: 0-3 } }
async function saveAnswers(body: any) {
  const student = await requireStudent(body.token);
  const subjects = await openSubjects(student.id, body.groupId);
  if (subjects.length === 0) throw new ApiError('This sitting is already finished.', 409);

  const session = await getSession(body.groupId);
  if (!session) throw new ApiError('This exam was never started.', 400);
  const secondsLeft = subjects[0].duration_minutes * 60 - elapsedSeconds(session);
  if (secondsLeft < -LATE_GRACE_SECONDS) throw new ApiError('Time is up for this exam.', 409);

  const sent = (body.answers && typeof body.answers === 'object') ? body.answers : {};
  for (const a of subjects) {
    if (!(a.id in sent)) continue;
    const { data: items } = await supabase.from('question_items').select('id').eq('question_id', a.question_id);
    const clean = cleanAnswers(sent[a.id], (items ?? []).map((i: any) => i.id));
    await supabase.from('attempt_answers').upsert(
      { assignment_id: a.id, student_id: student.id, answers: clean, updated_at: new Date().toISOString() },
      { onConflict: 'assignment_id' },
    );
  }
  return { ok: true, secondsLeft: Math.max(0, secondsLeft) };
}

// One Submit for the whole sitting: every subject is graded together.
async function submitSitting(body: any) {
  const student = await requireStudent(body.token);
  const subjects = await openSubjects(student.id, body.groupId);
  if (subjects.length === 0) throw new ApiError('You have already submitted this exam.', 409);

  const session = await getSession(body.groupId);
  if (!session) throw new ApiError('This exam was never started.', 400);

  const total = subjects[0].duration_minutes * 60;
  // Submitted long after time ran out? Then only what was already saved counts.
  const tooLate = elapsedSeconds(session) > total + LATE_GRACE_SECONDS;
  const sent = (body.answers && typeof body.answers === 'object') ? body.answers : {};

  for (const a of subjects) {
    const raw = (!tooLate && a.id in sent) ? sent[a.id] : await getStoredAnswers(a.id);
    await gradeAssignment(student, a, raw);
  }
  await markGroupFinishedIfDone(body.groupId);

  // Students are never shown their score. Results are admin-only.
  return { ok: true };
}

// Everything submitted (and not yet closed by signing out), read-only: the
// student's own answers, no marking, no score.
async function review(body: any) {
  const student = await requireStudent(body.token);
  const { done } = await listForStudent(student.id);
  const out: any[] = [];
  for (const a of done) {
    const { data: qs } = await supabase.from('questions').select('title').eq('id', a.question_id).maybeSingle();
    const { data: items } = await supabase
      .from('question_items')
      .select('id, question_text, option_a, option_b, option_c, option_d, order_index')
      .eq('question_id', a.question_id).order('order_index');
    const ordered = await shuffleFor(items ?? [], a.id); // same order the student saw during the exam
    out.push({
      id: a.id, subject: a.subject, type: a.type, title: qs?.title ?? a.subject,
      answers: cleanAnswers(await getStoredAnswers(a.id), (items ?? []).map((i: any) => i.id)),
      questions: ordered.map((i: any) => ({
        id: i.id, text: i.question_text, options: [i.option_a, i.option_b, i.option_c, i.option_d],
      })),
    });
  }
  if (out.length === 0) throw new ApiError('There is nothing to review.', 404);
  return { subjects: out };
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
      case 'start': return json(await startSitting(body));
      case 'save': return json(await saveAnswers(body));
      case 'submit': return json(await submitSitting(body));
      case 'review': return json(await review(body));
      default: return json({ error: 'Unknown action.' }, 400);
    }
  } catch (err) {
    if (err instanceof ApiError) return json({ error: err.message }, err.status);
    console.error('student-api error:', err);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
