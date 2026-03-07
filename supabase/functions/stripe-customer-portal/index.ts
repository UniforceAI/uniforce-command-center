// stripe-customer-portal/index.ts
// Cria sessão no Stripe Customer Portal
// target_isp_id: super_admin pode abrir portal de outro ISP — validado server-side

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TEST_MODE_ISP_IDS = ["uniforce"];

async function resolveIsp(
  supabase: ReturnType<typeof createClient>,
  supabaseAdmin: ReturnType<typeof createClient>,
  targetIspId: string | null
) {
  const { data: ownData } = await supabase.rpc("get_isp_stripe_data");
  const ownIsp = ownData?.[0] ?? null;

  if (!targetIspId || targetIspId === ownIsp?.isp_id) {
    return { isp: ownIsp, forbidden: false };
  }

  const { data: profile } = await supabase.from("profiles").select("role").single();
  if (profile?.role !== "super_admin") return { isp: null, forbidden: true };

  const { data: targetIsp } = await supabaseAdmin
    .from("isps")
    .select("isp_id,stripe_customer_id,stripe_test_customer_id,stripe_billing_source")
    .eq("isp_id", targetIspId)
    .single();

  return { isp: targetIsp ?? null, forbidden: false };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let return_url: string | undefined;
    let targetIspId: string | null = null;
    try {
      const body = await req.json();
      return_url = body?.return_url;
      targetIspId = body?.target_isp_id ?? null;
    } catch { /* ok */ }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { isp, forbidden } = await resolveIsp(supabase, supabaseAdmin, targetIspId);

    if (forbidden) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isTestMode = TEST_MODE_ISP_IDS.includes(isp?.isp_id ?? "");
    const customerId = isTestMode
      ? (isp?.stripe_test_customer_id ?? null)
      : (isp?.stripe_customer_id ?? null);

    if (!customerId) {
      return new Response(
        JSON.stringify({ error: "ISP não possui conta Stripe. Contrate um plano primeiro." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripeKey = isTestMode
      ? (Deno.env.get("STRIPE_TEST_SECRET_KEY") ?? Deno.env.get("STRIPE_SECRET_KEY") ?? "")
      : (Deno.env.get("STRIPE_SECRET_KEY") ?? "");

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2024-06-20",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: return_url ?? `${req.headers.get("origin")}/configuracoes/perfil?tab=meus-produtos`,
    });

    return new Response(
      JSON.stringify({ url: portalSession.url }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("stripe-customer-portal error:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao criar sessão do portal" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
