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
    .maybeSingle();
  if (licError) throw licError;

  const { data: historyRows, error: histError } = await supabase
    .from('license_history')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });
  if (histError) throw histError;

  // A school with no license row yet is treated as 0 credits instead of
  // crashing the whole dashboard load.
  return {
    balance: licenseRow?.balance ?? 0,
    pricePerExam: licenseRow?.price_per_exam ?? 50,
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
  if (error) {
    // For non-2xx replies, supabase-js hides the server's message inside
    // error.context, so dig it out to show a useful message.
    let message = 'Payment could not be verified.';
    try {
      const body = await error.context.json();
      if (body?.error) message = body.error;
    } catch { /* keep generic message */ }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data; // { balance, alreadyProcessed }
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
