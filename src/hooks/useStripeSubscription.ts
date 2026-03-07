// src/hooks/useStripeSubscription.ts
import { useQuery, useMutation } from "@tanstack/react-query";
import { externalSupabase } from "@/integrations/supabase/external-client";

const FUNCTIONS_URL = "https://yqdqmudsnjhixtxldqwi.supabase.co/functions/v1";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxZHFtdWRzbmpoaXh0eGxkcXdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MjEwMzEsImV4cCI6MjA3MTk5NzAzMX0.UsrIuEgtJVdhZ0b76VLOjT1zVn2-OWeORGFoy487MfY";

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

async function getToken(): Promise<string | null> {
  const { data } = await externalSupabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function callFunction(name: string, options: {
  method?: string;
  body?: object;
  testMode?: boolean;
}): Promise<Response> {
  const token = await getToken();
  return fetch(`${FUNCTIONS_URL}/${name}`, {
    method: options.method ?? "POST",
    headers: {
      "apikey": ANON_KEY,
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.testMode ? { "X-Stripe-Test-Mode": "true" } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
}

export function useStripeSubscription(testMode = false) {
  return useQuery<StripeSubscriptionData>({
    queryKey: ["stripe-subscription", testMode],
    queryFn: async () => {
      const res = await callFunction("stripe-subscription", { testMode });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      return res.json() as Promise<StripeSubscriptionData>;
    },
    staleTime: 1000 * 60 * 5,
    retry: 2,
  });
}

export function useStripeCustomerPortal() {
  return useMutation({
    mutationFn: async (returnUrl: string) => {
      const res = await callFunction("stripe-customer-portal", {
        body: { return_url: returnUrl },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      return res.json() as Promise<{ url: string }>;
    },
    onSuccess: (data) => {
      window.open(data.url, "_blank", "noopener,noreferrer");
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
      const res = await callFunction("stripe-checkout", {
        body: { price_id, success_url, cancel_url, test_mode },
        testMode: test_mode,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<{ url: string; session_id: string }>;
    },
    onSuccess: (data) => {
      window.open(data.url, "_blank", "noopener,noreferrer");
    },
  });
}
