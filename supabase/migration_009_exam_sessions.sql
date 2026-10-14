-- Migration 009: one shared timer for all subjects, saved answers, pause on sign-out.
-- Run once in Supabase → SQL Editor, BEFORE deploying the new student-api function.

-- 1) Subjects set together share a "group". Each group has ONE timer.
--    Existing assignments each become their own group of one, so nothing breaks.
alter table assignments add column if not exists group_id uuid;
update assignments set group_id = id where group_id is null;
alter table assignments alter column group_id set not null;
alter table assignments alter column group_id set default gen_random_uuid();
create index if not exists assignments_group_idx on assignments(group_id);

-- 2) The shared timer. started_at is set by the server when the student opens
--    the first subject. paused_at / paused_seconds record time "stopped" while
--    the student was signed out (capped by the server so it can't be abused).
create table if not exists exam_sessions (
  group_id uuid primary key,
  student_id uuid not null references students(id) on delete cascade,
  started_at timestamptz not null default now(),
  paused_at timestamptz,
  paused_seconds integer not null default 0,
  finished_at timestamptz
);
alter table exam_sessions enable row level security;  -- no policies: only the server function can use it

-- Carry over any exam already in progress so its timer isn't reset.
insert into exam_sessions (group_id, student_id, started_at, finished_at)
select a.group_id, ea.student_id, ea.started_at, ea.submitted_at
from exam_attempts ea join assignments a on a.id = ea.assignment_id
on conflict (group_id) do nothing;

-- 3) Answers are now saved on the server as the student goes, so they can
--    sign back in and continue, and review a subject after submitting it.
create table if not exists attempt_answers (
  assignment_id uuid primary key references assignments(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table attempt_answers enable row level security;  -- server only
