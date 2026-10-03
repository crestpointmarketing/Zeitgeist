import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { RequestError } from '@/lib/api-access';

/** Never imported into client components. Cache/claim writes bypass public RPC access. */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new RequestError('Server storage is not configured yet.', 503);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
