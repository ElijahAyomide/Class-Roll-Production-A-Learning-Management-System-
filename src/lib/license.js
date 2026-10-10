import { supabase } from './supabaseClient';

function mapHistoryRow(row) {
  return {
    id: row.id,
    date: row.date,
    exams: row.exams,
    amount: row.amount,
    reference: row.reference,
    status: row.status,
  };
}

export async function fetchLicense(schoolId) {
  const { data: licenseRow, error: licError } = await supabase
    .from('license')
    .select('*')
    .eq('school_id', schoolId)
    .single();
  if (licError) throw licError;

  const { data: historyRows, error: histError } = await supabase
    .from('license_history')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });
  if (histError) throw histError;

  return {
    balance: licenseRow.balance,
    pricePerExam: licenseRow.price_per_exam,
    history: historyRows.map(mapHistoryRow),
  };
}

// Calls the verify-payment Edge Function, which checks the payment with
// Paystack directly (server-side, using the secret key) before crediting
// anything. The client never decides on its own whether a payment
// succeeded — see supabase/functions/verify-payment/index.ts for why
// that matters.
export async function verifyAndCreditPurchase(reference, schoolId, examCount) {
  const { data, error } = await supabase.functions.invoke('verify-payment', {
    body: { reference, schoolId, examCount },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data; // { balance, historyEntry }
}

// Deducts credits when an admin assigns tests/exams. Not a fully atomic
// operation (a fetch-then-update, not a single transaction) — fine at
// this app's scale, but worth knowing if purchase/assignment volume ever
// gets high enough for two admins to act on the same school at once.
export async function deductLicense(schoolId, count) {
  const { data: current, error: fetchErr } = await supabase
    .from('license')
    .select('balance')
    .eq('school_id', schoolId)
    .single();
  if (fetchErr) throw fetchErr;

  const { data: updated, error: updateErr } = await supabase
    .from('license')
    .update({ balance: current.balance - count })
    .eq('school_id', schoolId)
    .select()
    .single();
  if (updateErr) throw updateErr;
  return updated.balance;
}
