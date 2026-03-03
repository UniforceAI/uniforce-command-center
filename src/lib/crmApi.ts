/**
 * Shared helper to call the crm-api edge function with the EXTERNAL Supabase JWT.
 *
 * The crm-api validates tokens against the external Supabase auth provider,
 * so we must send the external token — not the internal Lovable Cloud one.
 */
import { supabase } from "@/integrations/supabase/client";
import { externalSupabase } from "@/integrations/supabase/external-client";

export async function callCrmApi(payload: Record<string, any>) {
  // 1. Refresh external session to ensure a valid token
  const { data: sessionData } = await externalSupabase.auth.refreshSession();
  const externalToken =
    sessionData?.session?.access_token ??
    (await externalSupabase.auth.getSession()).data.session?.access_token;

  if (!externalToken) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  // 2. Call edge function with the external JWT in the Authorization header
  const { data, error } = await supabase.functions.invoke("crm-api", {
    body: payload,
    headers: {
      Authorization: `Bearer ${externalToken}`,
    },
  });

  if (error) throw error;
  return data;
}
