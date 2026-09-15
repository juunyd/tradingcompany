/* ─────────────────────────────────────────────────────────────────────────────
   TRADING COMPANY — CENTRAL SITE CONFIGURATION
   This is the ONLY file you need to edit to change commercial details.

   1. PAYMENT LINKS — paste each Razorpay Payment Link / Checkout URL below.
      Until a real URL is set, the BUY NOW button falls back to "#" and does
      nothing. Replace the empty string, save, done.
   2. PRICES — change `price` (display string, e.g. "₹399").
   3. SUPPORT EMAIL — `supportEmail` below; used in footers and contact copy.
   4. TITLES / SUBTITLES / COVER IMAGES — these live in each publication's own
      page file (Publication-01-*.dc.html …). Cover images are drop-in slots:
      drag an image onto the cover placeholder in the editor.

   NOTE: after a successful Razorpay payment, set the Razorpay "callback / success
   URL" to the Thank You page so the purchase journey closes correctly.
   ───────────────────────────────────────────────────────────────────────────── */

export const supportEmail = 'support@tradingcompany.in';

export const thankYouUrl = 'ThankYou.dc.html';

export const payments = {
  riskFrameworkPaymentUrl: '',
  tradersMindPaymentUrl: '',
  positionSizingPaymentUrl: '',
  tradingSystemPaymentUrl: '',
  reviewPaymentUrl: '',
  // All five publications as one purchase (₹999)
  bundlePaymentUrl: ''
};

export const prices = {
  riskFramework: '₹399',
  tradersMind: '₹399',
  positionSizing: '₹399',
  tradingSystem: '₹399',
  review: '₹399',
  bundle: '₹999'
};
