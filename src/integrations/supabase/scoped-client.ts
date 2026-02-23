/**
 * Creates a scoped Supabase client that injects the x-isp-id header
 * for RLS policies based on current_setting('request.header.x-isp-id', true).
 *
 * Usage:
 *   const client = getScopedClient(ispId);
 *   const { data } = await client.from("risk_bucket_config").select("*");
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const clientCache = new Map<string, ReturnType<typeof createClient<Database>>>();

export function getScopedClient(ispId: string) {
  if (!ispId) {
    throw new Error("getScopedClient: ispId is required for multi-tenant isolation");
  }

  const cached = clientCache.get(ispId);
  if (cached) return cached;

  const client = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    global: {
      headers: { "x-isp-id": ispId },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  clientCache.set(ispId, client);
  return client;
}
