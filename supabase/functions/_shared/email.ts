// Transactional email via Resend.
//
// Every function here is best-effort: a failure is logged and swallowed, never
// thrown. An email that does not arrive must not undo a payment that did.
//
// Secrets:
//   RESEND_API_KEY — required; without it nothing is sent (just logged).
//   RESEND_FROM    — optional override of the From header. Set this to
//                    Resend's shared sender (onboarding@resend.dev) if
//                    tradingcompany.in is ever un-verified in Resend.
const DEFAULT_FROM = 'Trading Company <noreply@tradingcompany.in>';
const SUPPORT_EMAIL = 'support@tradingcompany.in';

// Where the buyer picks the download up. No trailing slash.
const SITE_URL = Deno.env.get('SITE_URL')?.replace(/\/+$/, '') || 'https://tradingcompany.in';

// Resend is not in the payment path, so it gets a short leash: the buyer is
// waiting on this response with Checkout still open.
const TIMEOUT_MS = 8000;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface OrderConfirmation {
  to: string;
  publicationTitle: string;
  orderRef: string;
}

function body({ publicationTitle, orderRef }: OrderConfirmation) {
  const title = escapeHtml(publicationTitle);
  const ref = escapeHtml(orderRef);
  const url = `${SITE_URL}/ThankYou.dc.html?order_id=${encodeURIComponent(orderRef)}`;
  const urlHtml = escapeHtml(url);

  const text = [
    'Your payment has been received and your order is confirmed.',
    '',
    `Publication: ${publicationTitle}`,
    `Order reference: ${orderRef}`,
    '',
    'Your download is available on your order page:',
    url,
    '',
    'Keep this email for your records — the link above remains available.',
    '',
    `For any question about this order, reply to this message or write to ${SUPPORT_EMAIL}, quoting the order reference.`,
    '',
    'Trading Company',
  ].join('\n');

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f6f6f6;font-family:Georgia,'Times New Roman',serif;color:#111">
  <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e0e0e0">
    <tr><td style="padding:32px">
      <p style="margin:0 0 4px;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#666">Trading Company</p>
      <h1 style="margin:0 0 20px;font-size:22px;font-weight:normal">Your order is confirmed</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6">Your payment has been received and your order is confirmed.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px;border-top:1px solid #e0e0e0">
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e0e0e0;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#666">Publication</td>
          <td style="padding:12px 0;border-bottom:1px solid #e0e0e0;font-size:15px;text-align:right">${title}</td>
        </tr>
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e0e0e0;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#666">Order reference</td>
          <td style="padding:12px 0;border-bottom:1px solid #e0e0e0;font-family:monospace;font-size:13px;text-align:right">${ref}</td>
        </tr>
      </table>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6">Your download is available on your order page.</p>
      <p style="margin:0 0 24px">
        <a href="${urlHtml}" style="display:inline-block;padding:12px 22px;background:#111;color:#ffffff;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.16em;text-transform:uppercase">Access your download</a>
      </p>
      <p style="margin:0 0 20px;font-size:13px;line-height:1.6;color:#555">If the button does not open, use this address:<br><a href="${urlHtml}" style="color:#111;word-break:break-all">${urlHtml}</a></p>
      <p style="margin:0 0 20px;font-size:13px;line-height:1.6;color:#555">Keep this email for your records — the link above remains available.</p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#555">For any question about this order, reply to this message or write to <a href="mailto:${SUPPORT_EMAIL}" style="color:#111">${SUPPORT_EMAIL}</a>, quoting the order reference.</p>
    </td></tr>
  </table>
</body></html>`;

  return { text, html };
}


// Returns true only when Resend accepted the message. Never throws.
export async function sendOrderConfirmation(order: OrderConfirmation): Promise<boolean> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    console.error('confirmation email skipped: RESEND_API_KEY is not set', { order_ref: order.orderRef });
    return false;
  }

  const { text, html } = body(order);

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: Deno.env.get('RESEND_FROM') || DEFAULT_FROM,
        to: [order.to],
        reply_to: SUPPORT_EMAIL,
        subject: 'Your Trading Company order',
        text,
        html,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('confirmation email rejected by Resend', {
        order_ref: order.orderRef,
        status: res.status,
        detail: detail.slice(0, 500),
      });
      return false;
    }

    const sent = await res.json().catch(() => ({}));
    console.log('confirmation email sent', { order_ref: order.orderRef, resend_id: sent?.id ?? null });
    return true;
  } catch (e) {
    // Network error, timeout, anything else — the order still stands.
    console.error('confirmation email failed', {
      order_ref: order.orderRef,
      error: e instanceof Error ? e.message : String(e),
    });
    return false;
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// Exactly-once delivery across the two settlement paths.
//
// verify-payment (browser) and razorpay-webhook (server-to-server) both mark
// an order paid and both want to send the receipt. Rather than pick one and
// lose the email whenever the other wins the race, both call this: it claims
// the order with a conditional UPDATE and only sends if the claim landed.
//
// The claim is atomic. Under READ COMMITTED, a second concurrent UPDATE with
// the same `is null` predicate blocks on the row lock, then re-evaluates the
// predicate against the committed row — which now has a timestamp — and
// matches nothing. No advisory lock needed.
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { CATALOG } from './catalog.ts';

export async function sendOrderConfirmationOnce(
  db: SupabaseClient,
  orderId: string,
): Promise<'sent' | 'already-sent' | 'failed'> {
  const { data: claimed, error: claimError } = await db
    .from('orders')
    .update({ confirmation_email_sent_at: new Date().toISOString() })
    .eq('id', orderId)
    .is('confirmation_email_sent_at', null)
    .select('id, publication_id, customer_email')
    .maybeSingle();

  if (claimError) {
    console.error('could not claim confirmation email', { order_ref: orderId, error: claimError.message });
    return 'failed';
  }

  // Someone else got there first. Nothing to do, and nothing wrong.
  if (!claimed) return 'already-sent';

  const ok = await sendOrderConfirmation({
    to: claimed.customer_email,
    publicationTitle: CATALOG[claimed.publication_id]?.title ?? claimed.publication_id,
    orderRef: claimed.id,
  });

  if (ok) return 'sent';

  // Release the claim so a webhook retry — or a manual resend — can try again.
  // If this reset itself fails the order is simply left claimed: an email that
  // never arrives, which support can fix, and never a duplicate.
  const { error: resetError } = await db
    .from('orders')
    .update({ confirmation_email_sent_at: null })
    .eq('id', orderId);

  if (resetError) {
    console.error('could not release confirmation-email claim', {
      order_ref: orderId,
      error: resetError.message,
    });
  }

  return 'failed';
}
