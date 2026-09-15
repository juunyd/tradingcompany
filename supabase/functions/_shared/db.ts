import { createClient } from 'jsr:@supabase/supabase-js@2';

// service_role bypasses RLS. The orders table has no policies, so this is the
// only way in — which is the point.
export function adminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}
