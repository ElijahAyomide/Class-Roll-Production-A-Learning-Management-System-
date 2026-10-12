-- ============================================================
-- Migration 004A: tables for the secure student API
-- ============================================================
-- Run this FIRST. It only ADDS things — it does not lock anything
-- down, so your app keeps working exactly as before after running it.
--
-- These tables are used only by the "student-api" Edge Function.
-- Row Level Security is switched ON with NO policies, which means the
-- public key can never read or write them. Only the Edge Function
-- (which uses the private service role key) can.

-- 1) Student login sessions. We store a HASH of the token, never the
--    token itself, so even a database leak can't be used to sign in.
create table student_sessions (
  token_hash text primary key,
  student_id uuid not null references students(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index student_sessions_student_idx on student_sessions(student_id);
alter table student_sessions enable row level security;

-- 2) Failed login tracking, for the "5 wrong tries = locked 15 minutes" rule.
create table login_attempts (
  username_key text primary key,
  failures integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table login_attempts enable row level security;

-- 3) Exam attempts. started_at is set by the SERVER the first time a
--    student opens an exam, so the timer survives a page refresh and
--    can't be reset by the student.
create table exam_attempts (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references assignments(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  started_at timestamptz not null default now(),
  submitted_at timestamptz
);
alter table exam_attempts enable row level security;

-- 4) Link each result to its assignment, and make it unique, so the
--    same exam can never be saved (and scored) twice.
alter table results add column assignment_id uuid references assignments(id) on delete set null;
create unique index results_assignment_unique on results(assignment_id) where assignment_id is not null;
