// asaas-subscription/index.ts
// Retorna a assinatura ativa Asaas do ISP autenticado (ou de um ISP alvo para super_admin).
//
// Auth: Bearer JWT obrigatório
// Padrão: get_isp_asaas_data() SECURITY DEFINER + check isp_id='uniforce' para super_admin
// Sandbox (isp_id = 'uniforce') usa ASAAS_TEST_API_KEY; demais usam ASAAS_API_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const ASAAS_BASE_URL = "https://www.asaas.com";
const ASAAS_SANDBOX_URL = "https://sandbox.asaas.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Faixas de preço dos planos Stripe live (em BRL) para detectar plano customizado.
// Plano customizado = valor não corresponde a nenhum plano catalogado (tolerância ±10%).
// Atualizar sempre que novos planos forem adicionados no Stripe Dashboard.
// Planos live atuais: Retention R$797 | Growth R$1597 | I.A. R$2497
const STRIPE_PLAN_AMOUNTS = [797, 1597, 2497];

function isCustomPlan(value: number): boolean {
  return !STRIPE_PLAN_AMOUNTS.some(
    (planAmount) => Math.abs(value - planAmount) / planAmount <= 0.10
  );
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

  let targetIspId: string | null = null;
  try { targetIspId = (await req.clone().json())?.target_isp_id ?? null; } catch { /* ok */ }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

  // Obter ISP do usuário autenticado via SECURITY DEFINER
  const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: authHeader } },
  });
  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

  const { data: ownData } = await supabaseUser.rpc("get_isp_asaas_data");
  const ownIsp = ownData?.[0] ?? null;
  const ownIspId: string | null = ownIsp?.isp_id ?? null;

  if (!ownIspId) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Authorization for super_admin targeting another ISP
  if (targetIspId && targetIspId !== ownIspId) {
    if (ownIspId !== "uniforce") {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  const effectiveIspId: string = targetIspId ?? ownIspId;

  // Always fetch full ISP data via admin (includes cnpj — needed for setup_pending)
  const { data: ispData } = await supabaseAdmin
    .from("isps")
    .select("isp_id, asaas_customer_id, asaas_test_customer_id, stripe_billing_source, cnpj")
    .eq("isp_id", effectiveIspId)
    .maybeSingle();

  if (!ispData) {
    return new Response(
      JSON.stringify({ subscription: null, is_custom_plan: false, setup_pending: false }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const isSandbox = effectiveIspId === "uniforce";
  const customerId: string | null = isSandbox
    ? (ispData.asaas_test_customer_id ?? null)
    : (ispData.asaas_customer_id ?? null);

  const asaasKey = isSandbox
    ? (Deno.env.get("ASAAS_TEST_API_KEY") ?? "")
    : (Deno.env.get("ASAAS_API_KEY") ?? "");
  const baseUrl = isSandbox ? ASAAS_SANDBOX_URL : ASAAS_BASE_URL;
  const asaasHeaders = { "Content-Type": "application/json", "access_token": asaasKey };

  let subscription = null;

  if (customerId) {
    // Buscar subscription ativa
    try {
      const subRes = await fetch(
        `${baseUrl}/api/v3/subscriptions?customer=${customerId}&status=ACTIVE`,
        { headers: asaasHeaders }
      );
      if (subRes.ok) {
        const subData = await subRes.json();
        const items: any[] = subData.data ?? [];
        if (items.length > 0) {
          const s = items[0];
          subscription = {
            id: s.id,
            status: s.status,
            value: s.value,
            next_due_date: s.nextDueDate ?? null,
            billing_type: s.billingType,
            description: s.description ?? null,
            cycle: s.cycle ?? "MONTHLY",
          };
        }
      }
    } catch (err) {
      console.warn("asaas-subscription: failed to fetch subscriptions:", err);
    }

    // Fallback: último pagamento recebido (para ISPs sem subscription automática)
    if (!subscription) {
      try {
        const payRes = await fetch(
          `${baseUrl}/api/v3/payments?customer=${customerId}&status=RECEIVED&limit=1`,
          { headers: asaasHeaders }
        );
        if (payRes.ok) {
          const payData = await payRes.json();
          const payments: any[] = payData.data ?? [];
          if (payments.length > 0) {
            const p = payments[0];
            subscription = {
              id: p.id,
              status: "RECEIVED",
              value: p.value,
              next_due_date: null,
              billing_type: p.billingType,
              description: p.description ?? null,
              cycle: null,
            };
          }
        }
      } catch (err) {
        console.warn("asaas-subscription: failed to fetch fallback payment:", err);
      }
    }
  }

  const customPlan = subscription ? isCustomPlan(subscription.value) : false;

  const hasCnpj = !!(ispData.cnpj);
  // setup_pending = true when ISP can't create first subscription:
  // no customer ID registered, or customer exists but no CNPJ and no active subscription
  const setupPending = !customerId || (!hasCnpj && !subscription);

  return new Response(
    JSON.stringify({ subscription, is_custom_plan: customPlan, setup_pending: setupPending }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
