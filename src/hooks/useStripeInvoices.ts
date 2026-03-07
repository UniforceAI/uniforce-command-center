// src/hooks/useStripeInvoices.ts
// Hook TanStack Query para buscar histórico de faturas Stripe do ISP

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { externalSupabase } from "@/integrations/supabase/external-client";

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

export function useStripeInvoices() {
  return useQuery<{ invoices: StripeInvoice[] }>({
    queryKey: ["stripe-invoices"],
    queryFn: async () => {
      const { data: sessData } = await externalSupabase.auth.refreshSession();
      const token =
        sessData?.session?.access_token ??
        (await externalSupabase.auth.getSession()).data.session?.access_token ??
        null;

      const { data, error } = await supabase.functions.invoke("stripe-invoices", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (error) throw error;
      return data as { invoices: StripeInvoice[] };
    },
    staleTime: 1000 * 60 * 10, // 10 minutos
    retry: 2,
  });
}
