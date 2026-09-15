// verify-payment — called by the browser right after Checkout succeeds.
// Confirms the signature Razorpay handed the client actually came from
// Razorpay, then settles the order row.
import { corsHeaders, json, preflight } from '../_shared/http.ts';
import { credentials, hmacHex, safeEqual } from '../_shared/razorpay.ts';
import { adminClient } from '../_shared/db.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      await req.json().catch(() => ({}));

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return json({ success: false, error: 'Missing payment fields' }, 400);
    }

    const { keySecret } = credentials();
    const expected = await hmacHex(keySecret, `${razorpay_order_id}|${razorpay_payment_id}`);
    const valid = safeEqual(expected, String(razorpay_signature));

    const db = adminClient();

    // Never downgrade an order the webhook has already marked paid — the two
    // endpoints race by design and 'paid' is the terminal truth.
    const { data: existing } = await db
      .from('orders')
      .select('id, status')
      .eq('razorpay_order_id', razorpay_order_id)
      .maybeSingle();

    if (!existing) return json({ success: false, error: 'Unknown order' }, 404);
    if (existing.status === 'paid') {
      return json({ success: true, order_id: existing.id, already_confirmed: true });
    }

    const { error } = await db
      .from('orders')
      .update({
        status: valid ? 'paid' : 'failed',
        razorpay_payment_id,
      })
      .eq('razorpay_order_id', razorpay_order_id);

    if (error) {
      console.error('orders update failed', error);
      return json({ success: false, error: 'Could not update the order' }, 500);
    }

    if (!valid) {
      console.warn('signature mismatch for order', razorpay_order_id);
      return json({ success: false, error: 'Payment signature verification failed' }, 400);
    }

    return json({ success: true, order_id: existing.id });
  } catch (e) {
    console.error('verify-payment failed', e);
    return json({ success: false, error: e instanceof Error ? e.message : 'Unexpected error' }, 500);
  }
});
