-- ============================================================
-- Migration 005: every school automatically gets a license row
-- ============================================================
-- Bug fixed: registering a new school never created its license row,
-- so loading the admin dashboard failed and students looked missing.

-- 1) Fix schools that already exist but have no license row.
insert into license (school_id, balance, price_per_exam)
select id, 0, 200 from schools
where id not in (select school_id from license);

-- 2) From now on, create the license row automatically for every new school.
create or replace function create_license_for_new_school()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into license (school_id, balance, price_per_exam)
  values (new.id, 0, 200)
  on conflict (school_id) do nothing;
  return new;
end;
$$;

drop trigger if exists schools_create_license on schools;
create trigger schools_create_license
  after insert on schools
  for each row execute function create_license_for_new_school();
