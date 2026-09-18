// create-order — called by the Buy button before Razorpay Checkout opens.
// In:  { publication_id, customer_email, fbp?, fbc?, event_source_url? }
// Out: { order_id, amount, currency, key_id, publication_title, db_order_id }
import { isEmail, lookup, CURRENCY } from '../_shared/catalog.ts';
import { corsHeaders, json, preflight } from '../_shared/http.ts';
import { createRazorpayOrder, credentials } from '../_shared/razorpay.ts';
import { adminClient } from '../_shared/db.ts';
import { clientContext } from '../_shared/meta.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const { publication_id, customer_email } = body;

    const item = lookup(publication_id);
    if (!item) return json({ error: 'Unknown publication' }, 400);
    if (!isEmail(customer_email)) return json({ error: 'A valid email address is required' }, 400);

    const email = (customer_email as string).trim().toLowerCase();
    const { keyId } = credentials();

    // Price comes from the server catalog, never from the request body.
    const rzpOrder = await createRazorpayOrder({
      amount: item.amount,
      currency: CURRENCY,
      receipt: `tc_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
      notes: { publication_id: publication_id as string, customer_email: email },
    });

    const db = adminClient();
    const { data, error } = await db
      .from('orders')
      .insert({
        publication_id,
        customer_email: email,
        razorpay_order_id: rzpOrder.id,
        status: 'created',
        // What Razorpay will actually charge; the Meta Purchase value comes from here.
        amount: rzpOrder.amount,
        // Kept for the Meta Purchase, which the webhook may send with no browser present.
        ...clientContext(req, body),
      })
      .select('id')
      .single();

    if (error) {
      console.error('orders insert failed', error);
      return json({ error: 'Could not record the order' }, 500);
    }

    return new Response(
      JSON.stringify({
        order_id: rzpOrder.id,
        db_order_id: data.id,
        amount: rzpOrder.amount,
        currency: CURRENCY,
        key_id: keyId,
        publication_title: item.title,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('create-order failed', e);
    return json({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500);
  }
});
