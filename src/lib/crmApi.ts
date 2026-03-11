/**
 * Shared helper to call the crm-api edge function.
 *
 * Both auth and data now live in the same Supabase project (yqdqmudsnjhixtxldqwi),
 * so we use the externalSupabase client for both the JWT and the function invocation.
 */
import { externalSupabase } from "@/integrations/supabase/external-client";

export async function callCrmApi(payload: Record<string, any>) {
  // 1. Ensure a valid session token (getSession is passive — no auth events fired)
  const { data: sessionData } = await externalSupabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  if (!token) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  // 2. Call edge function on the official Uniforce Supabase project
  const { data, error } = await externalSupabase.functions.invoke("crm-api", {
    body: payload,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (error) throw error;
  return data;
}
