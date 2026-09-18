-- Meta Conversions API bookkeeping.
--
-- The Purchase event is sent server-side once an order is paid, by whichever of
-- verify-payment / razorpay-webhook gets there first. The webhook has no browser
-- in the loop, so the buyer's browser context is captured earlier, at
-- create-order, and kept on the row for Meta's matching.
--
-- meta_purchase_sent_at is the claim flag, same pattern as
-- confirmation_email_sent_at: claimed with a conditional UPDATE before sending,
-- reset to null if the send fails so a webhook retry can try again.

alter table public.orders
  add column if not exists client_ip_address     text,
  add column if not exists client_user_agent     text,
  add column if not exists fbp                   text,
  add column if not exists fbc                   text,
  add column if not exists event_source_url      text,
  add column if not exists meta_purchase_sent_at timestamptz;

comment on column public.orders.client_ip_address is 'Buyer IP at create-order, sent to Meta CAPI as user_data.client_ip_address.';
comment on column public.orders.client_user_agent is 'Buyer User-Agent at create-order, sent to Meta CAPI as user_data.client_user_agent.';
comment on column public.orders.fbp is 'The _fbp cookie (Meta browser id) at create-order, if the pixel had set one.';
comment on column public.orders.fbc is 'The _fbc cookie (Meta click id) at create-order, if the buyer arrived from a Meta ad.';
comment on column public.orders.event_source_url is 'The page the buyer bought from; sent to Meta CAPI as event_source_url.';
comment on column public.orders.meta_purchase_sent_at is 'When the CAPI Purchase was accepted by Meta. Claimed atomically before sending; reset to null if the send fails.';
