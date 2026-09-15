-- Orders placed through Razorpay Checkout.
-- Amounts are stored in paise (Razorpay's unit), so ₹399 is 39900.

create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  publication_id    text not null,
  customer_email    text not null,
  razorpay_order_id text unique,
  razorpay_payment_id text,
  status            text not null default 'created'
                      check (status in ('created', 'paid', 'failed')),
  amount            integer not null check (amount > 0)
);

comment on table  public.orders is 'Razorpay orders for the five publications and the bundle.';
comment on column public.orders.publication_id is 'Catalog key: risk-framework, traders-mind, position-sizing, trading-system, review, or bundle.';
comment on column public.orders.amount is 'Amount in paise (39900 = ₹399).';

create index if not exists orders_razorpay_order_id_idx on public.orders (razorpay_order_id);
create index if not exists orders_customer_email_idx    on public.orders (customer_email);
create index if not exists orders_created_at_idx        on public.orders (created_at desc);

-- RLS on with no policies: anon and authenticated get nothing at all.
-- Only the Edge Functions, which use the service_role key, can read or write.
alter table public.orders enable row level security;

revoke all on public.orders from anon, authenticated;
