/* ─────────────────────────────────────────────────────────────────────────────
   TRADING COMPANY — RAZORPAY CHECKOUT
   Shared by the four book pages.

   Flow:  Buy now → ask for email → create-order (Supabase) → Razorpay popup
          → verify-payment (Supabase) → ThankYou.dc.html?order_id=…

   Nothing here knows a price. The amount is decided server-side from the
   publication id, and the Razorpay secret key never reaches the browser.
   ───────────────────────────────────────────────────────────────────────────── */

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

let configPromise = null;
function config() {
  configPromise = configPromise || import('./site-config.js');
  return configPromise;
}

let scriptPromise = null;
function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  scriptPromise = scriptPromise || new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = CHECKOUT_SRC;
    s.async = true;
    s.onload = () => (window.Razorpay ? resolve(window.Razorpay) : reject(new Error('Razorpay failed to initialise')));
    s.onerror = () => { scriptPromise = null; reject(new Error('Could not reach Razorpay. Check your connection and try again.')); };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

async function callFunction(name, payload) {
  const cfg = await config();
  const { url, anonKey } = cfg.supabase || {};
  if (!url || !anonKey) throw new Error('Payments are not configured yet.');

  const res = await fetch(`${url}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`
    },
    body: JSON.stringify(payload)
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

// The Meta pixel's first-party cookies. Sent with the order so the server-side
// Purchase can be matched to the ad click; absent if the pixel was blocked.
function cookie(name) {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : undefined;
}

/* ── the email step ──────────────────────────────────────────────────────────
   Razorpay collects an email of its own, but we need one BEFORE the order
   exists so the row in `orders` can be traced back to a buyer. Built in plain
   DOM so it works the same on every page regardless of component state. */

// Single quotes only: this string is interpolated into a style="…" attribute,
// so a double quote here would close the attribute and drop every rule after it.
const FONT_H = "var(--font-heading, 'Helvetica Neue', Arial, sans-serif)";

function emailDialog() {
  const prior = document.activeElement;

  const overlay = document.createElement('div');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Enter your email to continue');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.72);' +
    'display:flex;align-items:center;justify-content:center;padding:20px';

  const panel = document.createElement('div');
  panel.style.cssText =
    'background:#FFFFFF;color:#000000;border:2px solid #000000;max-width:440px;width:100%;' +
    'padding:clamp(24px,4vw,36px);box-sizing:border-box';

  panel.innerHTML =
    '<h2 style="margin:0 0 10px;font-family:' + FONT_H + ';font-weight:800;font-size:15px;' +
      'letter-spacing:0.16em;text-transform:uppercase">Where should we send it?</h2>' +
    '<p style="margin:0 0 20px;font-size:14px;line-height:1.55;color:rgba(0,0,0,0.7)">' +
      'Your receipt and download link go to this address.</p>' +
    '<label for="tc-email" style="display:block;margin:0 0 8px;font-family:' + FONT_H + ';' +
      'font-weight:800;font-size:11px;letter-spacing:0.14em;text-transform:uppercase">Email address</label>' +
    '<input id="tc-email" type="email" autocomplete="email" inputmode="email" required ' +
      'placeholder="you@example.com" style="width:100%;box-sizing:border-box;padding:14px 16px;' +
      'font-size:16px;border:1px solid rgba(0,0,0,0.6);background:#FFFFFF;color:#000000;border-radius:0">' +
    '<p id="tc-err" role="alert" style="margin:10px 0 0;font-size:13px;line-height:1.5;color:#B00020;display:none"></p>' +
    '<div style="display:flex;gap:12px;margin-top:22px;flex-wrap:wrap">' +
      '<button id="tc-go" type="button" style="flex:1 1 200px;font-family:' + FONT_H + ';font-weight:800;' +
        'font-size:12px;letter-spacing:0.16em;text-transform:uppercase;padding:17px 24px;background:#000000;' +
        'color:#FFFFFF;border:2px solid #000000;cursor:pointer;min-height:52px">Continue to payment</button>' +
      '<button id="tc-cancel" type="button" style="flex:0 0 auto;font-family:' + FONT_H + ';font-weight:800;' +
        'font-size:12px;letter-spacing:0.16em;text-transform:uppercase;padding:17px 24px;background:transparent;' +
        'color:#000000;border:2px solid #000000;cursor:pointer;min-height:52px">Cancel</button>' +
    '</div>';

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  const input = panel.querySelector('#tc-email');
  const err = panel.querySelector('#tc-err');
  const go = panel.querySelector('#tc-go');
  const cancel = panel.querySelector('#tc-cancel');

  const scrollLock = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  let busy = false;
  let onSubmit = null;
  let onCancel = null;

  function close() {
    document.body.style.overflow = scrollLock;
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    if (prior && prior.focus) prior.focus();
  }
  function bail() {
    if (busy) return;              // never abandon an order mid-creation
    close();
    if (onCancel) onCancel();
  }
  function onKey(e) {
    if (e.key === 'Escape') { bail(); return; }
    if (e.key === 'Tab') {
      const f = [input, go, cancel].filter((el) => !el.disabled);
      const i = f.indexOf(document.activeElement);
      if (i !== -1) { e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus(); }
    }
  }
  function submit() {
    if (busy) return;
    const value = input.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      api.showError('Please enter a valid email address.');
      input.focus();
      return;
    }
    if (onSubmit) onSubmit(value);
  }

  go.addEventListener('click', submit);
  cancel.addEventListener('click', bail);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) bail(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  document.addEventListener('keydown', onKey);
  setTimeout(() => input.focus(), 30);

  const api = {
    onSubmit(fn) { onSubmit = fn; return api; },
    onCancel(fn) { onCancel = fn; return api; },
    setBusy(state) {
      busy = state;
      input.disabled = state;
      go.disabled = state;
      cancel.disabled = state;
      go.textContent = state ? 'Opening secure checkout…' : 'Continue to payment';
      go.style.opacity = state ? '0.6' : '1';
      go.style.cursor = state ? 'progress' : 'pointer';
      if (state) { err.style.display = 'none'; }
    },
    showError(message) {
      err.textContent = message;
      err.style.display = 'block';
    },
    close
  };
  return api;
}

