// src/hooks/useStripeSubscription.ts
// Hook TanStack Query para buscar a assinatura Stripe do ISP autenticado

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { externalSupabase } from "@/integrations/supabase/external-client";

const FUNCTIONS_URL = "https://yqdqmudsnjhixtxldqwi.supabase.co/functions/v1";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxZHFtdWRzbmpoaXh0eGxkcXdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MjEwMzEsImV4cCI6MjA3MTk5NzAzMX0.UsrIuEgtJVdhZ0b76VLOjT1zVn2-OWeORGFoy487MfY";

export interface StripePaymentMethod {
  type: string;
  brand: string | null;
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
}

export interface StripeSubscription {
  id: string;
  status: "active" | "past_due" | "canceled" | "trialing" | "incomplete" | "unpaid";
  product_id: string | null;
  product_name: string | null;
  price_id: string | null;
  monthly_amount: number;
  currency: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  trial_end: string | null;
  payment_method: StripePaymentMethod | null;
  features: string[];
}

export interface StripeSubscriptionData {
  isp_id: string;
  stripe_customer_id: string | null;
  stripe_billing_source: "stripe" | "asaas" | null;
  subscription: StripeSubscription | null;
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

export function useStripeSubscription() {
  return useQuery<StripeSubscriptionData>({
    queryKey: ["stripe-subscription"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${FUNCTIONS_URL}/stripe-subscription`, {
        method: "POST",
        headers,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => `HTTP ${res.status}`);
        throw new Error(`stripe-subscription falhou: ${text}`);
      }
      return res.json() as Promise<StripeSubscriptionData>;
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
    retry: 2,
  });
}

export function useStripeCustomerPortal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (returnUrl: string) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${FUNCTIONS_URL}/stripe-customer-portal`, {
        method: "POST",
        headers,
        body: JSON.stringify({ return_url: returnUrl }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => `HTTP ${res.status}`);
        throw new Error(`stripe-customer-portal falhou: ${text}`);
      }
      return res.json() as Promise<{ url: string }>;
    },
    onSuccess: (data) => {
      // window.open para suporte a iframe (Lovable preview) e produção
      window.open(data.url, "_blank", "noopener,noreferrer");
      queryClient.invalidateQueries({ queryKey: ["stripe-subscription"] });
    },
  });
}

export function useStripeCheckout() {
  return useMutation({
    mutationFn: async ({
      price_id,
      success_url,
      cancel_url,
    }: {
      price_id: string;
      success_url: string;
      cancel_url: string;
    }) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${FUNCTIONS_URL}/stripe-checkout`, {
        method: "POST",
        headers,
        body: JSON.stringify({ price_id, success_url, cancel_url }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `stripe-checkout falhou: HTTP ${res.status}`);
      }
      return res.json() as Promise<{ url: string; session_id: string }>;
    },
    onSuccess: (data) => {
      window.open(data.url, "_blank", "noopener,noreferrer");
    },
  });
}
