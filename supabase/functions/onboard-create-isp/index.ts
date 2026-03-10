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

    const {
      isp_nome, cnpj, instancia_isp, erp_base_url, erp_api_key, erp_api_token,
      ip_blocking_requested, contract_accepted_at,
    } = await req.json();

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
        JSON.stringify({ error: "Erro ao criar ISP. Tente novamente." }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const row = Array.isArray(data) ? data[0] : data;

    // Atualizar campos extras (não faz parte da função SECURITY DEFINER)
    const extraUpdate: Record<string, unknown> = {};
    if (ip_blocking_requested === true) extraUpdate.ip_blocking_requested = true;
    if (contract_accepted_at) extraUpdate.contract_accepted_at = contract_accepted_at;

    if (Object.keys(extraUpdate).length > 0) {
      await serviceClient.from("isps").update(extraUpdate).eq("isp_id", row.isp_id);
    }

    // Enviar email de IP blocking se solicitado
    if (ip_blocking_requested === true) {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        const adminEmail = user.email ?? "";
        const adminName = user.user_metadata?.full_name ?? "Administrador";
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Uniforce <suporte@uniforce.com.br>",
              to: [adminEmail],
              subject: "Libere o acesso da Uniforce no seu IXC 🔓",
              html: `
                <p>Olá ${adminName},</p>
                <p>Sua integração com a Uniforce está quase pronta! Identificamos que seu servidor IXC usa restrição de acesso por IP.</p>
                <p>Para que possamos importar seus dados com sucesso, você precisa liberar nosso servidor no firewall do IXC:</p>
                <ul>
                  <li><strong>📌 IPv4:</strong> 31.97.82.25</li>
                  <li><strong>📌 IPv6:</strong> 2a02:4780:14:ecfb::1</li>
                </ul>
                <p><strong>Como fazer:</strong></p>
                <ol>
                  <li>Acesse seu IXC → Configurações → Segurança → IPs Permitidos</li>
                  <li>Adicione os IPs acima</li>
                  <li>Salve e aguarde nossa confirmação por e-mail</li>
                </ol>
                <p>Precisa de ajuda? Entre em contato: <a href="mailto:suporte@uniforce.com.br">suporte@uniforce.com.br</a></p>
                <p>Equipe Uniforce</p>
              `,
            }),
          });
        } catch (emailErr) {
          console.warn("Falha ao enviar email de IP blocking:", emailErr);
          // Não bloquear o onboarding por falha de email
        }
      }
    }

    return new Response(JSON.stringify({ isp_id: row.isp_id, isp_nome: row.isp_nome }), {
      status: 200, headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("onboard-create-isp error:", err);
    return new Response(JSON.stringify({ error: "Erro interno do servidor." }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
