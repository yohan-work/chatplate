import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const clients = new Map<'visitor' | 'admin', SupabaseClient>();

export function getSupabaseClient(
  url: string,
  publishableKey: string,
  runtime: 'visitor' | 'admin',
): SupabaseClient {
  const cached = clients.get(runtime);
  if (cached) return cached;
  const client = createClient(url, publishableKey, {
    auth: {
      storageKey: `chatplate:${runtime}:auth`,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  clients.set(runtime, client);
  return client;
}
