// src/hooks/useStripeProducts.ts
// Hook TanStack Query para buscar catálogo de produtos/planos do Stripe

import { useQuery } from "@tanstack/react-query";
import { externalSupabase } from "@/integrations/supabase/external-client";

const FUNCTIONS_URL = "https://yqdqmudsnjhixtxldqwi.supabase.co/functions/v1";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxZHFtdWRzbmpoaXh0eGxkcXdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MjEwMzEsImV4cCI6MjA3MTk5NzAzMX0.UsrIuEgtJVdhZ0b76VLOjT1zVn2-OWeORGFoy487MfY";

export interface StripePrice {
  id: string;
  amount: number;
  currency: string;
  interval: "month" | "year" | "one_time";
  interval_count: number;
}

export interface StripeProduct {
  id: string;
  name: string;
  description: string;
  type: "plan" | "addon" | "service";
  features: string[];
  metadata: Record<string, string>;
  prices: StripePrice[];
  monthly_price_id: string | null;
  monthly_amount: number | null;
  one_time_price_id: string | null;
  one_time_amount: number | null;
}

export interface StripeProductsCatalog {
  plans: StripeProduct[];
  addons: StripeProduct[];
  services: StripeProduct[];
}

export function useStripeProducts() {
  return useQuery<StripeProductsCatalog>({
    queryKey: ["stripe-products"],
    queryFn: async () => {
      const token = (await externalSupabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`${FUNCTIONS_URL}/stripe-list-products`, {
        method: "POST",
        headers: {
          apikey: ANON_KEY,
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => `HTTP ${res.status}`);
        throw new Error(`stripe-list-products falhou: ${text}`);
      }
      return res.json() as Promise<StripeProductsCatalog>;
    },
    staleTime: 1000 * 60 * 30, // 30 minutos
    retry: 2,
  });
}
