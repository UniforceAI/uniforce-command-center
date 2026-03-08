// stripe-invoices/index.ts
// Retorna histórico de faturas do ISP
// target_isp_id: super_admin pode consultar outro ISP — validado server-side

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-stripe-test-mode",
};

const TEST_MODE_ISP_IDS = ["uniforce"];

function getUserIdFromJWT(authHeader: string): string | null {
  try {
    const token = authHeader.replace("Bearer ", "");
    const b64 = token.split(".")[1]
      .replace(/-/g, "+").replace(/_/g, "/")
      .padEnd(Math.ceil(token.split(".")[1].length / 4) * 4, "=");
    const payload = JSON.parse(atob(b64));
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

async function resolveIsp(
  supabase: ReturnType<typeof createClient>,
  supabaseAdmin: ReturnType<typeof createClient>,
  targetIspId: string | null,
  authHeader: string
) {
  const { data: ownData } = await supabase.rpc("get_isp_stripe_data");
  const ownIsp = ownData?.[0] ?? null;

  if (!targetIspId || targetIspId === ownIsp?.isp_id) {
    return ownIsp;
  }

  const userId = getUserIdFromJWT(authHeader);
  const { data: profile } = await supabaseAdmin
    .from("profiles").select("role").eq("id", userId ?? "").maybeSingle();
  if (profile?.role !== "super_admin") return null;

  const { data: targetIsp } = await supabaseAdmin
    .from("isps")
    .select("isp_id,stripe_customer_id,stripe_test_customer_id,stripe_billing_source")
    .eq("isp_id", targetIspId)
    .single();

  return targetIsp ?? null;
}

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

    let targetIspId: string | null = null;
    try { targetIspId = (await req.json())?.target_isp_id ?? null; } catch { /* ok */ }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const isp = await resolveIsp(supabase, supabaseAdmin, targetIspId, authHeader);
    const isTestMode = TEST_MODE_ISP_IDS.includes(isp?.isp_id ?? "");

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
