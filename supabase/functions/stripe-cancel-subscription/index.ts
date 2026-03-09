// stripe-cancel-subscription/index.ts
// Cancela uma subscription Stripe, respeitando o período de compromisso de 3 meses.
//
// Auth: Bearer JWT obrigatório
// Input: POST { stripe_subscription_id, target_isp_id? }
// Output: { success, effective_cancel_at, is_immediate, product_name }

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let body: { stripe_subscription_id?: string; target_isp_id?: string } = {};
    try { body = await req.json(); } catch { /* ok */ }

    const { stripe_subscription_id, target_isp_id } = body;

    if (!stripe_subscription_id) {
      return new Response(JSON.stringify({ error: "stripe_subscription_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── 1. Identidade via SECURITY DEFINER ──────────────────────────────────
    const { data: metaRows } = await supabaseUser.rpc("get_isp_service_meta");
    const meta = metaRows?.[0] ?? null;
    const ownIspId: string | null = meta?.isp_id ?? null;

    if (!ownIspId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── 2. Autorização por ISP ───────────────────────────────────────────────
    const effectiveIspId = target_isp_id ?? ownIspId;
    if (effectiveIspId !== ownIspId && ownIspId !== "uniforce") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── 3. Verificar role do usuário ─────────────────────────────────────────
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    const userRole = roleRow?.role ?? null;
    if (userRole !== "admin" && userRole !== "super_admin") {
      return new Response(JSON.stringify({ error: "Apenas administradores podem cancelar assinaturas." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── 4. Buscar o item na tabela de controle ───────────────────────────────
    const { data: item, error: itemErr } = await supabaseAdmin
      .from("isp_subscription_items")
      .select("*")
      .eq("stripe_subscription_id", stripe_subscription_id)
      .eq("isp_id", effectiveIspId)
      .neq("status", "canceled")
      .maybeSingle();

    if (itemErr || !item) {
      return new Response(JSON.stringify({ error: "Assinatura não encontrada ou já cancelada." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── 5. Calcular data efetiva de cancelamento ─────────────────────────────
    const commitmentEndsAt = new Date(item.commitment_ends_at).getTime();
    const now = Date.now();
    const effectiveCancelAt = Math.max(commitmentEndsAt, now);
    const isImmediate = effectiveCancelAt <= now + 60000; // margem de 1 min

    // ─── 6. Configurar Stripe ─────────────────────────────────────────────────
    const stripeKey = item.is_test_mode
      ? (Deno.env.get("STRIPE_TEST_SECRET_KEY") ?? "")
      : (Deno.env.get("STRIPE_SECRET_KEY") ?? "");

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2024-06-20",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // ─── 7. Cancelar no Stripe ────────────────────────────────────────────────
    let effectiveCancelDate: string;

    if (isImmediate) {
      // Comprometimento já cumprido → cancelar ao final do período atual
      await stripe.subscriptions.update(stripe_subscription_id, {
        cancel_at_period_end: true,
      });
      // A data efetiva vem do período atual no Stripe
      const sub = await stripe.subscriptions.retrieve(stripe_subscription_id);
      const periodEnd = (sub as any).current_period_end ?? null;
      effectiveCancelDate = periodEnd
        ? new Date(periodEnd * 1000).toISOString()
        : new Date(now).toISOString();
    } else {
      // Ainda no período de compromisso → agendar para commitment_ends_at
      await stripe.subscriptions.update(stripe_subscription_id, {
        cancel_at: Math.floor(effectiveCancelAt / 1000),
      });
      effectiveCancelDate = new Date(effectiveCancelAt).toISOString();
    }

    // ─── 8. Atualizar isp_subscription_items ─────────────────────────────────
    await supabaseAdmin.from("isp_subscription_items")
      .update({
        status: "cancel_scheduled",
        cancel_at: effectiveCancelDate,
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_subscription_id", stripe_subscription_id);

    return new Response(
      JSON.stringify({
        success: true,
        effective_cancel_at: effectiveCancelDate,
        is_immediate: isImmediate,
        product_name: item.product_name,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("stripe-cancel-subscription error:", err);
    return new Response(JSON.stringify({ error: "Erro ao cancelar assinatura" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
