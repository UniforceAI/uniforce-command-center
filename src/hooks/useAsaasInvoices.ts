// src/hooks/useAsaasInvoices.ts
// Hook TanStack Query para buscar histórico de cobranças Asaas do ISP

import { useQuery } from "@tanstack/react-query";
import { externalSupabase } from "@/integrations/supabase/external-client";

const FUNCTIONS_URL = "https://yqdqmudsnjhixtxldqwi.supabase.co/functions/v1";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxZHFtdWRzbmpoaXh0eGxkcXdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MjEwMzEsImV4cCI6MjA3MTk5NzAzMX0.UsrIuEgtJVdhZ0b76VLOjT1zVn2-OWeORGFoy487MfY";

export type AsaasInvoiceStatus = "paid" | "open" | "overdue" | "refunded" | "other";

export interface AsaasInvoice {
  id: string;
  due_date: string | null;
  value: number;
  status: AsaasInvoiceStatus;
  billing_type: string;
  bank_slip_url: string | null;
  invoice_url: string | null;
  description: string | null;
}

export function useAsaasInvoices(ispId?: string | null) {
  return useQuery<{ invoices: AsaasInvoice[] }>({
    queryKey: ["asaas-invoices", ispId],
    queryFn: async () => {
      const token = (await externalSupabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`${FUNCTIONS_URL}/asaas-invoices`, {
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
        throw new Error(`asaas-invoices falhou: ${text}`);
      }
      return res.json() as Promise<{ invoices: AsaasInvoice[] }>;
    },
    staleTime: 1000 * 60 * 10,
    retry: 1,
    throwOnError: false,
    refetchOnMount: true,
    enabled: !!ispId,
  });
}
