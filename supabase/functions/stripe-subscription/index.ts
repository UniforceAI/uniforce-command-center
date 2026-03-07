// stripe-subscription/index.ts
// Supabase Edge Function — Retorna estado da assinatura Stripe do ISP autenticado
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

    const { data: ispData, error: ispError } = await supabase.rpc("get_isp_stripe_data");
    if (ispError) throw ispError;

    const isp = ispData?.[0];
    if (!isp) {
      return new Response(JSON.stringify({ subscription: null, message: "ISP não encontrado" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Test mode automático por isp_id — sem dependência de custom header
    const isTestMode = TEST_MODE_ISP_IDS.includes(isp.isp_id);

    // Para ISPs em test mode, usar stripe_test_customer_id e subscription correspondente
    const customerId = isTestMode
      ? (isp.stripe_test_customer_id ?? isp.stripe_customer_id)
      : isp.stripe_customer_id;

    if (!isp.stripe_subscription_id) {
      return new Response(
        JSON.stringify({
          subscription: null,
          stripe_customer_id: customerId,
          stripe_billing_source: isp.stripe_billing_source ?? null,
          isp_id: isp.isp_id,
        }),
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
        stripe_customer_id: customerId,
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
