// src/hooks/useAsaasSubscription.ts
// Hook TanStack Query para buscar a assinatura Asaas do ISP autenticado

import { useQuery } from "@tanstack/react-query";
import { externalSupabase } from "@/integrations/supabase/external-client";

const FUNCTIONS_URL = "https://yqdqmudsnjhixtxldqwi.supabase.co/functions/v1";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxZHFtdWRzbmpoaXh0eGxkcXdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MjEwMzEsImV4cCI6MjA3MTk5NzAzMX0.UsrIuEgtJVdhZ0b76VLOjT1zVn2-OWeORGFoy487MfY";

export interface AsaasSubscription {
  id: string;
  status: string;
  value: number;
  next_due_date: string | null;
  billing_type: string;
  description: string | null;
  cycle: string | null;
}

export interface AsaasSubscriptionData {
  subscription: AsaasSubscription | null;
  is_custom_plan: boolean;
  setup_pending?: boolean;
}

export function useAsaasSubscription(ispId?: string | null) {
  return useQuery<AsaasSubscriptionData>({
    queryKey: ["asaas-subscription", ispId],
    queryFn: async () => {
      const token = (await externalSupabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`${FUNCTIONS_URL}/asaas-subscription`, {
        method: "POST",
        headers: {
          apikey: ANON_KEY,
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ target_isp_id: ispId ?? null }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => `HTTP ${res.status}`);
        throw new Error(`asaas-subscription falhou: ${text}`);
      }
      return res.json() as Promise<AsaasSubscriptionData>;
    },
    staleTime: 1000 * 60 * 5,
    retry: 1,
    throwOnError: false,
    refetchOnMount: true,
    enabled: !!ispId,
  });
}
