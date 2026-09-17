// get-download-link — called by ThankYou.dc.html on page load.
// In:  { order_id }            the orders.id uuid checkout.js put in the URL
// Out: { verified: true, publication_id, publication_title, customer_email, amount,
//        download_url, download_expires_at }
//
// The uuid is the only credential a buyer has, so this endpoint is deliberately
// tight-lipped: an unpaid order, an unknown order and a malformed id all come
// back as the same refusal, so nobody can probe the table for valid ids.
//
// Delivery: each book lives in the private `publications` bucket at
// `<publication_id>.pdf`. Every call signs a fresh url, so the order page (the
// link in the confirmation email) never hands out a dead one — reloading it is
// how a buyer gets a new link after the old one expires.
import { CATALOG } from '../_shared/catalog.ts';
import { json, preflight } from '../_shared/http.ts';
import { adminClient } from '../_shared/db.ts';

// One hour: long enough to download on a slow connection, short enough that a
// forwarded link stops working soon after.
const LINK_TTL_SECONDS = 60 * 60;

// Windows refuses these in file names; "Should I Quit Trading?" has one.
function downloadName(title: string) {
  // …and a trailing full stop ("Now What.") would give "Now What..pdf".
  return title.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim().replace(/\.+$/, '') + '.pdf';
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// One wording for every failure. Never say which of the three it was.
const REFUSED = { verified: false, error: 'We could not verify this order.' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { order_id } = await req.json().catch(() => ({}));

    if (typeof order_id !== 'string' || !UUID.test(order_id.trim())) {
      return json(REFUSED, 404);
    }

    const db = adminClient();
    const { data: order, error } = await db
      .from('orders')
      .select('id, status, publication_id, customer_email, amount')
      .eq('id', order_id.trim())
      .maybeSingle();

    if (error) {
      // A database fault is ours, not the buyer's — say so, and say it loudly
      // in the logs. This is the one case that is not a 404.
      console.error('orders lookup failed', error);
      return json({ verified: false, error: 'Could not check that order right now.' }, 500);
    }

    if (!order || order.status !== 'paid') return json(REFUSED, 404);

    const title = CATALOG[order.publication_id]?.title ?? null;

    // A signing failure (say, a missing file) must not hide a paid order: the
    // page still confirms the purchase and tells the buyer to retry or write in.
    const { data: signed, error: signError } = await db.storage
      .from('publications')
      .createSignedUrl(`${order.publication_id}.pdf`, LINK_TTL_SECONDS, {
        download: downloadName(title ?? order.publication_id),
      });
    if (signError || !signed?.signedUrl) {
      console.error('signing download failed', order.publication_id, signError);
    }

    return json({
      verified: true,
      order_id: order.id,
      publication_id: order.publication_id,
      publication_title: title,
      customer_email: order.customer_email,
      // Paise, straight from the row Razorpay was charged against. The Thank You
      // page turns this into the Meta Purchase value, so it must come from the
      // server — a client-side price could be edited to inflate ad reporting.
      amount: order.amount,
      download_url: signed?.signedUrl ?? null,
      download_expires_at: signed?.signedUrl
        ? new Date(Date.now() + LINK_TTL_SECONDS * 1000).toISOString()
        : null,
    });
  } catch (e) {
    console.error('get-download-link failed', e);
    return json({ verified: false, error: 'Unexpected error' }, 500);
  }
});
