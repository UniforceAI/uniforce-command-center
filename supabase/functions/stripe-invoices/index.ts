// stripe-invoices/index.ts
// Supabase Edge Function — Retorna histórico de faturas do ISP autenticado
// Test mode detectado automaticamente: isp_id='uniforce' → usa sk_test_* e stripe_test_customer_id

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TEST_MODE_ISP_IDS = ["uniforce"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: ispData } = await supabase.rpc("get_isp_stripe_data");
    const isp = ispData?.[0];

    const isTestMode = TEST_MODE_ISP_IDS.includes(isp?.isp_id ?? "");

    // Test mode ISPs têm customer separado
    const customerId = isTestMode
      ? (isp?.stripe_test_customer_id ?? null)
      : (isp?.stripe_customer_id ?? null);

    if (!customerId) {
      return new Response(
        JSON.stringify({ invoices: [], message: "Nenhuma fatura disponível" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripeKey = isTestMode
      ? (Deno.env.get("STRIPE_TEST_SECRET_KEY") ?? Deno.env.get("STRIPE_SECRET_KEY") ?? "")
      : (Deno.env.get("STRIPE_SECRET_KEY") ?? "");

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2024-06-20",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const invoicesRes = await stripe.invoices.list({
      customer: customerId,
      limit: 24,
      expand: ["data.subscription"],
    });

    const invoices = invoicesRes.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      status: inv.status,
      amount_paid: (inv.amount_paid ?? 0) / 100,
      amount_due: (inv.amount_due ?? 0) / 100,
      currency: inv.currency.toUpperCase(),
      period_start: new Date((inv.period_start ?? 0) * 1000).toISOString(),
      period_end: new Date((inv.period_end ?? 0) * 1000).toISOString(),
      created: new Date((inv.created ?? 0) * 1000).toISOString(),
      due_date: inv.due_date ? new Date(inv.due_date * 1000).toISOString() : null,
      hosted_invoice_url: inv.hosted_invoice_url,
      invoice_pdf: inv.invoice_pdf,
      description: inv.description,
      lines: inv.lines.data.map((line) => ({
        description: line.description,
        amount: (line.amount ?? 0) / 100,
        period_start: new Date((line.period?.start ?? 0) * 1000).toISOString(),
        period_end: new Date((line.period?.end ?? 0) * 1000).toISOString(),
      })),
    }));

    return new Response(
      JSON.stringify({ invoices }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("stripe-invoices error:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao buscar faturas" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
