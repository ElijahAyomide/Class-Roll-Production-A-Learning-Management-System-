-- ============================================================
-- Migration 004B: LOCK DOWN student data (run this LAST)
-- ============================================================
-- Only run this AFTER:
--   1. Migration 004A has been run,
--   2. The "student-api" function is deployed, and
--   3. You have tested the student login and an exam with the new
--      project files.
--
-- This replaces the "temporary open access" policies with real ones:
-- a signed-in admin can only see and change rows that belong to THEIR
-- school. The public key alone can no longer read answers, student
-- surnames, or results.

-- STUDENTS
drop policy "temporary open access" on students;
create policy "owners manage their students" on students for all
  using (school_id in (select id from schools where owner_id = auth.uid()))
  with check (school_id in (select id from schools where owner_id = auth.uid()));

-- QUESTIONS
drop policy "temporary open access" on questions;
create policy "owners manage their questions" on questions for all
  using (school_id in (select id from schools where owner_id = auth.uid()))
  with check (school_id in (select id from schools where owner_id = auth.uid()));

-- QUESTION ITEMS (checked through the question set they belong to)
drop policy "temporary open access" on question_items;
create policy "owners manage their question items" on question_items for all
  using (question_id in (
    select q.id from questions q
    where q.school_id in (select id from schools where owner_id = auth.uid())))
  with check (question_id in (
    select q.id from questions q
    where q.school_id in (select id from schools where owner_id = auth.uid())));

-- ASSIGNMENTS (checked through the student they belong to)
drop policy "temporary open access" on assignments;
create policy "owners manage their assignments" on assignments for all
  using (student_id in (
    select s.id from students s
    where s.school_id in (select id from schools where owner_id = auth.uid())))
  with check (student_id in (
    select s.id from students s
    where s.school_id in (select id from schools where owner_id = auth.uid())));

-- RESULTS: admins can only READ (and delete) results. Nobody can insert
-- or edit them from the browser — only the student-api function can.
drop policy "temporary open access" on results;
create policy "owners read their results" on results for select
  using (school_id in (select id from schools where owner_id = auth.uid()));
create policy "owners delete their results" on results for delete
  using (school_id in (select id from schools where owner_id = auth.uid()));
