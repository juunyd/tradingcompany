-- The demo catalogue (five publications and a bundle) is replaced by the
-- four-book recovery series, each book sold on its own. Prices and titles live
-- in supabase/functions/_shared/catalog.ts; only the documentation changes here.

comment on table  public.orders is 'Razorpay orders for the four books in the recovery series. One order is one book.';
comment on column public.orders.publication_id is 'Catalog key: lost-money-fo, revenge-trading-cure, should-i-quit-trading or comeback-plan.';
