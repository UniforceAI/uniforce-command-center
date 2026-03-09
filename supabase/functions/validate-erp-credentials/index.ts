// edge-functions/validate-erp-credentials/index.ts
// Valida credenciais de API ERP (IXC Provedor ou ISPBox)
// chamado durante o onboarding, Step 2
//
// Body: { erp_type: "ixc" | "ispbox", base_url: string, api_key: string, api_token?: string }
// Returns: { valid: boolean, message: string, erp_version?: string }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { erp_type, base_url, api_key, api_token } = await req.json();

    if (!erp_type || !base_url || !api_key) {
      return new Response(
        JSON.stringify({ valid: false, message: "erp_type, base_url e api_key são obrigatórios." }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // Normalizar URL
    const cleanUrl = base_url.replace(/\/+$/, "");

    let valid = false;
    let message = "";
    let erp_version: string | undefined;
    let client_count: number | null = null;

    if (erp_type === "ixc") {
      // IXC Provedor: autenticação via Basic Auth (token:api_key)
      // Testa endpoint de leitura de clientes
      const token = api_token ?? api_key; // IXC usa token como senha no Basic Auth
      const basicAuth = btoa(`${api_key}:${token}`);

      try {
        const res = await fetch(`${cleanUrl}/webservice/v1/mk_cidades?rp=1`, {
          headers: {
            Authorization: `Basic ${basicAuth}`,
            "ixcsoft": "listar",
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(10000),
        });

        if (res.ok || res.status === 200) {
          valid = true;
          message = "Credenciais IXC Provedor validadas com sucesso.";
          erp_version = "ixc";

          // Buscar contagem de clientes ativos (opcional — não bloqueia se falhar)
          try {
            const countRes = await fetch(
              `${cleanUrl}/webservice/v1/cliente?rp=1&pesquisa=${encodeURIComponent(JSON.stringify({ ativo: "1" }))}`,
              {
                headers: {
                  Authorization: `Basic ${basicAuth}`,
                  "ixcsoft": "listar",
                  "Content-Type": "application/json",
                },
                signal: AbortSignal.timeout(8000),
              }
            );
            if (countRes.ok) {
              const countData = await countRes.json();
              client_count = countData?.total ?? countData?.registros ?? null;
              if (typeof client_count === "string") client_count = parseInt(client_count, 10) || null;
            }
          } catch { /* opcional — silenciar falha */ }

        } else if (res.status === 401 || res.status === 403) {
          valid = false;
          message = "Credenciais inválidas. Verifique o token e a chave de API do IXC.";
        } else {
          valid = false;
          message = `Servidor IXC respondeu com status ${res.status}. Verifique a URL base.`;
        }
      } catch (err) {
        valid = false;
        message = `Não foi possível conectar ao servidor IXC. Verifique a URL base e a conectividade.`;
      }

    } else if (erp_type === "ispbox") {
      // ISPBox: autenticação via token no header
      try {
        const res = await fetch(`${cleanUrl}/api/clientes?per_page=1`, {
          headers: {
            Authorization: `Bearer ${api_key}`,
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(10000),
        });

        if (res.ok || res.status === 200) {
          valid = true;
          message = "Credenciais ISPBox validadas com sucesso.";
          erp_version = "ispbox";
        } else if (res.status === 401 || res.status === 403) {
          valid = false;
          message = "Token ISPBox inválido. Verifique o token de API.";
        } else {
          valid = false;
          message = `Servidor ISPBox respondeu com status ${res.status}. Verifique a URL base.`;
        }
      } catch (err) {
        valid = false;
        message = `Não foi possível conectar ao servidor ISPBox. Verifique a URL base.`;
      }

    } else {
      return new Response(
        JSON.stringify({ valid: false, message: `ERP type "${erp_type}" não suportado. Use "ixc" ou "ispbox".` }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ valid, message, erp_version, client_count }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ valid: false, message: "Erro interno ao validar credenciais.", error: String(err) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
