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
| `get-download-link` | the browser, on Thank You load | confirms the order is `paid` before the page shows anything (see §6) |

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
supabase functions deploy create-order verify-payment razorpay-webhook get-download-link
```

The buyer journey closes automatically: page → Buy → email → Razorpay popup →
`ThankYou.dc.html?order_id=…`. No callback URL needs setting in Razorpay.

## 5. Support email

`site-config.js` → `supportEmail`, plus the `mailto:support@tradingcompany.in`
links in each page footer and on the Contact page.

## 6. Secure download delivery (in progress)

### What is built

`ThankYou.dc.html` is **gated**. On load it reads `order_id` from the URL and
POSTs it to a fourth Edge Function, `get-download-link`, which looks the order
up with the service_role key and answers only:

| Order state | Response |
| --- | --- |
| `status = 'paid'` | `200 { verified: true, publication_id, publication_title, customer_email }` |
| unpaid / unknown / malformed id | `404 { verified: false, error: 'We could not verify this order.' }` |

The three failures share one wording on purpose — the page must never confirm
whether an `order_id` exists, or it becomes a probe oracle. A network failure
lands on the same neutral branch, because the page must not show a purchase it
could not confirm. Only a `verified: true` answer reveals the purchase content.

A private Storage bucket, `publications`, exists and is **empty**. It has no
policies on `storage.objects`, so only the Edge Functions can reach it.

### What is not built yet

`DOWNLOAD_ROUTE` and `BONUS_ROUTE` in `ThankYou.dc.html` are still empty, and
`get-download-link` returns no URLs — the PDFs do not exist yet. The buttons
fall back to a support mailto carrying the order reference, so no real buyer
dead-ends. Every spot that needs wiring is marked `TODO: wire to Supabase
Storage once PDFs are uploaded`.

### Finishing it, once the PDFs exist

1. Upload into the private bucket, keyed by publication id:

   ```bash
   supabase storage cp ./risk-framework.pdf ss:///publications/risk-framework.pdf --experimental
   # …and the other four, plus chart-themes.zip for the bonus
   ```

2. In `get-download-link`, on the verified branch, sign them and return the URLs:

   ```ts
   const { data } = await db.storage.from('publications')
     .createSignedUrl(`${order.publication_id}.pdf`, 900);   // 15 minutes
   ```

   `bundle` is the one special case: it needs five signed URLs, not one.

3. Redeploy: `supabase functions deploy get-download-link`.

4. In `ThankYou.dc.html`, read `body.download_url` / `body.bonus_url` in
   `verify()` into state, and return them from `renderVals()` as `downloadUrl`
   and `bonusUrl` in place of the mailto fallback.

## 7. Contact form

Front-end only. Connect the submit handler in `Contact.dc.html` to your form
endpoint. Cloudflare Pages serves static files only — there is no PHP — so this
has to be a form service or another Supabase Edge Function, not a mail script
dropped next to the pages.

## 8. Legal review

Have Privacy, Terms and Disclaimer reviewed by a qualified professional
before launch. Nothing in this repo is legal advice.

## 9. Deploying

The site is hosted on **Cloudflare Pages**, connected to the GitHub repository
`juunyd/tradingcompany`. There is no manual upload step and no FTP: pushing to
`main` is the deploy.

```sh
git add -A
git commit -m "..."
git push origin main
```

Cloudflare Pages watches the repo, picks up the new commit within a few seconds
and rebuilds. There is no build command — the repo is served as-is from its
root — so a deploy is really just a file sync, and it is usually live inside a
minute. Watch it in the Cloudflare dashboard under **Workers & Pages → the
project → Deployments**; each deploy is tied to its commit hash, and a bad one
can be rolled back from that list without touching git.

Notes:

- Keep the folder structure. `_ds/`, `uploads/`, `image-slot.js`,
  `site-config.js`, `checkout.js` and `support.js` must stay beside the page
  files. `checkout.js` is loaded as an ES module, so the pages have to be served
  over http(s) — opening one as `file://` will not work.
- `index.html` is the domain root. If you rename it, update the nav and footer
  links on every page to match.
- HTTPS and the `tradingcompany.in` custom domain are configured once in the
  Cloudflare dashboard (**the project → Custom domains**) and need no attention
  per deploy.
- The Supabase Edge Functions deploy on their own track — Cloudflare Pages does
  not touch them. After changing anything under `supabase/functions/`, run
  `supabase functions deploy <name>` as well as pushing.
