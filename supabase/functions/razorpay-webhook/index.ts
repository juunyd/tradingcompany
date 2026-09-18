// razorpay-webhook — Razorpay calls this server-to-server. It is the backup
// path: if the buyer closes the tab before verify-payment runs, this still
// settles the order.
//
// Signed with RAZORPAY_WEBHOOK_SECRET (the value you type into the Razorpay
// dashboard when creating the webhook), NOT the API key secret.
import { hmacHex, safeEqual } from '../_shared/razorpay.ts';
import { adminClient } from '../_shared/db.ts';
import { sendOrderConfirmationOnce } from '../_shared/email.ts';
import { sendMetaPurchaseOnce } from '../_shared/meta.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');
  if (!secret) {
    console.error('RAZORPAY_WEBHOOK_SECRET is not set');
    return new Response(JSON.stringify({ error: 'Webhook not configured' }), { status: 500 });
  }

  // The signature covers the exact bytes Razorpay sent, so read the raw text
  // and only parse it after the signature checks out.
  const raw = await req.text();
  const received = req.headers.get('x-razorpay-signature') ?? '';
  const expected = await hmacHex(secret, raw);

  if (!safeEqual(expected, received)) {
    console.warn('webhook signature mismatch');
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const payment = event?.payload?.payment?.entity;
  const orderEntity = event?.payload?.order?.entity;
  const razorpayOrderId = payment?.order_id ?? orderEntity?.id;

  if (!razorpayOrderId) {
    // Nothing for us to act on, but acknowledge so Razorpay stops retrying.
    return new Response(JSON.stringify({ received: true, ignored: event?.event }), { status: 200 });
  }

  const db = adminClient();
  const { data: existing } = await db
    .from('orders')
    .select('id, status')
    .eq('razorpay_order_id', razorpayOrderId)
    .maybeSingle();

  if (!existing) {
    console.warn('webhook for unknown order', razorpayOrderId);
    return new Response(JSON.stringify({ received: true, unknown_order: true }), { status: 200 });
  }

  let status: 'paid' | 'failed' | null = null;
  if (event.event === 'payment.captured' || event.event === 'order.paid') status = 'paid';
  else if (event.event === 'payment.failed') status = 'failed';

  // 'paid' is terminal: a later payment.failed for a retried attempt must not
  // un-sell a publication that was actually bought.
  if (status && existing.status !== 'paid') {
    const { error } = await db
      .from('orders')
      .update({ status, razorpay_payment_id: payment?.id ?? null })
      .eq('razorpay_order_id', razorpayOrderId);
    if (error) {
      // 500 makes Razorpay retry, which is what we want on a transient failure.
      console.error('webhook order update failed', error);
      return new Response(JSON.stringify({ error: 'Update failed' }), { status: 500 });
    }
  }

  // This is the path that catches the buyer who closed the tab before
  // verify-payment could run — for the receipt and for the Meta Purchase.
  // Both are claimed, so whichever endpoint arrives first
  // sends and the other is a no-op. A failure here must NOT 500: Razorpay
  // would retry the whole event and re-settle an order that is already fine.
  if (status === 'paid' || existing.status === 'paid') {
    await Promise.all([
      sendOrderConfirmationOnce(db, existing.id),
      sendMetaPurchaseOnce(db, existing.id),
    ]);
  }

  return new Response(
    JSON.stringify({ received: true, event: event.event, order_id: existing.id }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});
