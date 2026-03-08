// stripe-subscription/index.ts
// LÓGICA DE SEGURANÇA SIMPLIFICADA:
// - get_isp_stripe_data() é SECURITY DEFINER — retorna dados do ISP do JWT autenticado
// - Se ownIsp.isp_id === 'uniforce' → usuário é super_admin → pode ver qualquer ISP
// - Qualquer outro ISP → acessa apenas os próprios dados

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-stripe-test-mode",
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

    // Buscar dados do ISP do usuário autenticado via RPC SECURITY DEFINER
    const { data: ownData } = await supabase.rpc("get_isp_stripe_data");
    const ownIsp = ownData?.[0] ?? null;
    const ownIspId: string | null = ownIsp?.isp_id ?? null;

    // Determinar ISP alvo
    // Super_admin (isp_id='uniforce') pode ver qualquer ISP via target_isp_id
    // ISP regular só pode ver seus próprios dados
    let isp = ownIsp;

    if (targetIspId && targetIspId !== ownIspId) {
      if (ownIspId !== "uniforce") {
        // ISP regular tentando acessar outro ISP — negado
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Super_admin: buscar dados do ISP alvo
      const { data: targetIsp } = await supabaseAdmin
        .from("isps")
        .select(
          "isp_id,stripe_customer_id,stripe_test_customer_id,stripe_subscription_id," +
          "stripe_subscription_status,stripe_product_id,stripe_price_id,stripe_product_name," +
          "stripe_monthly_amount,stripe_current_period_start,stripe_current_period_end," +
          "stripe_cancel_at_period_end,stripe_trial_end,stripe_billing_source"
        )
        .eq("isp_id", targetIspId)
        .single();
      isp = targetIsp ?? null;
    }

    if (!isp) {
      return new Response(
        JSON.stringify({ subscription: null, isp_id: targetIspId, message: "ISP não encontrado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // isTestMode SOMENTE para uniforce
    const isTestMode = TEST_MODE_ISP_IDS.includes(isp.isp_id);
    const customerId = isTestMode
      ? (isp.stripe_test_customer_id ?? isp.stripe_customer_id)
      : isp.stripe_customer_id;

    if (!isp.stripe_subscription_id) {
      return new Response(
        JSON.stringify({
          subscription: null,
          stripe_customer_id: customerId ?? null,
          stripe_billing_source: isp.stripe_billing_source ?? null,
          isp_id: isp.isp_id,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripeKey = isTestMode
      ? (Deno.env.get("STRIPE_TEST_SECRET_KEY") ?? "")
      : (Deno.env.get("STRIPE_SECRET_KEY") ?? "");

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2024-06-20",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const subscription = await stripe.subscriptions.retrieve(
      isp.stripe_subscription_id,
      { expand: ["default_payment_method", "items.data.price.product"] }
    );

    const item = subscription.items.data[0];
    const price = item?.price as Stripe.Price & { product: Stripe.Product };
    const product = price?.product as Stripe.Product;
    const paymentMethod = subscription.default_payment_method as Stripe.PaymentMethod | null;

    return new Response(
      JSON.stringify({
        isp_id: isp.isp_id,
        stripe_billing_source: isp.stripe_billing_source ?? "stripe",
        stripe_customer_id: customerId ?? null,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          product_id: product?.id ?? null,
          product_name: product?.name ?? null,
          price_id: price?.id ?? null,
          monthly_amount: (price?.unit_amount ?? 0) / 100,
          currency: price?.currency?.toUpperCase() ?? "BRL",
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end,
          trial_end: subscription.trial_end
            ? new Date(subscription.trial_end * 1000).toISOString()
            : null,
          payment_method: paymentMethod
            ? {
                type: paymentMethod.type,
                brand: paymentMethod.card?.brand ?? null,
                last4: paymentMethod.card?.last4 ?? null,
                exp_month: paymentMethod.card?.exp_month ?? null,
                exp_year: paymentMethod.card?.exp_year ?? null,
              }
            : null,
          features: product?.marketing_features?.map((f) => f.name) ?? [],
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("stripe-subscription error:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao buscar assinatura" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
