-- ============================================================
-- Migration 007: each school manages its own classes and subjects
-- ============================================================
-- Run once in Supabase SQL Editor. Safe to run on a database that
-- already has data: it only adds a table and a function, and gives
-- every EXISTING school the same JSS1-SS3 setup the app used before,
-- so nothing changes for them until they choose to edit it.

create table school_classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  name text not null,
  subjects text[] not null default '{}',   -- the subjects this class takes
  sort_order integer not null default 0,
  created_at timestamptz default now(),
  unique (school_id, name)
);

alter table school_classes enable row level security;

create policy "owners manage their classes" on school_classes for all
  using (school_id in (select id from schools where owner_id = auth.uid()))
  with check (school_id in (select id from schools where owner_id = auth.uid()));

-- Give every existing school its starting classes (same as the old fixed list).
insert into school_classes (school_id, name, subjects, sort_order)
select s.id, c.name, c.subjects, c.ord
from schools s
cross join (values
  ('JSS1', array['Mathematics','English Language','Basic Science','Basic Technology','Social Studies','Civic Education','Agricultural Science','Business Studies']::text[], 1),
  ('JSS2', array['Mathematics','English Language','Basic Science','Basic Technology','Social Studies','Civic Education','Agricultural Science','Business Studies']::text[], 2),
  ('JSS3', array['Mathematics','English Language','Basic Science','Basic Technology','Social Studies','Civic Education','Agricultural Science','Business Studies']::text[], 3),
  ('SS1',  array['Mathematics','English Language','Physics','Chemistry','Biology','Further Mathematics','Literature','Government','History','CRS','Accounting','Commerce','Economics','Business Studies']::text[], 4),
  ('SS2',  array['Mathematics','English Language','Physics','Chemistry','Biology','Further Mathematics','Literature','Government','History','CRS','Accounting','Commerce','Economics','Business Studies']::text[], 5),
  ('SS3',  array['Mathematics','English Language','Physics','Chemistry','Biology','Further Mathematics','Literature','Government','History','CRS','Accounting','Commerce','Economics','Business Studies']::text[], 6)
) as c(name, subjects, ord)
where not exists (select 1 from school_classes sc where sc.school_id = s.id);

-- Renaming a class must also rename it everywhere it is used, otherwise
-- existing students, question sets and results would be left pointing at
-- a class name that no longer exists. This does all of it in one step,
-- and only for the signed-in admin's own school.
create or replace function rename_class(p_class_id uuid, p_new_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school uuid;
  v_old text;
begin
  select c.school_id, c.name into v_school, v_old
  from school_classes c
  join schools s on s.id = c.school_id
  where c.id = p_class_id and s.owner_id = auth.uid();

  if v_school is null then
    raise exception 'Class not found.';
  end if;

  p_new_name := btrim(p_new_name);
  if p_new_name = '' then
    raise exception 'Class name cannot be empty.';
  end if;
  if exists (select 1 from school_classes where school_id = v_school and lower(name) = lower(p_new_name) and id <> p_class_id) then
    raise exception 'You already have a class called %.', p_new_name;
  end if;

  update school_classes set name = p_new_name where id = p_class_id;
  update students  set class = p_new_name where school_id = v_school and class = v_old;
  update questions set class = p_new_name where school_id = v_school and class = v_old;
  update results   set class = p_new_name where school_id = v_school and class = v_old;
end;
$$;

revoke all on function rename_class(uuid, text) from public, anon;
grant execute on function rename_class(uuid, text) to authenticated;
