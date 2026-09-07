-- ============================================================
-- Migration: real admin authentication
-- ============================================================
-- Run this once in Supabase SQL Editor.
--
-- What this does:
-- 1. Adds owner_id to schools, linking each school to a real
--    Supabase Auth user (an actual admin account).
-- 2. Tightens WRITE access on schools, license, and license_history
--    to the real owner only.
-- 3. Keeps school PROFILE data (name, logo, address, etc.) publicly
--    readable — this is intentional, not an oversight: students log
--    in from their own devices, which may never have had an admin
--    signed in on them. Without public read access here, a student's
--    device would have no way to even show their own school's name.
--    None of this is sensitive data (comparable to a business
--    directory listing), so this tradeoff is safe.
--
-- What this does NOT do: tighten students/questions/question_items/
-- assignments/results. Those stay open for now because students log
-- in through a separate username+surname check, not real Supabase
-- accounts — locking those down would break the student portal
-- entirely. That's a deliberate, temporary tradeoff, not an oversight.

alter table schools add column owner_id uuid references auth.users(id) on delete cascade;

drop policy "temporary open access" on schools;

create policy "anyone can view school profiles" on schools
  for select using (true);

create policy "owners can update their school" on schools
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "authenticated users can create their own school" on schools
  for insert with check (auth.uid() = owner_id);

-- Lets the very first real sign-up claim the old pre-auth test school
-- (owner_id is null) instead of starting from a blank slate and losing
-- whatever test data already exists.
create policy "authenticated users can claim an unclaimed school" on schools
  for update
  using (auth.uid() is not null and owner_id is null)
  with check (auth.uid() = owner_id);

drop policy "temporary open access" on license;
create policy "owners manage their license" on license for all
  using (school_id in (select id from schools where owner_id = auth.uid()))
  with check (school_id in (select id from schools where owner_id = auth.uid()));

drop policy "temporary open access" on license_history;
create policy "owners manage their license history" on license_history for all
  using (school_id in (select id from schools where owner_id = auth.uid()))
  with check (school_id in (select id from schools where owner_id = auth.uid()));
