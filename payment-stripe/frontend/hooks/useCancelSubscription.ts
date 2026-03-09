// src/hooks/useCancelSubscription.ts
// Hook mutation para cancelar uma subscription Stripe com período de compromisso

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { externalSupabase } from "@/integrations/supabase/external-client";

const FUNCTIONS_URL = "https://yqdqmudsnjhixtxldqwi.supabase.co/functions/v1";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxZHFtdWRzbmpoaXh0eGxkcXdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MjEwMzEsImV4cCI6MjA3MTk5NzAzMX0.UsrIuEgtJVdhZ0b76VLOjT1zVn2-OWeORGFoy487MfY";

export interface CancelSubscriptionResult {
  success: boolean;
  effective_cancel_at: string;
  is_immediate: boolean;
  product_name: string;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await externalSupabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    apikey: ANON_KEY,
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function useCancelSubscription(ispId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      stripe_subscription_id,
      target_isp_id,
    }: {
      stripe_subscription_id: string;
      target_isp_id?: string;
    }) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${FUNCTIONS_URL}/stripe-cancel-subscription`, {
        method: "POST",
        headers,
        body: JSON.stringify({ stripe_subscription_id, target_isp_id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `stripe-cancel-subscription falhou: HTTP ${res.status}`);
      }
      return res.json() as Promise<CancelSubscriptionResult>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["isp-services", ispId] });
      queryClient.invalidateQueries({ queryKey: ["stripe-subscription", ispId] });
    },
  });
}
