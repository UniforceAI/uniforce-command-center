// notion-sync/index.ts
// Integração Notion CRM — rastreamento automático de leads e clientes
//
// Ações suportadas (via body JSON):
//   create_lead       → Cria página em "Leads Uniforce" ao completar onboarding (passos 1+2)
//   graduate_to_client→ Cria página em "Clientes" + marca lead como "Concluído" após checkout
//
// Auth: requer service_role JWT (chamada interna entre edge functions)
//
// Secrets necessários no Supabase:
//   NOTION_API_KEY → ntn_... (token da integração interna Notion)
//
// Databases Notion (page IDs — usados na REST API):
//   Leads Uniforce: 202d9215-a80c-8028-99a4-e3af74d77787
//   Clientes:       229d9215-a80c-8017-b0d2-d9b597f4f314

import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const NOTION_API_BASE = "https://api.notion.com/v1";
const LEADS_DB    = "202d9215-a80c-8028-99a4-e3af74d77787";
const CLIENTES_DB = "229d9215-a80c-8017-b0d2-d9b597f4f314";

// Mapeamento por stripe_product_id (LIVE) → nome Notion
// IDs são estáveis; nomes de produto podem mudar no Stripe
const PRODUCT_ID_MAP: Record<string, string> = {
  "prod_U41i5VULCVGKRl": "Uniforce Retention",
  "prod_U41iUfju8I1C2n": "Uniforce AI",
  "prod_U41i4IUixqqdnT": "Uniforce Growth",
};

// Fallback por substring do nome (caso stripe_product_id não esteja preenchido)
const PRODUCT_NAME_FALLBACK: Record<string, string> = {
  Retention: "Uniforce Retention",
  AI:        "Uniforce AI",
  Growth:    "Uniforce Growth",
};

function notionHeaders(apiKey: string) {
  return {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28",
  };
}

// ─── Notion API helpers ───────────────────────────────────────────────────────

async function notionCreatePage(apiKey: string, databaseId: string, properties: Record<string, unknown>) {
  const res = await fetch(`${NOTION_API_BASE}/pages`, {
    method: "POST",
    headers: notionHeaders(apiKey),
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Notion createPage failed [${res.status}]: ${err}`);
  }

  return res.json() as Promise<{ id: string }>;
}

async function notionUpdatePage(apiKey: string, pageId: string, properties: Record<string, unknown>) {
  const res = await fetch(`${NOTION_API_BASE}/pages/${pageId}`, {
    method: "PATCH",
    headers: notionHeaders(apiKey),
    body: JSON.stringify({ properties }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Notion updatePage failed [${res.status}]: ${err}`);
  }

  return res.json();
}

