-- This project does not auto-expose new public tables to the Data API roles,
-- so the Edge Functions' service_role client needs an explicit grant.
-- anon and authenticated stay locked out; RLS has no policies for them anyway.
grant usage on schema public to service_role;
grant select, insert, update on public.orders to service_role;
