/* ─────────────────────────────────────────────────────────────────────────────
   TRADING COMPANY — CENTRAL SITE CONFIGURATION
   This is the ONLY file you need to edit to change commercial details.

   Payments run through Razorpay Checkout, driven by three Supabase Edge
   Functions (create-order, verify-payment, razorpay-webhook). Prices are set
   SERVER-SIDE in supabase/functions/_shared/catalog.ts — the browser only ever
   sends a publication id, so a tampered page cannot change what it is charged.
   The `prices` below are display strings only; keep them in step with the
   catalog when you change a price.

   1. SUPABASE — url + anon key of the project holding the Edge Functions.
      The anon key is a public, publishable key; it is safe in this file.
      The Razorpay SECRET key lives only in Supabase Edge Function secrets.
   2. PRICES — display strings (e.g. "₹399"). Also update catalog.ts.
   3. SUPPORT EMAIL — `supportEmail`; used in footers and contact copy.
   4. TITLES / SUBTITLES / COVER IMAGES — these live in each publication's own
      page file (Publication-01-*.dc.html …).
   ───────────────────────────────────────────────────────────────────────────── */

export const supportEmail = 'support@tradingcompany.in';

export const thankYouUrl = 'ThankYou.dc.html';

export const supabase = {
  url: 'https://myjywxzxhccedkzlftbh.supabase.co',
  anonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15anl3eHp4aGNjZWRremxmdGJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0NjQ3OTYsImV4cCI6MjEwNTA0MDc5Nn0.syR90tzKR5mt_0S0hW_D8zoBjT0CISd-zSpmoQm-Tc4'
};

/* Publication ids — these must match the keys in
   supabase/functions/_shared/catalog.ts exactly. */
export const publications = {
  riskFramework:  'risk-framework',
  tradersMind:    'traders-mind',
  positionSizing: 'position-sizing',
  tradingSystem:  'trading-system',
  review:         'review',
  bundle:         'bundle'
};

export const prices = {
  riskFramework: '₹399',
  tradersMind: '₹399',
  positionSizing: '₹399',
  tradingSystem: '₹399',
  review: '₹399',
  bundle: '₹999'
};
