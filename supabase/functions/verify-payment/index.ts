// Supabase Edge Function: verify-payment
//
// Why this exists: Paystack's checkout popup runs in the browser, but the
// browser can never be trusted to say "the payment succeeded". This function
// does the real check server-side with Paystack's SECRET key, then credits
// the school's balance.
//
// Checks it makes, in order:
//   1. The caller is a signed-in admin AND owns the school being credited.
//   2. Paystack confirms the payment really succeeded.
//   3. The payment was made for THIS school and THIS many credits.
//   4. The amount paid matches the real price.
//   5. The credits are added once only (the paystack-webhook may have
//      already added them, which is fine: we just report the current state).
//
// Needs migration 006 (the credit_purchase database function).
// Required secret: PAYSTACK_SECRET_KEY.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const { reference, schoolId, examCount } = await req.json();

    if (typeof reference !== 'string' || !reference || typeof schoolId !== 'string' ||
        !Number.isInteger(examCount) || examCount <= 0) {
      return jsonResponse({ error: 'Missing or invalid payment details.' }, 400);
    }

    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecretKey) {
      return jsonResponse({ error: 'Server is not configured for payments yet (missing PAYSTACK_SECRET_KEY).' }, 500);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // Step 1 — who is calling, and do they own this school?
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: userData } = await supabase.auth.getUser(jwt);
    const user = userData?.user;
    if (!user) return jsonResponse({ error: 'Please sign in again.' }, 401);

    const { data: school } = await supabase
      .from('schools').select('id, owner_id').eq('id', schoolId).maybeSingle();
    if (!school || school.owner_id !== user.id) {
      return jsonResponse({ error: 'You can only buy credits for your own school.' }, 403);
    }

    // Step 2 — ask Paystack directly whether this payment really succeeded.
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${paystackSecretKey}` },
    });
    const verifyData = await verifyRes.json();
    if (!verifyRes.ok || !verifyData.status || verifyData.data?.status !== 'success') {
      return jsonResponse({ error: 'Payment was not successful according to Paystack.' }, 400);
    }

    // Step 3 — the payment must have been made for this school and this
    // number of credits (stops someone re-using another school's payment).
    const meta = verifyData.data.metadata ?? {};
    if (meta.schoolId !== schoolId || Number(meta.examCount) !== examCount) {
      return jsonResponse({ error: 'This payment does not match this purchase.' }, 400);
    }

    // Step 4 — the amount must match the real price, from the database.
    const { data: licenseRow } = await supabase
      .from('license').select('price_per_exam').eq('school_id', schoolId).maybeSingle();
    const price = licenseRow?.price_per_exam ?? 200;
    if (verifyData.data.amount !== examCount * price * 100) {
      return jsonResponse({ error: 'Amount paid does not match the expected price — payment not credited.' }, 400);
    }

    // Step 5 — credit it exactly once (or report that it was already done).
    const { data: result, error } = await supabase.rpc('credit_purchase', {
      p_school_id: schoolId,
      p_exams: examCount,
      p_amount: examCount * price,
      p_reference: reference,
    });
    if (error) throw error;
    const row = Array.isArray(result) ? result[0] : result;

    return jsonResponse({ balance: row.new_balance, alreadyProcessed: !row.was_new });
  } catch (err) {
    console.error('verify-payment error:', err);
    return jsonResponse({ error: 'Unexpected error verifying payment. If you were charged, your credits will still be added automatically within a few minutes.' }, 500);
  }
});
