// Supabase Edge Function: paystack-webhook
//
// Why this exists: when a school pays, Paystack tells the BROWSER the payment
// worked, and the browser then asks verify-payment to add the credits. If the
// school closes the tab, loses signal, or the browser crashes in between,
// they've paid but got nothing. A webhook fixes that: Paystack calls THIS
// function directly, server to server, every time a payment succeeds,
// whether or not the browser is still open.
//
// Safety:
//   - Every request is checked against Paystack's signature (made with your
//     secret key). Anything not signed by Paystack is rejected.
//   - The amount paid must equal exactly what the credits cost.
//   - Credits are added by the credit_purchase database function, which
//     refuses to credit the same payment reference twice, so it's safe when
//     both the browser and the webhook arrive for the same payment.
//
// Deploy: Edge Functions → Deploy a new function → Via Editor → name it
// exactly "paystack-webhook". Then in its Settings turn OFF "Verify JWT"
// (Paystack is not a Supabase user, so it has no JWT).
//
// Needs the secret PAYSTACK_SECRET_KEY (already set for verify-payment)
// and migration 006.

import { createClient } from 'npm:@supabase/supabase-js@2';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function hexToBytes(hex: string): Uint8Array | null {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

// Paystack signs the raw request body with HMAC-SHA512 using your secret key.
async function signatureIsValid(rawBody: string, signatureHex: string | null, secret: string) {
  if (!signatureHex) return false;
  const sig = hexToBytes(signatureHex.trim());
  if (!sig) return false;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['verify'],
  );
  return await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(rawBody));
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405);

  const secret = Deno.env.get('PAYSTACK_SECRET_KEY');
  if (!secret) return reply({ error: 'Server is not configured (missing PAYSTACK_SECRET_KEY).' }, 500);

  const rawBody = await req.text();
  if (!(await signatureIsValid(rawBody, req.headers.get('x-paystack-signature'), secret))) {
    return reply({ error: 'Invalid signature.' }, 401);
  }

  try {
    const event = JSON.parse(rawBody);

    // We only care about successful charges. Acknowledge everything else
    // with 200 so Paystack doesn't keep retrying it.
    if (event.event !== 'charge.success') return reply({ ok: true, ignored: event.event });

    const data = event.data ?? {};
    const reference: string = data.reference;
    const meta = data.metadata ?? {};
    const schoolId: string = meta.schoolId;
    const examCount = Number(meta.examCount);

    if (data.status !== 'success' || data.currency !== 'NGN' || typeof reference !== 'string' || !reference) {
      console.error('Ignoring charge: not a successful NGN payment', reference);
      return reply({ ok: true, ignored: 'not-successful' });
    }
    // A payment without our details (e.g. made some other way) can't be credited.
    if (typeof schoolId !== 'string' || !UUID_RE.test(schoolId) ||
        !Number.isInteger(examCount) || examCount < 1 || examCount > 100000) {
      console.error('Ignoring charge: missing or invalid school details', reference);
      return reply({ ok: true, ignored: 'no-school-details' });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: school } = await supabase.from('schools').select('id').eq('id', schoolId).maybeSingle();
    if (!school) {
      console.error('Ignoring charge: unknown school', schoolId, reference);
      return reply({ ok: true, ignored: 'unknown-school' });
    }

    const { data: licenseRow } = await supabase
      .from('license').select('price_per_exam').eq('school_id', schoolId).maybeSingle();
    const price = licenseRow?.price_per_exam ?? 200;

    // The amount actually paid must match what these credits cost.
    if (data.amount !== examCount * price * 100) {
      console.error('Amount mismatch, NOT crediting', reference, data.amount, examCount * price * 100);
      return reply({ ok: true, ignored: 'amount-mismatch' });
    }

    const { data: result, error } = await supabase.rpc('credit_purchase', {
      p_school_id: schoolId,
      p_exams: examCount,
      p_amount: examCount * price,
      p_reference: reference,
    });
    if (error) throw error; // a real failure: reply 500 so Paystack retries later

    const row = Array.isArray(result) ? result[0] : result;
    return reply({ ok: true, credited: !!row?.was_new });
  } catch (err) {
    console.error('paystack-webhook error:', err);
    return reply({ error: 'Webhook failed.' }, 500);
  }
});
