// asaas-plan-change/index.ts
// Seleciona ou altera o plano principal de um ISP gerenciado pelo Asaas.
//
// O catálogo de produtos (nome, preço) vem do Stripe — fonte de verdade centralizada.
// A cobrança e a assinatura são gerenciadas pelo Asaas.
//
// Auth: Bearer JWT obrigatório
// Input: { stripe_product_id, stripe_price_id, target_isp_id? (super_admin) }
//
// Regras de negócio:
//   - Apenas ISPs com stripe_billing_source='asaas' podem usar esta função
//   - Cada ISP tem no máximo UMA assinatura ativa no Asaas
//   - Se já existe: PUT /subscriptions/{id} com valor + descrição + updatePendingPayments=true
//   - Se não existe: POST /subscriptions com billingType=BOLETO, nextDueDate=1º do próximo mês
//   - Stripe key: STRIPE_SECRET_KEY (live) para ISPs Asaas reais
//   - Sandbox (uniforce) usa chaves _TEST — mas uniforce é Stripe-managed na prática
//
// Audit trail: tabela asaas_plan_change_requests

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const ASAAS_BASE_URL = "https://www.asaas.com";
const ASAAS_SANDBOX_URL = "https://sandbox.asaas.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function nextMonthFirstDay(): string {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return next.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ─── Ler body ─────────────────────────────────────────────────────────────
  let body: { stripe_product_id?: string; stripe_price_id?: string; target_isp_id?: string } = {};
  try { body = await req.json(); } catch { /* ok */ }

  const { stripe_product_id, stripe_price_id } = body;

  if (!stripe_product_id || !stripe_price_id) {
    return new Response(
      JSON.stringify({ error: "stripe_product_id e stripe_price_id são obrigatórios" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: authHeader } },
  });
  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

  // ─── 1. Verificar identidade via SECURITY DEFINER ────────────────────────
  const { data: ownData } = await supabaseUser.rpc("get_isp_asaas_data");
  const ownIsp = ownData?.[0] ?? null;
  const ownIspId: string | null = ownIsp?.isp_id ?? null;

  if (!ownIspId) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ─── 2. Resolver ISP alvo ─────────────────────────────────────────────────
  const targetIspId: string = body.target_isp_id ?? ownIspId;

  if (targetIspId !== ownIspId && ownIspId !== "uniforce") {
    return new Response(
      JSON.stringify({ error: "Forbidden" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ─── 3. Buscar ISP no banco ───────────────────────────────────────────────
  // Always fetch fresh from admin to get cnpj (get_isp_asaas_data does not include it)
  const { data: freshIsp } = await supabaseAdmin
    .from("isps")
    .select("isp_id, isp_nome, asaas_customer_id, asaas_test_customer_id, stripe_billing_source, cnpj")
    .eq("isp_id", targetIspId)
    .maybeSingle();

  if (!freshIsp) {
    return new Response(
      JSON.stringify({ error: "ISP não encontrado" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const isp: any = freshIsp;

  // ─── 4. Verificar que o ISP é gerenciado pelo Asaas ──────────────────────
  if (isp.stripe_billing_source !== "asaas") {
    return new Response(
      JSON.stringify({ error: "Esta função é exclusiva para ISPs gerenciados pelo Asaas." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ─── 5. Configurar ambiente Asaas ─────────────────────────────────────────
  const isSandbox = targetIspId === "uniforce";
  const asaasKey = isSandbox
    ? (Deno.env.get("ASAAS_TEST_API_KEY") ?? "")
    : (Deno.env.get("ASAAS_API_KEY") ?? "");
  const baseUrl = isSandbox ? ASAAS_SANDBOX_URL : ASAAS_BASE_URL;
  const customerId = isSandbox ? isp.asaas_test_customer_id : isp.asaas_customer_id;

  if (!customerId) {
    return new Response(
      JSON.stringify({ error: "ISP sem customer_id Asaas. Execute asaas-customer-sync primeiro." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!asaasKey) {
    return new Response(
      JSON.stringify({ error: "Asaas API key não configurada" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ─── 6. Buscar produto/preço no Stripe (fonte de verdade) ────────────────
  // ISPs Asaas são produção → sempre usar STRIPE_SECRET_KEY (live)
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  if (!stripeKey) {
    return new Response(
      JSON.stringify({ error: "Stripe API key não configurada" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const stripe = new Stripe(stripeKey, {
    apiVersion: "2024-06-20",
    httpClient: Stripe.createFetchHttpClient(),
  });

  let planName: string;
  let planValue: number;

  try {
    const [product, price] = await Promise.all([
      stripe.products.retrieve(stripe_product_id),
      stripe.prices.retrieve(stripe_price_id),
    ]);

    if (!product.active) {
      return new Response(
        JSON.stringify({ error: "Produto inativo no Stripe" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    planName = product.name;
    planValue = (price.unit_amount ?? 0) / 100;

    if (planValue <= 0) {
      return new Response(
        JSON.stringify({ error: "Preço inválido no Stripe" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    console.error("asaas-plan-change: Stripe lookup failed:", err);
    return new Response(
      JSON.stringify({ error: "Produto ou preço não encontrado no Stripe" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const asaasHeaders = { "Content-Type": "application/json", "access_token": asaasKey };

  // ─── 7. Buscar assinatura ativa no Asaas ─────────────────────────────────
  let existingSubId: string | null = null;
  let existingBillingType: string = "BOLETO";

  try {
    const subRes = await fetch(
      `${baseUrl}/api/v3/subscriptions?customer=${customerId}&status=ACTIVE`,
      { headers: asaasHeaders }
    );
    if (subRes.ok) {
      const subData = await subRes.json();
      const items: any[] = subData.data ?? [];
      if (items.length > 0) {
        existingSubId = items[0].id;
        existingBillingType = items[0].billingType ?? "BOLETO";
        if (items.length > 1) {
          console.warn(`asaas-plan-change: ISP ${targetIspId} has ${items.length} active subscriptions — using first`);
        }
      }
    }
  } catch (err) {
    console.warn("asaas-plan-change: failed to check existing subscriptions:", err);
  }

  let action: "updated" | "created";
  let resultSubId: string;
  let resultSub: any;

  if (existingSubId) {
    // ─── 8a. Atualizar assinatura existente ─────────────────────────────────
    const updateRes = await fetch(`${baseUrl}/api/v3/subscriptions/${existingSubId}`, {
      method: "PUT",
      headers: asaasHeaders,
      body: JSON.stringify({
        value: planValue,
        description: planName,
        updatePendingPayments: true,
      }),
    });

    const updateBody = await updateRes.json();

    if (!updateRes.ok) {
      console.error("asaas-plan-change: update failed:", updateBody);
      await supabaseAdmin.from("asaas_plan_change_requests").insert({
        isp_id: targetIspId,
        stripe_product_id,
        stripe_price_id,
        plan_name: planName,
        plan_value: planValue,
        asaas_subscription_id: existingSubId,
        action: "updated",
        status: "failed",
        error_message: JSON.stringify(updateBody),
        completed_at: new Date().toISOString(),
      });
      return new Response(
        JSON.stringify({ error: "Falha ao atualizar assinatura Asaas", details: updateBody }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    action = "updated";
    resultSubId = existingSubId;
    resultSub = updateBody;
    console.log(`asaas-plan-change: updated sub ${resultSubId} ISP ${targetIspId} → "${planName}" R$${planValue}`);

  } else {
    // ─── 8b. Criar nova assinatura ──────────────────────────────────────────
    // Asaas exige CPF/CNPJ no cliente para criar assinatura.
    // Se o ISP tem cnpj no banco mas o cliente Asaas não tem → PATCH primeiro.
    const ispCnpj: string | null = isp.cnpj ?? null;

    if (!ispCnpj) {
      return new Response(
        JSON.stringify({
          error: "CPF/CNPJ obrigatório para criar assinatura no Asaas. Configure o CNPJ do ISP no sistema antes de selecionar um plano.",
          hint: "Entre em contato com o suporte Uniforce para cadastrar o CNPJ.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Garantir que o cliente Asaas tem CNPJ (PATCH se necessário)
    try {
      const custRes = await fetch(`${baseUrl}/api/v3/customers/${customerId}`, {
        headers: asaasHeaders,
      });
      if (custRes.ok) {
        const custData = await custRes.json();
        if (!custData.cpfCnpj) {
          const patchRes = await fetch(`${baseUrl}/api/v3/customers/${customerId}`, {
            method: "PUT",
            headers: asaasHeaders,
            body: JSON.stringify({ cpfCnpj: ispCnpj }),
          });
          if (!patchRes.ok) {
            const patchBody = await patchRes.json().catch(() => ({}));
            console.warn("asaas-plan-change: customer CNPJ patch failed:", patchBody);
          }
          console.log(`asaas-plan-change: patched customer ${customerId} with CNPJ for ISP ${targetIspId}`);
        }
      }
    } catch (err) {
      console.warn("asaas-plan-change: failed to patch customer CNPJ:", err);
    }

    const createRes = await fetch(`${baseUrl}/api/v3/subscriptions`, {
      method: "POST",
      headers: asaasHeaders,
      body: JSON.stringify({
        customer: customerId,
        billingType: "BOLETO",
        value: planValue,
        nextDueDate: nextMonthFirstDay(),
        cycle: "MONTHLY",
        description: planName,
      }),
    });

    const createBody = await createRes.json();

    if (!createRes.ok) {
      console.error("asaas-plan-change: create failed:", createBody);
      await supabaseAdmin.from("asaas_plan_change_requests").insert({
        isp_id: targetIspId,
        stripe_product_id,
        stripe_price_id,
        plan_name: planName,
        plan_value: planValue,
        action: "created",
        status: "failed",
        error_message: JSON.stringify(createBody),
        completed_at: new Date().toISOString(),
      });
      return new Response(
        JSON.stringify({ error: "Falha ao criar assinatura Asaas", details: createBody }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    action = "created";
    resultSubId = createBody.id;
    resultSub = createBody;
    existingBillingType = "BOLETO";
    console.log(`asaas-plan-change: created sub ${resultSubId} ISP ${targetIspId} → "${planName}" R$${planValue}`);
  }

  // ─── 9. Audit trail ──────────────────────────────────────────────────────
  await supabaseAdmin.from("asaas_plan_change_requests").insert({
    isp_id: targetIspId,
    stripe_product_id,
    stripe_price_id,
    plan_name: planName,
    plan_value: planValue,
    asaas_subscription_id: resultSubId,
    action,
    status: "completed",
    completed_at: new Date().toISOString(),
  });

  // ─── 10. Registrar/atualizar em isp_subscription_items ───────────────────
  {
    const isCreating = action === "created";
    await supabaseAdmin.from("isp_subscription_items").upsert({
      isp_id: targetIspId,
      stripe_subscription_id: resultSubId,   // ID da subscription Asaas
      product_id: stripe_product_id,          // Stripe product ID (fonte de verdade de produtos)
      product_name: planName,
      product_type: "plan",
      billing_source: "asaas",
      status: "active",
      ...(isCreating ? { started_at: new Date().toISOString() } : {}),
      monthly_amount: planValue,
      currency: "BRL",
      is_test_mode: isSandbox,
      updated_at: new Date().toISOString(),
    }, { onConflict: "stripe_subscription_id,product_id" });

    // Setar subscription_started_at no ISP se for primeira assinatura Asaas
    if (isCreating) {
      await supabaseAdmin.from("isps")
        .update({ subscription_started_at: new Date().toISOString() })
        .eq("isp_id", targetIspId)
        .is("subscription_started_at", null);
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      action,
      plan_name: planName,
      plan_value: planValue,
      subscription: {
        id: resultSubId,
        status: resultSub.status ?? "ACTIVE",
        value: resultSub.value ?? planValue,
        next_due_date: resultSub.nextDueDate ?? null,
        billing_type: resultSub.billingType ?? existingBillingType,
        description: resultSub.description ?? planName,
        cycle: resultSub.cycle ?? "MONTHLY",
      },
      isp_id: targetIspId,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
