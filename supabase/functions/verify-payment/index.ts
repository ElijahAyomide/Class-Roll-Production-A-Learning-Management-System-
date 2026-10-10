// Supabase Edge Function: verify-payment
//
// Why this exists: Paystack's checkout popup runs in the browser, but the
// browser can never be trusted to say "the payment succeeded" — anyone
// could fake that message in dev tools and get free credits. This
// function does the real check server-side, using Paystack's SECRET key
// (which must never be sent to the browser), then credits the license
// balance itself. The frontend only ever sees the result, never the
// secret key.
//
// Deploy this via Supabase Dashboard → Edge Functions → Deploy a new
// function → Via Editor. Paste this file's contents in as index.ts.
//
// Required secret (set via Edge Functions → Secrets in the dashboard):
//   PAYSTACK_SECRET_KEY — your Paystack test (or live) secret key
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically
// by Supabase to every Edge Function — no need to set those yourself.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { reference, schoolId, examCount } = await req.json();

    if (!reference || !schoolId || !examCount || examCount <= 0) {
      return jsonResponse({ error: 'Missing or invalid payment details.' }, 400);
    }

    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecretKey) {
      return jsonResponse({ error: 'Server is not configured for payments yet (missing PAYSTACK_SECRET_KEY).' }, 500);
    }

    // Step 1 — ask Paystack directly whether this payment really succeeded.
    // This is the one request in this whole flow that the secret key is
    // used for, and it never leaves this server-side function.
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${paystackSecretKey}` },
    });
    const verifyData = await verifyRes.json();

    if (!verifyRes.ok || !verifyData.status || verifyData.data?.status !== 'success') {
      return jsonResponse({ error: 'Payment was not successful according to Paystack.' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Step 2 — guard against double-crediting: if this exact reference was
    // already processed (e.g. the frontend retried a request), stop here.
    const { data: existing } = await supabase
      .from('license_history')
      .select('id')
      .eq('reference', reference)
      .maybeSingle();
    if (existing) {
      return jsonResponse({ error: 'This payment has already been processed.' }, 400);
    }

    // Step 3 — figure out what SHOULD have been paid, using the school's
    // real price-per-exam from the database (never trusting a price the
    // client claims), and confirm it matches what Paystack actually
    // received. This stops someone from paying for 1 credit while
    // claiming 1000.
    const { data: licenseRow, error: licenseErr } = await supabase
      .from('license')
      .select('balance, price_per_exam')
      .eq('school_id', schoolId)
      .single();
    if (licenseErr) throw licenseErr;

    const expectedAmountKobo = examCount * licenseRow.price_per_exam * 100;
    if (verifyData.data.amount !== expectedAmountKobo) {
      return jsonResponse({ error: 'Amount paid does not match the expected price — payment not credited.' }, 400);
    }

    // Step 4 — everything checks out. Credit the balance and record the
    // purchase, using the service role key (safe here, since we've done
    // all the verification above ourselves).
    const { data: updatedLicense, error: updateErr } = await supabase
      .from('license')
      .update({ balance: licenseRow.balance + examCount })
      .eq('school_id', schoolId)
      .select()
      .single();
    if (updateErr) throw updateErr;

    const { data: historyRow, error: histErr } = await supabase
      .from('license_history')
      .insert({
        school_id: schoolId,
        exams: examCount,
        amount: examCount * licenseRow.price_per_exam,
        reference,
        status: 'successful',
      })
      .select()
      .single();
    if (histErr) throw histErr;

    return jsonResponse({
      balance: updatedLicense.balance,
      historyEntry: {
        id: historyRow.id,
        date: historyRow.date,
        exams: historyRow.exams,
        amount: historyRow.amount,
        reference: historyRow.reference,
        status: historyRow.status,
      },
    });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Unexpected error verifying payment.' }, 500);
  }
});
