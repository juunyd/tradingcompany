// Meta Conversions API — the server-side Purchase event.
//
// Best-effort, like email.ts: a failure is logged and swallowed, never thrown.
// Ad reporting that misses one sale must not undo a payment that happened.
//
// Secrets:
//   META_PIXEL_ID         — required; the dataset / pixel id.
//   META_ACCESS_TOKEN     — required; a CAPI access token from Events Manager.
//   META_TEST_EVENT_CODE  — optional; when set, events go to the Test Events
//                           tab instead of live reporting. Unset it after testing.
//   META_GRAPH_VERSION    — optional; defaults to GRAPH_VERSION below.
//
// Dedup: event_id is the razorpay_payment_id. ThankYou.dc.html fires the
// browser pixel Purchase with the same value as eventID, so Meta counts one sale.
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { CURRENCY } from './catalog.ts';

const GRAPH_VERSION = 'v23.0';
const SITE_URL = Deno.env.get('SITE_URL')?.replace(/\/+$/, '') || 'https://tradingcompany.in';
const TIMEOUT_MS = 8000;

// ── browser context, captured at create-order ────────────────────────────────

// Cookie and URL values come from the browser, so they are length-capped and
// dropped if they are not plain strings.
function clean(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return v && v.length <= max ? v : null;
}

function cleanUrl(value: unknown): string | null {
  const v = clean(value, 2048);
  if (!v) return null;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export function clientContext(req: Request, body: { fbp?: unknown; fbc?: unknown; event_source_url?: unknown }) {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0];
  return {
    client_ip_address: clean(forwarded ?? req.headers.get('cf-connecting-ip'), 64),
    client_user_agent: clean(req.headers.get('user-agent'), 512),
    fbp: clean(body.fbp, 256),
    fbc: clean(body.fbc, 512),
    event_source_url: cleanUrl(body.event_source_url),
  };
}

// ── the event ────────────────────────────────────────────────────────────────

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface PaidOrder {
  id: string;
  publication_id: string;
  customer_email: string;
  amount: number;                 // paise
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  client_ip_address: string | null;
  client_user_agent: string | null;
  fbp: string | null;
  fbc: string | null;
  event_source_url: string | null;
}

// Returns null — after logging why — rather than build an event Meta would flag.
export async function buildPurchaseEvent(order: PaidOrder) {
  // orders.amount is the amount the Razorpay order was created with, and
  // Razorpay only captures a payment for the full order amount.
  const value = Number(order.amount) / 100;
  if (!Number.isFinite(value) || value <= 0) {
    console.error('meta purchase not sent: invalid value', { order_ref: order.id, amount: order.amount });
    return null;
  }
  if (!order.razorpay_payment_id) {
    console.error('meta purchase not sent: no payment id to dedupe on', { order_ref: order.id });
    return null;
  }

  const user_data: Record<string, unknown> = {
    em: [await sha256Hex(order.customer_email.trim().toLowerCase())],
  };
  if (order.client_ip_address) user_data.client_ip_address = order.client_ip_address;
  if (order.client_user_agent) user_data.client_user_agent = order.client_user_agent;
  if (order.fbp) user_data.fbp = order.fbp;
  if (order.fbc) user_data.fbc = order.fbc;

  return {
    event_name: 'Purchase',
    event_time: Math.floor(Date.now() / 1000),
    event_id: order.razorpay_payment_id,
    action_source: 'website',
    event_source_url: order.event_source_url ?? SITE_URL + '/',
    user_data,
    custom_data: {
      value,
      currency: CURRENCY,
      content_ids: [order.publication_id],
      content_type: 'product',
      order_id: order.razorpay_order_id ?? order.id,
    },
  };
}

async function postToMeta(event: Record<string, unknown>, orderId: string): Promise<boolean> {
  const pixelId = Deno.env.get('META_PIXEL_ID');
  const accessToken = Deno.env.get('META_ACCESS_TOKEN');
  const testEventCode = Deno.env.get('META_TEST_EVENT_CODE');
  const version = Deno.env.get('META_GRAPH_VERSION') || GRAPH_VERSION;

  const payload: Record<string, unknown> = { data: [event], access_token: accessToken };
  if (testEventCode) payload.test_event_code = testEventCode;

  try {
    const res = await fetch(`https://graph.facebook.com/${version}/${pixelId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('meta capi rejected purchase', { order_ref: orderId, status: res.status, error: body?.error });
      return false;
    }
    console.log('meta capi purchase sent', {
      order_ref: orderId,
      events_received: body?.events_received,
      fbtrace_id: body?.fbtrace_id,
      test: Boolean(testEventCode),
    });
    return true;
  } catch (e) {
    console.error('meta capi request failed', { order_ref: orderId, error: e instanceof Error ? e.message : e });
    return false;
  }
}

// ── exactly once across verify-payment and razorpay-webhook ──────────────────
// Same claim as sendOrderConfirmationOnce in email.ts: a conditional UPDATE on
// a paid row with meta_purchase_sent_at still null, so only one caller wins.

export async function sendMetaPurchaseOnce(
  db: SupabaseClient,
  orderId: string,
): Promise<'sent' | 'already-sent' | 'skipped' | 'failed'> {
  if (!Deno.env.get('META_PIXEL_ID') || !Deno.env.get('META_ACCESS_TOKEN')) {
    console.warn('meta capi not configured: META_PIXEL_ID / META_ACCESS_TOKEN unset');
    return 'skipped';
  }

  const { data: claimed, error: claimError } = await db
    .from('orders')
    .update({ meta_purchase_sent_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('status', 'paid')
    .is('meta_purchase_sent_at', null)
    .select(
      'id, publication_id, customer_email, amount, razorpay_order_id, razorpay_payment_id, ' +
        'client_ip_address, client_user_agent, fbp, fbc, event_source_url',
    )
    .maybeSingle();

  if (claimError) {
    console.error('could not claim meta purchase', { order_ref: orderId, error: claimError.message });
    return 'failed';
  }
  if (!claimed) return 'already-sent';

  const event = await buildPurchaseEvent(claimed as unknown as PaidOrder);
  if (event && (await postToMeta(event, orderId))) return 'sent';

  // Release the claim so a webhook retry can try again. If this fails the order
  // stays claimed: one missed conversion, never a double count.
  const { error: resetError } = await db
    .from('orders')
    .update({ meta_purchase_sent_at: null })
    .eq('id', orderId);
  if (resetError) {
    console.error('could not release meta purchase claim', { order_ref: orderId, error: resetError.message });
  }
  return event ? 'failed' : 'skipped';
}
