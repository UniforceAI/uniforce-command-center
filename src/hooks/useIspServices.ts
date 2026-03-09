// src/hooks/useIspServices.ts
// Hook TanStack Query para buscar produtos contratados com commitment periods

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { externalSupabase } from "@/integrations/supabase/external-client";

const FUNCTIONS_URL = "https://yqdqmudsnjhixtxldqwi.supabase.co/functions/v1";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxZHFtdWRzbmpoaXh0eGxkcXdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MjEwMzEsImV4cCI6MjA3MTk5NzAzMX0.UsrIuEgtJVdhZ0b76VLOjT1zVn2-OWeORGFoy487MfY";

export interface ContractedItem {
  id: string;
  stripe_subscription_id: string;
  product_id: string;
  product_name: string;
  product_type: "plan" | "addon";
  billing_source: "stripe" | "asaas";
  status: "active" | "cancel_scheduled" | "canceled";
  started_at: string;
  commitment_ends_at: string;
  cancel_at: string | null;
  monthly_amount: number;
  currency: string;
  days_until_commitment_free: number;
}

export interface IspServicesData {
  isp_id: string;
  billing_source: "stripe" | "asaas" | null;
  subscription_started_at: string | null;
  last_agent_change_at: string | null;
  next_agent_change_allowed_at: string | null;
  plan: ContractedItem | null;
  addons: ContractedItem[];
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

export function useIspServices(ispId?: string | null) {
  return useQuery<IspServicesData>({
    queryKey: ["isp-services", ispId],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${FUNCTIONS_URL}/isp-services`, {
        method: "POST",
        headers,
        body: JSON.stringify({ target_isp_id: ispId ?? null }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => `HTTP ${res.status}`);
        throw new Error(`isp-services falhou: ${text}`);
      }
      return res.json() as Promise<IspServicesData>;
    },
    staleTime: 1000 * 60 * 5,
    retry: 1,
    throwOnError: false,
    enabled: !!ispId,
  });
}
