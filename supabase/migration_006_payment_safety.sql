-- ============================================================
-- Migration 006: safe, one-time crediting of payments
-- ============================================================
-- Two things can now credit a payment: the browser (verify-payment)
-- and Paystack's webhook (paystack-webhook). Both may arrive for the
-- SAME payment, so crediting must happen exactly once. This migration
-- makes that impossible to get wrong.

-- 1) A payment reference can only ever be recorded once.
create unique index if not exists license_history_reference_unique
  on license_history(reference);

-- 2) One function does everything in a single step: record the payment
--    AND add the credits. If the reference was already recorded, it does
--    nothing and says so. Only the server functions can run it.
create or replace function credit_purchase(
  p_school_id uuid, p_exams integer, p_amount integer, p_reference text
)
returns table (new_balance integer, history_id uuid, was_new boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_history_id uuid;
  v_balance integer;
begin
  insert into license_history (school_id, exams, amount, reference, status)
  values (p_school_id, p_exams, p_amount, p_reference, 'successful')
  on conflict (reference) do nothing
  returning id into v_history_id;

  if v_history_id is null then
    -- Already credited earlier: change nothing, report the current state.
    select id into v_history_id from license_history where reference = p_reference;
    select balance into v_balance from license where school_id = p_school_id;
    return query select coalesce(v_balance, 0), v_history_id, false;
    return;
  end if;

  insert into license (school_id, balance)
  values (p_school_id, p_exams)
  on conflict (school_id) do update set balance = license.balance + p_exams
  returning balance into v_balance;

  return query select v_balance, v_history_id, true;
end;
$$;

revoke all on function credit_purchase(uuid, integer, integer, text) from public, anon, authenticated;
grant execute on function credit_purchase(uuid, integer, integer, text) to service_role;
