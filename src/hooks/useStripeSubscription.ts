// src/hooks/useStripeSubscription.ts
// Hook TanStack Query para assinatura, checkout e portal Stripe do ISP

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { externalSupabase } from "@/integrations/supabase/external-client";

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

async function getToken() {
  const { data } = await externalSupabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export function useStripeSubscription() {
  return useQuery<StripeSubscriptionData>({
    queryKey: ["stripe-subscription"],
    queryFn: async () => {
      const token = await getToken();
      const { data, error } = await externalSupabase.functions.invoke("stripe-subscription", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (error) throw error;
      return data as StripeSubscriptionData;
    },
    staleTime: 1000 * 60 * 5,
    retry: 2,
  });
}

export function useStripeCustomerPortal() {
  return useMutation({
    mutationFn: async (returnUrl: string) => {
      const token = await getToken();
      const { data, error } = await externalSupabase.functions.invoke("stripe-customer-portal", {
        method: "POST",
        body: { return_url: returnUrl },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (error) throw error;
      return data as { url: string };
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
  });
}

export function useStripeCheckout() {
  return useMutation({
    mutationFn: async ({
      price_id,
      success_url,
      cancel_url,
      test_mode = false,
    }: {
      price_id: string;
      success_url: string;
      cancel_url: string;
      test_mode?: boolean;
    }) => {
      const token = await getToken();
      const { data, error } = await externalSupabase.functions.invoke("stripe-checkout", {
        method: "POST",
        body: { price_id, success_url, cancel_url, test_mode },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (error) throw error;
      return data as { url: string; session_id: string };
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
  });
}
