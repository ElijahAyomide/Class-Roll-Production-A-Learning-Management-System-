-- ============================================================
-- ClassRoll — Database Schema (Phase 3)
-- ============================================================
-- Run this once in Supabase: Project → SQL Editor → New Query →
-- paste this whole file → Run.
--
-- This creates every table the app needs. Some tables (questions,
-- assignments, results, license) aren't wired up to the frontend
-- yet — that's next session — but creating them now means you
-- only ever have to run one schema file, not several.
-- ============================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------
-- SCHOOLS — one row per school using ClassRoll
-- ----------------------------------------------------------------
create table schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  address text,
  state text,
  lga text,
  email text,
  phone text,
  logo_url text,
  created_at timestamptz default now()
);

-- ----------------------------------------------------------------
-- STUDENTS
-- ----------------------------------------------------------------
create table students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade not null,
  name text not null,
  username text not null,
  surname text not null,
  class text not null,
  subjects text[] not null default '{}',
  status text not null default 'pending'
    check (status in ('pending', 'test-active', 'exam-active', 'suspended')),
  created_at timestamptz default now(),
  unique (school_id, username)
);

-- ----------------------------------------------------------------
-- QUESTIONS — the Question Bank (test/exam question sets)
-- ----------------------------------------------------------------
create table questions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade not null,
  title text not null,
  subject text not null,
  class text not null,
  type text not null check (type in ('test', 'exam')),
  file_name text,
  file_url text,
  question_count integer default 0,
  status text not null default 'draft' check (status in ('draft', 'ready')),
  upload_date date default current_date,
  created_at timestamptz default now()
);

-- ----------------------------------------------------------------
-- ASSIGNMENTS — a specific test/exam set for a specific student
-- ----------------------------------------------------------------
create table assignments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade not null,
  question_id uuid references questions(id) on delete cascade not null,
  type text not null check (type in ('test', 'exam')),
  subject text not null,
  date date not null,
  duration_minutes integer not null,
  completed boolean not null default false,
  created_at timestamptz default now()
);

-- ----------------------------------------------------------------
-- QUESTION ITEMS — the individual questions inside a question set,
-- parsed from the admin's uploaded Excel file. This is what the exam
-- engine actually reads from and grades against.
-- ----------------------------------------------------------------
create table question_items (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references questions(id) on delete cascade not null,
  question_text text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option text not null check (correct_option in ('A', 'B', 'C', 'D')),
  order_index integer not null default 0,
  created_at timestamptz default now()
);

-- ----------------------------------------------------------------
-- RESULTS
-- ----------------------------------------------------------------
create table results (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade not null,
  student_id uuid references students(id) on delete cascade not null,
  student_name text not null,
  username text not null,
  class text not null,
  subject text not null,
  exam_title text not null,
  score integer not null,
  total integer not null default 100,
  grade text not null,
  type text not null check (type in ('test', 'exam')),
  date date default current_date,
  created_at timestamptz default now()
);

-- ----------------------------------------------------------------
-- LICENSE — one balance row per school
-- ----------------------------------------------------------------
create table license (
  school_id uuid primary key references schools(id) on delete cascade,
  balance integer not null default 0,
  price_per_exam integer not null default 200
);

create table license_history (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade not null,
  date date default current_date,
  exams integer not null,
  amount integer not null,
  reference text,
  status text default 'successful',
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- Enabled from day one, but with permissive policies for now since
-- there's no real login yet (that's Phase 4). Every policy below is
-- intentionally wide open to the public API key. Once Phase 4 adds
-- real authentication, these get tightened to "a school can only
-- read/write its own rows" — flagged clearly when we get there so
-- this isn't forgotten before going live with real schools.

alter table schools enable row level security;
alter table students enable row level security;
alter table questions enable row level security;
alter table assignments enable row level security;
alter table question_items enable row level security;
alter table results enable row level security;
alter table license enable row level security;
alter table license_history enable row level security;

create policy "temporary open access" on schools for all using (true) with check (true);
create policy "temporary open access" on students for all using (true) with check (true);
create policy "temporary open access" on questions for all using (true) with check (true);
create policy "temporary open access" on assignments for all using (true) with check (true);
create policy "temporary open access" on question_items for all using (true) with check (true);
create policy "temporary open access" on results for all using (true) with check (true);
create policy "temporary open access" on license for all using (true) with check (true);
create policy "temporary open access" on license_history for all using (true) with check (true);

-- ============================================================
-- SEED DATA — one starter school so the app has something to load
-- ============================================================
insert into schools (name, code, address, state, lga, email, phone)
values ('Green Valley College', 'GVC', '14 Adeola Street, Ikeja, Lagos', 'Lagos', 'Ikeja', 'admin@greenvalleycollege.edu.ng', '+234 801 234 5678');

insert into license (school_id, balance, price_per_exam)
select id, 84, 200 from schools where code = 'GVC';
