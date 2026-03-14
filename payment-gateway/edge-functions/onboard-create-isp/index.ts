// edge-functions/onboard-create-isp/index.ts
// Cria um novo ISP durante o onboarding de auto-cadastro
// Requer: JWT do usuário autenticado
//
// Body: { isp_nome, cnpj, instancia_isp, erp_base_url, erp_api_key, erp_api_token? }
// Returns: { isp_id, isp_nome } — então frontend chama stripe-checkout para pagamento

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader  = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado." }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Verificar identidade do usuário
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Token inválido." }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(supabaseUrl, serviceKey);

    // Verificar se usuário já tem ISP associado
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("isp_id")
      .eq("id", user.id)
      .single();

    if (profile?.isp_id) {
      return new Response(JSON.stringify({ error: "Usuário já possui um ISP associado." }), {
        status: 409, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const { isp_nome, cnpj, instancia_isp, erp_base_url, erp_api_key, erp_api_token, sandbox_mode } = await req.json();

    // Validações básicas
    if (!isp_nome?.trim() || !instancia_isp || !erp_base_url?.trim() || !erp_api_key?.trim()) {
      return new Response(
        JSON.stringify({ error: "isp_nome, instancia_isp, erp_base_url e erp_api_key são obrigatórios." }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // Chamar função SECURITY DEFINER para criar ISP + vincular perfil
    const { data, error } = await serviceClient.rpc("create_isp_onboarding", {
      p_isp_nome:        isp_nome.trim(),
      p_cnpj:            cnpj?.trim() ?? "",
      p_instancia_isp:   instancia_isp,
      p_erp_base_url:    erp_base_url.trim().replace(/\/+$/, ""),
      p_erp_credentials: {
        api_key:   erp_api_key.trim(),
        api_token: erp_api_token?.trim() ?? erp_api_key.trim(),
      },
      p_user_id: user.id,
    });

    if (error) {
      console.error("create_isp_onboarding error:", error);
      return new Response(
        JSON.stringify({ error: "Erro ao criar ISP. Tente novamente.", detail: error.message }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const row = Array.isArray(data) ? data[0] : data;

    // Se onboarding sandbox, marcar ISP para usar Stripe test mode
    if (sandbox_mode === true) {
      await serviceClient
        .from("isps")
        .update({ stripe_test_mode_enabled: true })
        .eq("isp_id", row.isp_id);
    }

    // Criar lead no Notion CRM (await garante execução antes do isolate encerrar)
    try {
      await fetch(`${supabaseUrl}/functions/v1/notion-sync`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "create_lead", isp_id: row.isp_id }),
      });
    } catch (err) {
      console.error("notion-sync create_lead error (non-blocking):", err);
    }

    return new Response(JSON.stringify({ isp_id: row.isp_id, isp_nome: row.isp_nome }), {
      status: 200, headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("onboard-create-isp error:", err);
    return new Response(JSON.stringify({ error: "Erro interno do servidor.", detail: String(err) }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
