// src/hooks/useAsaasPlanChange.ts
// Mutation hook: ISP Asaas-managed seleciona um plano do catálogo Stripe
// → atualiza ou cria a assinatura correspondente no Asaas

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { externalSupabase } from "@/integrations/supabase/external-client";

const FUNCTIONS_URL = "https://yqdqmudsnjhixtxldqwi.supabase.co/functions/v1";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxZHFtdWRzbmpoaXh0eGxkcXdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MjEwMzEsImV4cCI6MjA3MTk5NzAzMX0.UsrIuEgtJVdhZ0b76VLOjT1zVn2-OWeORGFoy487MfY";

export interface AsaasPlanChangePayload {
  stripe_product_id: string;
  stripe_price_id: string;
  target_isp_id?: string | null;
}

export interface AsaasPlanChangeResult {
  success: boolean;
  action: "created" | "updated";
  plan_name: string;
  plan_value: number;
  subscription: {
    id: string;
    status: string;
    value: number;
    next_due_date: string | null;
    billing_type: string;
    description: string | null;
    cycle: string | null;
  };
  isp_id: string;
}

export function useAsaasPlanChange(ispId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation<AsaasPlanChangeResult, Error, AsaasPlanChangePayload>({
    mutationFn: async (payload) => {
      const token = (await externalSupabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`${FUNCTIONS_URL}/asaas-plan-change`, {
        method: "POST",
        headers: {
          apikey: ANON_KEY,
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(data.error ?? `Erro ao alterar plano (HTTP ${res.status})`);
      }

      return res.json() as Promise<AsaasPlanChangeResult>;
    },

    onSuccess: () => {
      // Invalidar assinatura + faturas → ambos refletem a mudança de plano imediatamente
      queryClient.invalidateQueries({ queryKey: ["asaas-subscription", ispId] });
      queryClient.invalidateQueries({ queryKey: ["asaas-subscription"] });
      queryClient.invalidateQueries({ queryKey: ["asaas-invoices", ispId] });
      queryClient.invalidateQueries({ queryKey: ["asaas-invoices"] });
    },
  });
}
