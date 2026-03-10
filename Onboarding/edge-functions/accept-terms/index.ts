// edge-functions/accept-terms/index.ts
// Registra aceite de Termos de Serviço pelo usuário logado
//
// Auth: JWT obrigatório
// Body: { tos_version: string }
// Returns: { success: true }
// Deploy: npx supabase functions deploy accept-terms --project-ref yqdqmudsnjhixtxldqwi

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

    // Verificar identidade do usuário via JWT
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Token inválido." }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const { tos_version } = await req.json();
    if (!tos_version) {
      return new Response(JSON.stringify({ error: "tos_version é obrigatório." }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(supabaseUrl, serviceKey);

    // Obter isp_id do perfil do usuário
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("isp_id")
      .eq("id", user.id)
      .single();

    if (!profile?.isp_id) {
      return new Response(JSON.stringify({ error: "ISP não encontrado para este usuário." }), {
        status: 404, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Extrair IP do cliente (opcional, para audit trail)
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? req.headers.get("x-real-ip")
      ?? null;

    // Registrar aceite via SECURITY DEFINER function
    const { error: rpcErr } = await serviceClient.rpc("record_tos_acceptance", {
      p_user_id:     user.id,
      p_isp_id:      profile.isp_id,
      p_tos_version: tos_version,
      p_ip_address:  ipAddress,
    });

    if (rpcErr) {
      console.error("record_tos_acceptance error:", rpcErr);
      return new Response(JSON.stringify({ error: "Erro ao registrar aceite.", detail: rpcErr.message }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("accept-terms error:", err);
    return new Response(JSON.stringify({ error: "Erro interno do servidor.", detail: String(err) }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
