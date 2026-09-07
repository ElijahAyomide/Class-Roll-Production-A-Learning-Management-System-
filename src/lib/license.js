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

// Records a purchase (new history row) and increases the balance. Two
// separate calls rather than one atomic transaction — fine at this app's
// scale, but worth knowing: a Postgres function (RPC) would be the more
// bulletproof version if purchase volume ever gets high enough for two
// admins to purchase at the exact same moment.
export async function purchaseLicense(schoolId, examCount, pricePerExam) {
  const amount = examCount * pricePerExam;
  const reference = `GVC-PSK-${Math.floor(10000 + Math.random() * 89999)}`;

  const { data: historyRow, error: histError } = await supabase
    .from('license_history')
    .insert({ school_id: schoolId, exams: examCount, amount, reference, status: 'successful' })
    .select()
    .single();
  if (histError) throw histError;

  const { data: current, error: fetchErr } = await supabase
    .from('license')
    .select('balance')
    .eq('school_id', schoolId)
    .single();
  if (fetchErr) throw fetchErr;

  const { data: updated, error: updateErr } = await supabase
    .from('license')
    .update({ balance: current.balance + examCount })
    .eq('school_id', schoolId)
    .select()
    .single();
  if (updateErr) throw updateErr;

  return { balance: updated.balance, historyEntry: mapHistoryRow(historyRow) };
}

// Deducts credits when an admin assigns tests/exams. Same not-fully-atomic
// caveat as purchaseLicense above.
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
