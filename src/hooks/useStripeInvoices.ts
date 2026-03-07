// src/hooks/useStripeInvoices.ts
import { useQuery } from "@tanstack/react-query";
import { externalSupabase } from "@/integrations/supabase/external-client";

const FUNCTIONS_URL = "https://yqdqmudsnjhixtxldqwi.supabase.co/functions/v1";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxZHFtdWRzbmpoaXh0eGxkcXdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MjEwMzEsImV4cCI6MjA3MTk5NzAzMX0.UsrIuEgtJVdhZ0b76VLOjT1zVn2-OWeORGFoy487MfY";

export interface StripeInvoiceLine {
  description: string;
  amount: number;
  period_start: string;
  period_end: string;
}

export interface StripeInvoice {
  id: string;
  number: string | null;
  status: "paid" | "open" | "void" | "uncollectible" | "draft";
  amount_paid: number;
  amount_due: number;
  currency: string;
  period_start: string;
  period_end: string;
  created: string;
  due_date: string | null;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  description: string | null;
  lines: StripeInvoiceLine[];
}

export function useStripeInvoices(testMode = false) {
  return useQuery<{ invoices: StripeInvoice[] }>({
    queryKey: ["stripe-invoices", testMode],
    queryFn: async () => {
      const token = (await externalSupabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`${FUNCTIONS_URL}/stripe-invoices`, {
        method: "POST",
        headers: {
          "apikey": ANON_KEY,
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(testMode ? { "X-Stripe-Test-Mode": "true" } : {}),
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      return res.json() as Promise<{ invoices: StripeInvoice[] }>;
    },
    staleTime: 1000 * 60 * 10,
    retry: 2,
  });
}
