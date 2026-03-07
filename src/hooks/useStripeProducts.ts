// src/hooks/useStripeProducts.ts
// Hook TanStack Query para buscar catálogo de produtos/planos do Stripe

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

export function useStripeProducts(testMode = false) {
  return useQuery<StripeProductsCatalog>({
    queryKey: ["stripe-products", testMode],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("stripe-list-products", {
        headers: testMode ? { "X-Stripe-Test-Mode": "true" } : {},
      });
      if (error) throw error;
      return data as StripeProductsCatalog;
    },
    staleTime: 1000 * 60 * 30, // 30 minutos (catálogo muda pouco)
    retry: 2,
  });
}
