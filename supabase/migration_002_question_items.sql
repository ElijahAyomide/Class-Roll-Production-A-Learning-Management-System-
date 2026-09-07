-- ============================================================
-- Migration: add question_items table
-- ============================================================
-- Run this once in Supabase SQL Editor. This is safe to run even
-- though your database already has data — it only adds one new
-- table, it doesn't touch anything existing.

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

alter table question_items enable row level security;

create policy "temporary open access" on question_items for all using (true) with check (true);
