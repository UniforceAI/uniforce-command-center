// stripe-checkout/index.ts
// Cria sessão de Stripe Checkout
// target_isp_id: checkout sempre para o ISP alvo (super_admin deve usar ISP próprio para testes)
// Test mode: automático quando isp_id='uniforce'

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

    const { price_id, success_url, cancel_url, target_isp_id } = await req.json();
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

    // Resolver ISP alvo
    const { data: ownData } = await supabase.rpc("get_isp_stripe_data");
    const ownIsp = ownData?.[0];
    if (!ownIsp) {
      return new Response(JSON.stringify({ error: "ISP não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let isp = ownIsp;
    // Se target_isp_id diferente do próprio, verificar super_admin via supabaseAdmin (bypass RLS)
    if (target_isp_id && target_isp_id !== ownIsp.isp_id) {
      const userId = getUserIdFromJWT(authHeader);
      const { data: profile } = await supabaseAdmin
        .from("profiles").select("role").eq("id", userId ?? "").maybeSingle();
      if (profile?.role !== "super_admin") {
        return new Response(
          JSON.stringify({ error: "Checkout deve ser realizado pelo administrador do ISP." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Super_admin fazendo checkout para outro ISP (ex: ativação manual)
      const { data: targetIspRow } = await supabaseAdmin
        .from("isps")
        .select("isp_id,isp_nome,stripe_customer_id,stripe_test_customer_id,stripe_subscription_id,stripe_subscription_status,stripe_billing_source")
        .eq("isp_id", target_isp_id)
        .single();
      if (!targetIspRow) {
        return new Response(JSON.stringify({ error: "ISP alvo não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      isp = targetIspRow;
    }

    const { data: ispInfo } = await supabase
      .from("isps")
      .select("isp_nome")
      .eq("isp_id", isp.isp_id)
      .single();

    const isTestMode = TEST_MODE_ISP_IDS.includes(isp.isp_id);
    const stripeKey = isTestMode
      ? Deno.env.get("STRIPE_TEST_SECRET_KEY")!
      : Deno.env.get("STRIPE_SECRET_KEY")!;

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2024-06-20",
      httpClient: Stripe.createFetchHttpClient(),
    });

    let customerId = isTestMode ? isp.stripe_test_customer_id : isp.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: ispInfo?.isp_nome ?? isp.isp_id,
        metadata: { isp_id: isp.isp_id, supabase_user_id: user.id },
      });
      customerId = customer.id;
      const col = isTestMode ? "stripe_test_customer_id" : "stripe_customer_id";
      await supabaseAdmin.from("isps").update({ [col]: customerId }).eq("isp_id", isp.isp_id);
    }

    // Bloquear checkout se já tem assinatura ativa (live mode)
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
