// stripe-checkout/index.ts
// Supabase Edge Function — Cria sessão de Stripe Checkout para contratação de plano
// Test mode detectado automaticamente: isp_id='uniforce' → usa sk_test_*

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

    const { price_id, success_url, cancel_url } = await req.json();
    if (!price_id || !success_url || !cancel_url) {
      return new Response(
        JSON.stringify({ error: "price_id, success_url e cancel_url são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: ispData } = await supabase.rpc("get_isp_stripe_data");
    const isp = ispData?.[0];
    if (!isp) {
      return new Response(JSON.stringify({ error: "ISP não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: ispInfo } = await supabase
      .from("isps")
      .select("isp_nome, isp_id")
      .eq("isp_id", isp.isp_id)
      .single();

    // Test mode automático por isp_id — sem body param, sem custom header
    const isTestMode = TEST_MODE_ISP_IDS.includes(isp.isp_id);
    const stripeKey = isTestMode
      ? Deno.env.get("STRIPE_TEST_SECRET_KEY")!
      : Deno.env.get("STRIPE_SECRET_KEY")!;

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2024-06-20",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // ISPs em test mode têm customer separado para não misturar com live
    let customerId = isTestMode ? isp.stripe_test_customer_id : isp.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: ispInfo?.isp_nome ?? user.email,
        metadata: { isp_id: isp.isp_id, supabase_user_id: user.id },
      });
      customerId = customer.id;

      const customerColumn = isTestMode ? "stripe_test_customer_id" : "stripe_customer_id";
      await supabaseAdmin
        .from("isps")
        .update({ [customerColumn]: customerId })
        .eq("isp_id", isp.isp_id);
    }

    // Bloquear novo checkout se já tem assinatura ativa (apenas em live mode)
    if (!isTestMode && isp.stripe_subscription_id && isp.stripe_subscription_status === "active") {
      return new Response(
        JSON.stringify({
          error: "ISP já possui uma assinatura ativa. Use o Customer Portal para alterar o plano.",
          redirect_to_portal: true,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: price_id, quantity: 1 }],
      success_url,
      cancel_url,
      locale: "pt-BR",
      subscription_data: { metadata: { isp_id: isp.isp_id } },
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      client_reference_id: isp.isp_id,
    });

    return new Response(
      JSON.stringify({ url: session.url, session_id: session.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("stripe-checkout error:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao criar sessão de checkout" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