/* ── the confirmation overlay ────────────────────────────────────────────────
   Razorpay's popup closes the moment the payment succeeds, but verify-payment
   still has to run before the Thank You page can open. Without this the page
   sits still for a few seconds and looks broken. It can never be dismissed
   while confirming, and it never ends on a spinner with no explanation. */

const STILL_CONFIRMING_MS = 8000;    // reassure
const GIVE_UP_WAITING_MS = 25000;    // stop promising; the request keeps running

function confirmingOverlay() {
  if (!document.getElementById('tc-confirm-style')) {
    const style = document.createElement('style');
    style.id = 'tc-confirm-style';
    style.textContent =
      '@keyframes tc-confirm-spin{to{transform:rotate(360deg)}}' +
      '.tc-confirm-spinner{animation:tc-confirm-spin .9s linear infinite}' +
      '@media (prefers-reduced-motion: reduce){.tc-confirm-spinner{animation:none;border-top-color:#000000}}';
    document.head.appendChild(style);
  }

  const overlay = document.createElement('div');
  overlay.setAttribute('role', 'alertdialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'tc-confirm-title');
  overlay.setAttribute('aria-describedby', 'tc-confirm-text');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.72);' +
    'display:flex;align-items:center;justify-content:center;padding:20px';

  const panel = document.createElement('div');
  panel.style.cssText =
    'background:#FFFFFF;color:#000000;border:2px solid #000000;max-width:440px;width:100%;' +
    'padding:clamp(28px,4vw,40px);box-sizing:border-box';

  panel.innerHTML =
    '<div id="tc-confirm-spinner" class="tc-confirm-spinner" aria-hidden="true" style="width:30px;height:30px;' +
      'box-sizing:border-box;border:2px solid #000000;border-top-color:transparent;border-radius:50%;margin:0 0 24px"></div>' +
    '<h2 id="tc-confirm-title" style="margin:0 0 10px;font-family:' + FONT_H + ';font-weight:800;font-size:15px;' +
      'letter-spacing:0.16em;text-transform:uppercase"></h2>' +
    '<p id="tc-confirm-text" aria-live="polite" style="margin:0;font-size:15px;line-height:1.6;color:rgba(0,0,0,0.72)"></p>' +
    '<div id="tc-confirm-actions" style="display:none;gap:12px;margin-top:24px;flex-wrap:wrap"></div>';

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  const scrollLock = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  const title = panel.querySelector('#tc-confirm-title');
  const text = panel.querySelector('#tc-confirm-text');
  const spinner = panel.querySelector('#tc-confirm-spinner');
  const actions = panel.querySelector('#tc-confirm-actions');

  const btn = (primary) =>
    'font-family:' + FONT_H + ';font-weight:800;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;' +
    'padding:17px 24px;min-height:52px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;' +
    'border:2px solid #000000;box-sizing:border-box;' +
    (primary ? 'background:#000000;color:#FFFFFF;flex:1 1 200px' : 'background:transparent;color:#000000;flex:0 0 auto');

  const api = {
    show(heading, message) {
      title.textContent = heading;
      text.textContent = message;
    },
    // The dead end, done properly: stop the spinner, say what to do, let them close it.
    fail(heading, message, supportHref, onClose) {
      spinner.style.display = 'none';
      api.show(heading, message);
      actions.innerHTML = '';
      const mail = document.createElement('a');
      mail.href = supportHref;
      mail.textContent = 'Email support';
      mail.style.cssText = btn(true);
      const close = document.createElement('button');
      close.type = 'button';
      close.textContent = 'Close';
      close.style.cssText = btn(false);
      close.addEventListener('click', () => { api.remove(); if (onClose) onClose(); });
      actions.append(mail, close);
      actions.style.display = 'flex';
      mail.focus();
    },
    remove() {
      document.body.style.overflow = scrollLock;
      overlay.remove();
    }
  };
  api.show('Confirming your payment…', 'This takes a few seconds. Please keep this page open.');
  return api;
}

