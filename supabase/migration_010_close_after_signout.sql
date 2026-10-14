-- Migration 010: a student can only review submitted work until they sign out.
-- Run once in Supabase → SQL Editor, before deploying the new student-api function.
--
-- closed_at is set when the student signs out (or next signs in) after
-- submitting. A subject with closed_at set no longer appears for review, and a
-- student with nothing new to take cannot sign in until the admin sets another
-- test or exam.
alter table exam_attempts add column if not exists closed_at timestamptz;
