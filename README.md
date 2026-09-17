# Trading Company — site guide

All 12 pages are self-contained files in this folder. No build step, no WordPress.

## Pages

| Page | File |
| --- | --- |
| Homepage | `index.html` |
| The Series (nav: "Publications") | `Library.dc.html` |
| Book One — I Lost Money in F&O. Now What. | `Book-01-I-Lost-Money-in-FO.dc.html` |
| Book Two — The Revenge Trading Cure | `Book-02-The-Revenge-Trading-Cure.dc.html` |
| Book Three — Should I Quit Trading? An Honest Test | `Book-03-Should-I-Quit-Trading.dc.html` |
| Book Four — The Comeback Plan | `Book-04-The-Comeback-Plan.dc.html` |
| About | `About.dc.html` |
| Contact | `Contact.dc.html` |
| Privacy Policy | `Privacy.dc.html` |
| Terms & Conditions | `Terms.dc.html` |
| Disclaimer | `Disclaimer.dc.html` |
| Thank You (post-payment) | `ThankYou.dc.html` |

The four books are one series, read in order, each sold on its own. There is
no bundle and no bonus download. Old `Publication-0N-*` URLs from the retired
demo catalogue are 301-redirected to the series page by `_redirects`.

## 1. Book titles, subtitles, descriptions

Edit the text directly in that book's file (or click into it in the editor).
Each title appears in the `<title>` tag, the hero `<h1>`, the "Get the book"
band and the next/previous links on the neighbouring book pages. The same
title/subtitle also appears on `index.html`, `Library.dc.html`, in
`NEXT_BOOK` in `ThankYou.dc.html`, and in `catalog.ts` (the name on the
Razorpay popup and the confirmation email) — update all of them.

## 2. Publication cover images

Covers are drop-in slots — drag an image onto the placeholder in the editor and
it stays. Slot ids:

- Homepage: `tcc-book-01` … `tcc-book-04`
- Series page: `tc-lib-book-01` … `tc-lib-book-04`
- Book pages: `tcc-b01-cover` … `tcc-b04-cover`
- Sample pages on each book page: `tcc-bNN-preview-01` … `-04`

## 3. Prices

`site-config.js` → `prices`. The displayed `₹199` strings also appear in each
book file (hero, purchase band, sticky mobile bar) and on the
Homepage / Series page rows — search for `₹199` and replace.

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

Publication ids: `lost-money-fo`, `revenge-trading-cure`,
`should-i-quit-trading`, `comeback-plan`.

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

## 6. Secure download delivery

`ThankYou.dc.html` is **gated**. On load it reads `order_id` from the URL and
POSTs it to the `get-download-link` Edge Function, which looks the order up with
the service_role key and answers only:

| Order state | Response |
| --- | --- |
| `status = 'paid'` | `200 { verified: true, publication_id, publication_title, customer_email, amount, download_url, download_expires_at }` |
| unpaid / unknown / malformed id | `404 { verified: false, error: 'We could not verify this order.' }` |

The three failures share one wording on purpose — the page must never confirm
whether an `order_id` exists, or it becomes a probe oracle.

### The files

The books live in the private Storage bucket `publications`, one file per
product id: `lost-money-fo.pdf`, `revenge-trading-cure.pdf`,
`should-i-quit-trading.pdf`, `comeback-plan.pdf`. The bucket has no policies,
so only the Edge Functions can read it. **Never commit the PDFs** — the repo is
the live site, so a committed PDF is a free public download. `uploads/pdfs/`
and `*.pdf` are gitignored for that reason.

To replace a book:

```bash
supabase storage cp "./uploads/pdfs/<file>.pdf" ss:///publications/<product-id>.pdf \
  --experimental --content-type application/pdf
```

(Use an absolute path; the CLI resolves relative paths from the project root.)

### The link

On a paid order, `get-download-link` signs a URL valid for **one hour**, with a
`download` filename built from the catalog title. Every call signs a fresh one:

- Reloading the Thank You page, or opening the link in the confirmation email
  (which points at the Thank You page, not at the file), always gives a live link.
- If the page has been left open and the link has under five minutes left, the
  download button fetches a new one before following it.
- If signing fails (for example a missing file), the purchase is still
  confirmed and the page tells the buyer to reload or write to support.

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
- **When the catalogue changes, deploy the functions and push together.**
  The pages send publication ids that the deployed `create-order` must know,
  so run `supabase functions deploy …` immediately before `git push`, or new
  pages will get "Unknown publication" at checkout.
- The Supabase Edge Functions deploy on their own track — Cloudflare Pages does
  not touch them. After changing anything under `supabase/functions/`, run
  `supabase functions deploy <name>` as well as pushing.
