// stripe-customer-portal/index.ts
// Supabase Edge Function — Cria sessão no Stripe Customer Portal
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

    const { return_url } = await req.json().catch(() => ({}));

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