/* ── public entry point ───────────────────────────────────────────────────── */

let inFlight = false;

export function startCheckout(publicationId) {
  if (inFlight) return;
  inFlight = true;

  const dialog = emailDialog();
  dialog.onCancel(() => { inFlight = false; });

  dialog.onSubmit(async (email) => {
    dialog.setBusy(true);
    try {
      const [Razorpay, order, cfg] = await Promise.all([
        loadRazorpay(),
        callFunction('create-order', {
          publication_id: publicationId,
          customer_email: email,
          fbp: cookie('_fbp'),
          fbc: cookie('_fbc'),
          event_source_url: window.location.href
        }),
        config()
      ]);

      const thankYou = cfg.thankYouUrl || 'ThankYou.dc.html';

      const rzp = new Razorpay({
        key: order.key_id,               // public test key, returned by the server
        amount: order.amount,
        currency: order.currency,
        order_id: order.order_id,
        name: 'Trading Company',
        description: order.publication_title,
        prefill: { email },
        theme: { color: '#000000' },

        handler: async (response) => {
          // Up before anything else runs, so there is never a still, silent page.
          const overlay = confirmingOverlay();
          const paymentRef = response.razorpay_payment_id || '';
          const support = cfg.supportEmail || 'support@tradingcompany.in';
          const supportHref = 'mailto:' + support + '?subject=' +
            encodeURIComponent('Payment not confirmed' + (paymentRef ? ' — ' + paymentRef : '')) +
            '&body=' + encodeURIComponent(
              'Book: ' + order.publication_title + '\nPayment ID: ' + paymentRef +
              '\nOrder: ' + response.razorpay_order_id + '\n');
          const failed = () => overlay.fail(
            'We could not confirm it here',
            'If money has left your account, your purchase is safe — nothing is lost. ' +
            'Email ' + support + ' with your payment ID' + (paymentRef ? ' (' + paymentRef + ')' : '') +
            ' and we will send your book straight away.',
            supportHref,
            () => { inFlight = false; }
          );

          let settled = false;
          const slow = setTimeout(() => {
            if (!settled) overlay.show('Still confirming…', 'This can take a few extra seconds. Please keep this page open.');
          }, STILL_CONFIRMING_MS);
          // The request is not cancelled: if it succeeds after this, we still redirect.
          const tooSlow = setTimeout(() => { if (!settled) failed(); }, GIVE_UP_WAITING_MS);

          try {
            const result = await callFunction('verify-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            });
            settled = true;
            clearTimeout(slow); clearTimeout(tooSlow);
            if (result.success) {
              overlay.show('Payment confirmed', 'Opening your download page…');
              const q = new URLSearchParams({
                order_id: result.order_id,
                publication: publicationId
              });
              window.location.href = thankYou + '?' + q.toString();
              return;                    // navigating away; the overlay stays up until it does
            }
            failed();
          } catch (e) {
            settled = true;
            clearTimeout(slow); clearTimeout(tooSlow);
            console.error('verify-payment failed', e);
            failed();
          }
        },

        modal: { ondismiss: () => { inFlight = false; } }   // buyer closed the popup
      });

      // Razorpay shows the failure inside its own popup and lets the buyer retry
      // there, so nothing to draw here; ondismiss frees the button when they leave.
      rzp.on('payment.failed', (e) => {
        console.warn('payment failed', (e && e.error) || e);
      });

      dialog.close();                    // hand over to Razorpay's own popup
      rzp.open();
    } catch (e) {
      dialog.setBusy(false);
      dialog.showError(e.message || 'Something went wrong starting the payment.');
    }
  });
}

export default startCheckout;
