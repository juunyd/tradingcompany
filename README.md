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

## 4. Razorpay Payment Links

`site-config.js` → `payments`. One key per publication:

```
riskFrameworkPaymentUrl
tradersMindPaymentUrl
positionSizingPaymentUrl
tradingSystemPaymentUrl
reviewPaymentUrl
bundlePaymentUrl   # all five publications for ₹999
```

Paste the Payment Link / Checkout URL into the matching key. Every BUY NOW
button on that publication (hero, mid-page band, purchase section, sticky mobile
bar) picks it up automatically. Until a URL is set the buttons are inert.

In the Razorpay dashboard, set the success/callback URL to `ThankYou.dc.html` so
the purchase journey closes: page → BUY NOW → Razorpay → Thank You.

## 5. Support email

`site-config.js` → `supportEmail`, plus the `mailto:support@tradingcompany.in`
links in each page footer and on the Contact page.

## 6. Secure download delivery (important)

`ThankYou.dc.html` → `DOWNLOAD_ROUTE` is deliberately empty. Do **not** paste a
public PDF URL there — it would let non-buyers download the publication. Point
it at a protected server route that verifies the Razorpay payment server-side
and issues a short-lived signed URL from private storage. Until then the button
falls back to a support mailto so no real buyer dead-ends.

## 7. Contact form

Front-end only. Connect the submit handler in `Contact.dc.html` to your form
endpoint (a Hostinger PHP mail script or a form service).

## 8. Legal review

Have Privacy, Terms and Disclaimer reviewed by a qualified professional
before launch. Nothing in this repo is legal advice.

## 9. Deploying to Hostinger

1. Upload the whole folder to `public_html` via hPanel File Manager or FTP.
2. Keep the folder structure — `_ds/`, `uploads/`, `image-slot.js`,
   `site-config.js` and `support.js` must sit beside the page files.
3. Rename `index.html` to `index.html` (or add a redirect) so the domain
   root loads it, and update the nav/footer links to match any renaming.
4. Enable HTTPS in hPanel and set `tradingcompany.in` as the primary domain.
