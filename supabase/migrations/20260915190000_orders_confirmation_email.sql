-- Confirmation-email bookkeeping.
--
-- verify-payment and razorpay-webhook both settle an order and both race to
-- send the receipt. This column is the claim flag that keeps exactly one of
-- them winning: a sender claims the row with a conditional UPDATE
-- (... where confirmation_email_sent_at is null) and only sends if the update
-- matched. A send that then fails resets the column to null so a webhook
-- retry can pick it up again.

alter table public.orders
  add column if not exists confirmation_email_sent_at timestamptz;

comment on column public.orders.confirmation_email_sent_at is
  'When the order-confirmation email was handed to Resend. Claimed atomically before sending; reset to null if the send fails, so a retry can re-claim it.';

-- Lets the "which paid orders never got a receipt" query stay cheap.
create index if not exists orders_confirmation_pending_idx
  on public.orders (created_at desc)
  where status = 'paid' and confirmation_email_sent_at is null;