async function notionQueryDatabase(
  apiKey: string,
  databaseId: string,
  filter: Record<string, unknown>
): Promise<{ results: Array<{ id: string }> }> {
  const res = await fetch(`${NOTION_API_BASE}/databases/${databaseId}/query`, {
    method: "POST",
    headers: notionHeaders(apiKey),
    body: JSON.stringify({ filter, page_size: 1 }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Notion queryDatabase failed [${res.status}]: ${err}`);
  }

  return res.json() as Promise<{ results: Array<{ id: string }> }>;
}

// ─── Notion property builders ─────────────────────────────────────────────────

function titleProp(value: string) {
  return { title: [{ text: { content: value || "" } }] };
}

function richTextProp(value: string) {
  return { rich_text: [{ text: { content: value || "" } }] };
}

function emailProp(value: string | null) {
  return value ? { email: value } : { email: null };
}

function selectProp(value: string) {
  return { select: { name: value } };
}

function statusProp(value: string) {
  return { status: { name: value } };
}

function dateProp(value: string | null) {
  return value ? { date: { start: value } } : { date: null };
}

function phoneProp(value: string | null) {
  return { phone_number: value || null };
}

// ─── JWT validation helper ────────────────────────────────────────────────────

function validateServiceRole(authHeader: string): boolean {
  try {
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    // base64url → base64 com padding correto (C-2)
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
    const payload = JSON.parse(atob(padded));
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

// ─── Action: create_lead ──────────────────────────────────────────────────────
// Chamado por onboard-create-isp após criar o ISP com sucesso

async function createLead(
  apiKey: string,
  supabaseAdmin: ReturnType<typeof createClient>,
  ispId: string
) {
  // Buscar dados do ISP + admin
  const { data: isp, error: ispErr } = await supabaseAdmin
    .from("isps")
    .select("isp_id, isp_nome, instancia_isp, notion_lead_page_id")
    .eq("isp_id", ispId)
    .single();

  if (ispErr || !isp) throw new Error(`ISP não encontrado: ${ispId}`);

  // Idempotência: se lead já foi criado, retornar page_id existente sem duplicar
  if (isp.notion_lead_page_id) {
    console.log(`notion-sync create_lead: ISP ${ispId} já tem lead ${isp.notion_lead_page_id} — skipping`);
    return { page_id: isp.notion_lead_page_id, skipped: true };
  }

  // Buscar usuário admin do ISP
  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("isp_id", ispId)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  let adminEmail: string | null = null;
  let adminName = "";
  let adminPhone: string | null = null;

  if (roleRow?.user_id) {
    const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(roleRow.user_id);
    adminEmail = user?.email ?? null;
    adminName  = ((user?.user_metadata?.full_name as string | undefined) ?? "").trim() || isp.isp_nome;
    adminPhone = ((user?.user_metadata?.phone as string | undefined) ?? "").trim() || null;
  } else {
    adminName = isp.isp_nome;
  }

  // M-4: ERP — se instancia_isp for nulo em ISP legado, não assumir "ixc"
  const erpValue = isp.instancia_isp || null;

  const properties: Record<string, unknown> = {
    "Nome":          titleProp(adminName),
    "Cliente":       richTextProp(isp.isp_nome),
    "Contact Email": emailProp(adminEmail),
    "Phone Number":  phoneProp(adminPhone),
    "Lead Source":   selectProp("Onboarding"),
    "Lead Status":   statusProp("Não iniciada"),
    "ISP ID":        richTextProp(isp.isp_id),
    ...(erpValue ? { "ERP": selectProp(erpValue) } : {}),
  };

  const page = await notionCreatePage(apiKey, LEADS_DB, properties);

  // Salvar page ID no DB para uso posterior na graduação
  await supabaseAdmin
    .from("isps")
    .update({ notion_lead_page_id: page.id })
    .eq("isp_id", ispId);

  console.log(`notion-sync create_lead: ISP ${ispId} → page ${page.id}`);
  return { page_id: page.id };
}

// ─── Action: graduate_to_client ───────────────────────────────────────────────
// Chamado por stripe-webhook em checkout.session.completed (apenas isLive=true)

async function graduateToClient(
  apiKey: string,
  supabaseAdmin: ReturnType<typeof createClient>,
  ispId: string
) {
  // Buscar dados completos do ISP
  const { data: isp, error: ispErr } = await supabaseAdmin
    .from("isps")
    .select(
      "isp_id, isp_nome, cnpj, instancia_isp, financial_email, " +
      "stripe_product_id, stripe_product_name, subscription_started_at, " +
      "notion_lead_page_id, notion_client_page_id"
    )
    .eq("isp_id", ispId)
    .single();

  if (ispErr || !isp) throw new Error(`ISP não encontrado: ${ispId}`);

  // M-1: Idempotência — se já existe página de cliente, não duplicar
  if (isp.notion_client_page_id) {
    console.log(`notion-sync graduate_to_client: ISP ${ispId} já tem cliente ${isp.notion_client_page_id} — skipping`);
    return { page_id: isp.notion_client_page_id, skipped: true };
  }

  // Buscar usuário admin
  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("isp_id", ispId)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  let adminEmail: string | null = null;
  // I-4: Mesmo fallback de create_lead (consistência)
  let adminName = isp.isp_nome;
  let adminPhone: string | null = null;

  if (roleRow?.user_id) {
    const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(roleRow.user_id);
    adminEmail = user?.email ?? null;
    adminName  = ((user?.user_metadata?.full_name as string | undefined) ?? "").trim() || isp.isp_nome;
    adminPhone = ((user?.user_metadata?.phone as string | undefined) ?? "").trim() || null;
  }

  // Mapear produto Stripe → opção Notion
  // Prioridade: stripe_product_id (estável) > stripe_product_name (fallback)
  let notionProduct = "Customizado";
  if (isp.stripe_product_id && PRODUCT_ID_MAP[isp.stripe_product_id]) {
    notionProduct = PRODUCT_ID_MAP[isp.stripe_product_id];
  } else {
    const rawName = isp.stripe_product_name ?? "";
    for (const [key, val] of Object.entries(PRODUCT_NAME_FALLBACK)) {
      if (rawName.includes(key)) { notionProduct = val; break; }
    }
    // B-4: Log quando produto não é mapeado (pode indicar novo produto sem cadastro)
    if (notionProduct === "Customizado" && (isp.stripe_product_id || isp.stripe_product_name)) {
      console.warn(
        `notion-sync: produto não mapeado: ${isp.stripe_product_id} ` +
        `(${isp.stripe_product_name}) — usando "Customizado". ` +
        `Adicionar ao PRODUCT_ID_MAP se necessário.`
      );
    }
  }

  // Data de assinatura: apenas a parte YYYY-MM-DD
  const dataAssinatura = isp.subscription_started_at
    ? isp.subscription_started_at.substring(0, 10)
    : null;

  // M-4: ERP — não assumir "ixc" para ISPs legados sem instancia_isp
  const erpValue = isp.instancia_isp || null;

  const clienteProperties: Record<string, unknown> = {
    "Representante Legal": titleProp(adminName),
    "Cliente":             richTextProp(isp.isp_nome),
    "CNPJ":                richTextProp(isp.cnpj || ""),
    "Contact Email":       emailProp(adminEmail),
    "Phone Number":        phoneProp(adminPhone),
    "Email Cobrança":      emailProp(isp.financial_email ?? null),
    "Produto":             selectProp(notionProduct),
    "Lead Source":         selectProp("Onboarding"),
    "Lead Status":         statusProp("Não iniciada"),
    "ISP ID":              richTextProp(isp.isp_id),
    "area":                richTextProp("SaaS"),
    ...(erpValue ? { "ERP": selectProp(erpValue) } : {}),
    "Data Assinatura":     dateProp(dataAssinatura),
  };

  // Criar página em Clientes
  const page = await notionCreatePage(apiKey, CLIENTES_DB, clienteProperties);
  console.log(`notion-sync graduate_to_client: ISP ${ispId} → Clientes page ${page.id}`);

  // M-1: Salvar page ID para idempotência futura
  await supabaseAdmin
    .from("isps")
    .update({ notion_client_page_id: page.id })
    .eq("isp_id", ispId);

  // Marcar lead como "Concluído" (se tiver o page ID salvo)
  if (isp.notion_lead_page_id) {
    try {
      await notionUpdatePage(apiKey, isp.notion_lead_page_id, {
        "Lead Status": statusProp("Concluído"),
      });
      console.log(`notion-sync: lead ${isp.notion_lead_page_id} marcado Concluído`);
    } catch (err) {
      // Não bloquear se lead não existir mais
      console.warn(`notion-sync: falha ao marcar lead como Concluído:`, err);
    }
  } else {
    // Tentar encontrar lead por ISP ID via query
    try {
      const { results } = await notionQueryDatabase(apiKey, LEADS_DB, {
        property: "ISP ID",
        rich_text: { equals: ispId },
      });
      if (results.length > 0) {
        await notionUpdatePage(apiKey, results[0].id, {
          "Lead Status": statusProp("Concluído"),
        });
        console.log(`notion-sync: lead ${results[0].id} (lookup) marcado Concluído`);
      }
    } catch (err) {
      console.warn(`notion-sync: falha no lookup do lead para ISP ${ispId}:`, err);
    }
  }

  return { page_id: page.id };
}

// ─── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // C-2: Verificar service_role com padding base64url correto
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!validateServiceRole(authHeader)) {
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const parts = token.split(".");
    if (parts.length !== 3) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  const notionApiKey = Deno.env.get("NOTION_API_KEY");
  if (!notionApiKey) {
    console.error("notion-sync: NOTION_API_KEY não configurado");
    return new Response(JSON.stringify({ error: "NOTION_API_KEY not configured" }), { status: 500 });
  }

  let body: { action?: string; isp_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
  }

  const { action, isp_id } = body;

  if (!action || !isp_id) {
    return new Response(JSON.stringify({ error: "action e isp_id são obrigatórios" }), { status: 400 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    let result: Record<string, unknown>;

    switch (action) {
      case "create_lead":
        result = await createLead(notionApiKey, supabaseAdmin, isp_id);
        break;

      case "graduate_to_client":
        result = await graduateToClient(notionApiKey, supabaseAdmin, isp_id);
        break;

      default:
        return new Response(
          JSON.stringify({ error: `Ação desconhecida: ${action}` }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    // I-1: spread seguro com tipo correto (result é Record<string, unknown>)
    return new Response(JSON.stringify({ ok: true, action, isp_id, ...result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error(`notion-sync ${action} error:`, err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
