# Trading Company — site guide

All 11 pages are self-contained files in this folder. No build step, no WordPress.

## Pages

| Page | File |
| --- | --- |
| Homepage | `index.html` |
| The Library | `Library.dc.html` |
| Publication 01 — The Risk Framework | `Publication-01-The-Risk-Framework.dc.html` |
| Publication 02 — The Trader's Mind | `Publication-02-The-Traders-Mind.dc.html` |
| Publication 03 — Position Sizing | `Publication-03-Position-Sizing.dc.html` |
| Publication 04 — The Trading System | `Publication-04-The-Trading-System.dc.html` |
| Publication 05 — The Review | `Publication-05-The-Review.dc.html` |
| About | `About.dc.html` |
| Contact | `Contact.dc.html` |
| Privacy Policy | `Privacy.dc.html` |
| Terms & Conditions | `Terms.dc.html` |
| Disclaimer | `Disclaimer.dc.html` |
| Thank You (post-payment) | `ThankYou.dc.html` |

## 1. Publication titles, subtitles, descriptions

Edit the text directly in that publication's file (or click into it in the
editor). Each title appears in three places within the file: the `<title>` tag,
the hero `<h1>`, and the mid-page CTA band. The same title/subtitle also appears
on `index.html` and `Library.dc.html` — update those two as well.

## 2. Publication cover images

Covers are drop-in slots — drag an image onto the placeholder in the editor and
it stays. Slot ids:

- Homepage: `tc-cover-01` … `tc-cover-05`
- Library: `tc-lib-cover-01` … `tc-lib-cover-05`
- Publication pages: `tc-p01-cover` … `tc-p05-cover`
- Chart-theme previews: `tc-pNN-bonus-mini` (hero card), `tc-pNN-bonus`
  (purchase section), `tc-lib-bonus` (Library)

## 3. Prices

`site-config.js` → `prices`. The displayed `₹399` strings also appear in each
publication file (hero, details table, CTA band, purchase section) and on the
Homepage / Library cards — search for `₹399` and replace.

## 4. Payments — Razorpay Checkout + Supabase

Payments are no longer hosted payment links. Every Buy button runs real Razorpay
Checkout, backed by three Supabase Edge Functions in `supabase/functions/`:

| Function | Called by | Does |
| --- | --- | --- |
| `create-order` | the browser, on Buy | creates a Razorpay order, inserts an `orders` row as `created` |
| `verify-payment` | the browser, after checkout | verifies the signature, marks the row `paid` / `failed` |
| `razorpay-webhook` | Razorpay, server-to-server | the backup confirmation, marks the same row |

**Prices live server-side** in `supabase/functions/_shared/catalog.ts`. The
browser only ever sends a publication id, so a tampered page cannot change the
amount it is charged. The `prices` in `site-config.js` are display strings —
change both together.

Publication ids: `risk-framework`, `traders-mind`, `position-sizing`,
`trading-system`, `review`, `bundle`.

The Razorpay **secret key never reaches the browser**. It is stored as a Supabase
Edge Function secret (`RAZORPAY_KEY_SECRET`); the public key id is handed to the
page by `create-order` at checkout time.

To change a price:

```bash
# edit supabase/functions/_shared/catalog.ts, then
supabase functions deploy create-order
# and update the matching display string in site-config.js
```

To redeploy after any function change:

```bash
supabase functions deploy create-order verify-payment razorpay-webhook
```

The buyer journey closes automatically: page → Buy → email → Razorpay popup →
`ThankYou.dc.html?order_id=…`. No callback URL needs setting in Razorpay.

## 5. Support email

`site-config.js` → `supportEmail`, plus the `mailto:support@tradingcompany.in`
links in each page footer and on the Contact page.

## 6. Secure download delivery (important)

`ThankYou.dc.html` → `DOWNLOAD_ROUTE` is deliberately empty. Do **not** paste a
public PDF URL there — it would let non-buyers download the publication. Point
it at a protected route that looks the `order_id` up in the `orders` table,
confirms `status = 'paid'`, and issues a short-lived signed URL from private
storage. A fourth Edge Function is the natural home for this. Until then the
button falls back to a support mailto (with the order reference in the subject)
so no real buyer dead-ends.

## 7. Contact form

Front-end only. Connect the submit handler in `Contact.dc.html` to your form
endpoint (a Hostinger PHP mail script or a form service).

## 8. Legal review

Have Privacy, Terms and Disclaimer reviewed by a qualified professional
before launch. Nothing in this repo is legal advice.

## 9. Deploying to Hostinger

1. Upload the whole folder to `public_html` via hPanel File Manager or FTP.
2. Keep the folder structure — `_ds/`, `uploads/`, `image-slot.js`,
   `site-config.js`, `checkout.js` and `support.js` must sit beside the page
   files. `checkout.js` is loaded as an ES module, so the pages must be served
   over http(s), not opened as `file://`.
3. Rename `index.html` to `index.html` (or add a redirect) so the domain
   root loads it, and update the nav/footer links to match any renaming.
4. Enable HTTPS in hPanel and set `tradingcompany.in` as the primary domain.
