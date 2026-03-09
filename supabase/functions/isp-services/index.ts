// isp-services/index.ts
// Retorna todos os produtos contratados do ISP com dados de compromisso calculados.
//
// Auth: Bearer JWT obrigatório
// Input: POST { target_isp_id? }
// Output: { isp_id, billing_source, subscription_started_at, last_agent_change_at,
//           next_agent_change_allowed_at, plan, addons }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export interface ContractedItem {
  id: string;
  stripe_subscription_id: string;
  product_id: string;
  product_name: string;
  product_type: "plan" | "addon";
  billing_source: "stripe" | "asaas";
  status: "active" | "cancel_scheduled" | "canceled";
  started_at: string;
  commitment_ends_at: string;
  cancel_at: string | null;
  monthly_amount: number;
  currency: string;
  days_until_commitment_free: number; // negativo = já passou; positivo = dias restantes
}

export interface IspServicesData {
  isp_id: string;
  billing_source: "stripe" | "asaas" | null;
  subscription_started_at: string | null;
  last_agent_change_at: string | null;
  next_agent_change_allowed_at: string | null;
  plan: ContractedItem | null;
  addons: ContractedItem[];
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

    let body: { target_isp_id?: string } = {};
    try { body = await req.json(); } catch { /* ok */ }

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

    // ─── 2. Resolver ISP alvo ─────────────────────────────────────────────────
    const targetIspId = body.target_isp_id ?? ownIspId;
    if (targetIspId !== ownIspId && ownIspId !== "uniforce") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Se target_isp_id foi fornecido e diferente, buscar meta do ISP alvo via admin
    let effectiveMeta = meta;
    if (targetIspId !== ownIspId) {
      const { data: targetRows } = await supabaseAdmin.rpc("get_isp_service_meta");
      // get_isp_service_meta usa current_user_isp_id() — para super_admin, buscar direto
      const { data: targetIsp } = await supabaseAdmin
        .from("isps")
        .select("isp_id, subscription_started_at, last_agent_change_at, stripe_billing_source")
        .eq("isp_id", targetIspId)
        .single();
      effectiveMeta = targetIsp ?? meta;
    }

    // ─── 3. Buscar itens contratados ──────────────────────────────────────────
    const { data: items, error: itemsErr } = await supabaseAdmin
      .from("isp_subscription_items")
      .select("*")
      .eq("isp_id", targetIspId)
      .in("status", ["active", "cancel_scheduled"]);

    if (itemsErr) {
      console.error("isp-services: error fetching items:", itemsErr);
      return new Response(JSON.stringify({ error: "Erro ao buscar itens" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = Date.now();

    // ─── 4. Transformar items ─────────────────────────────────────────────────
    const contractedItems: ContractedItem[] = (items ?? []).map((item: any) => {
      const commitmentEndsAt = new Date(item.commitment_ends_at).getTime();
      const daysUntilFree = Math.ceil((commitmentEndsAt - now) / 86400000);
      return {
        id: item.id,
        stripe_subscription_id: item.stripe_subscription_id,
        product_id: item.product_id,
        product_name: item.product_name,
        product_type: item.product_type,
        billing_source: item.billing_source,
        status: item.status,
        started_at: item.started_at,
        commitment_ends_at: item.commitment_ends_at,
        cancel_at: item.cancel_at ?? null,
        monthly_amount: item.monthly_amount ?? 0,
        currency: item.currency ?? "BRL",
        days_until_commitment_free: daysUntilFree,
      };
    });

    const plan = contractedItems.find((i) => i.product_type === "plan") ?? null;
    const addons = contractedItems.filter((i) => i.product_type === "addon");

    // ─── 5. next_agent_change_allowed_at ─────────────────────────────────────
    let nextAgentChangeAllowedAt: string | null = null;
    if (effectiveMeta?.last_agent_change_at) {
      const d = new Date(effectiveMeta.last_agent_change_at);
      d.setMonth(d.getMonth() + 3);
      nextAgentChangeAllowedAt = d.toISOString();
    }

    const response: IspServicesData = {
      isp_id: targetIspId,
      billing_source: (effectiveMeta?.stripe_billing_source as "stripe" | "asaas" | null) ?? null,
      subscription_started_at: effectiveMeta?.subscription_started_at ?? null,
      last_agent_change_at: effectiveMeta?.last_agent_change_at ?? null,
      next_agent_change_allowed_at: nextAgentChangeAllowedAt,
      plan,
      addons,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("isp-services error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
