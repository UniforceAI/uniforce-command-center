import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── External Supabase (auth provider) ──
const EXT_URL = "https://yqdqmudsnjhixtxldqwi.supabase.co";
const EXT_SERVICE_KEY = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY")!;

const NOTION_API = "https://api.notion.com/v1";
const DATABASE_ID = "229d9215a80c8017b0d2d9b597f4f314";

const FIELD_MAP: Record<string, { notion: string; type: "title" | "rich_text" | "email" | "phone_number" | "url" | "select" | "status" | "date" }> = {
  nome_fantasia:            { notion: "Cliente",              type: "rich_text" },
  cnpj:                     { notion: "CNPJ",                 type: "rich_text" },
  contato_oficial_nome:     { notion: "Representante Legal",  type: "title" },
  contato_oficial_telefone: { notion: "Phone Number",         type: "phone_number" },
  email_oficial:            { notion: "Contact Email",        type: "email" },
  email_financeiro:         { notion: "Email Cobrança",       type: "email" },
  area:                     { notion: "area",                 type: "rich_text" },
  atendentes:               { notion: "atendentes",           type: "rich_text" },
  produto:                  { notion: "Produto",              type: "select" },
  data_pagamento:           { notion: "Data de pagto",        type: "select" },
  link_contrato:            { notion: "Link do contrato",     type: "url" },
  lead_status:              { notion: "Lead Status",          type: "status" },
};

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function notionHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json",
  };
}

/** Verify caller JWT against external Supabase auth */
async function verifyCaller(authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) {
    throw { status: 401, message: "Token de autenticação ausente." };
  }
  const token = authHeader.replace("Bearer ", "");
  const extClient = createClient(EXT_URL, EXT_SERVICE_KEY);
  const { data: { user }, error } = await extClient.auth.getUser(token);
  if (error || !user) {
    throw { status: 401, message: "Token inválido ou expirado." };
  }
  return user;
}

async function findPageByIspNome(token: string, ispNome: string): Promise<string | null> {
  const res = await fetch(`${NOTION_API}/databases/${DATABASE_ID}/query`, {
    method: "POST",
    headers: notionHeaders(token),
    body: JSON.stringify({
      filter: { property: "Cliente", rich_text: { equals: ispNome } },
      page_size: 1,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Notion query failed: ${JSON.stringify(data)}`);
  return data.results?.[0]?.id ?? null;
}

function extractValue(prop: any): string {
  if (!prop) return "";
  switch (prop.type) {
    case "title":        return prop.title?.map((t: any) => t.plain_text).join("") ?? "";
    case "rich_text":    return prop.rich_text?.map((t: any) => t.plain_text).join("") ?? "";
    case "email":        return prop.email ?? "";
    case "phone_number": return prop.phone_number ?? "";
    case "url":          return prop.url ?? "";
    case "select":       return prop.select?.name ?? "";
    case "status":       return prop.status?.name ?? "";
    case "date":         return prop.date?.start ?? "";
    default:             return "";
  }
}

async function readPage(token: string, pageId: string): Promise<Record<string, string>> {
  const res = await fetch(`${NOTION_API}/pages/${pageId}`, { headers: notionHeaders(token) });
  const data = await res.json();
  if (!res.ok) throw new Error(`Notion read failed: ${JSON.stringify(data)}`);
  const result: Record<string, string> = {};
  for (const [formKey, { notion }] of Object.entries(FIELD_MAP)) {
    result[formKey] = extractValue(data.properties?.[notion]);
  }
  return result;
}

function buildProperties(formData: Record<string, string>) {
  const properties: Record<string, any> = {};
  for (const [formKey, value] of Object.entries(formData)) {
    const mapping = FIELD_MAP[formKey];
    if (!mapping) continue;
    const { notion, type } = mapping;
    switch (type) {
      case "title":        properties[notion] = { title: [{ text: { content: value } }] }; break;
      case "rich_text":    properties[notion] = { rich_text: [{ text: { content: value } }] }; break;
      case "email":        properties[notion] = { email: value || null }; break;
      case "phone_number": properties[notion] = { phone_number: value || null }; break;
      case "url":          properties[notion] = { url: value || null }; break;
      case "select":       properties[notion] = value ? { select: { name: value } } : { select: null }; break;
      case "status":       properties[notion] = value ? { status: { name: value } } : { status: null }; break;
      case "date":         properties[notion] = value ? { date: { start: value } } : { date: null }; break;
    }
  }
  return properties;
}

async function updatePage(token: string, pageId: string, formData: Record<string, string>) {
  const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
    method: "PATCH",
    headers: notionHeaders(token),
    body: JSON.stringify({ properties: buildProperties(formData) }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Notion update failed: ${JSON.stringify(data)}`);
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // --- Authenticate caller via external Supabase ---
  try {
    await verifyCaller(req.headers.get("Authorization"));
  } catch (e: any) {
    return jsonRes({ error: e.message || "Unauthorized" }, e.status || 401);
  }

  const NOTION_API_KEY = Deno.env.get("NOTION_API_KEY");
  if (!NOTION_API_KEY) {
    return jsonRes({ error: "NOTION_API_KEY not configured" }, 500);
  }

  try {
    const { action, isp_nome, data: formData } = await req.json();

    if (!isp_nome) return jsonRes({ error: "isp_nome is required" }, 400);

    const pageId = await findPageByIspNome(NOTION_API_KEY, isp_nome);

    if (action === "read") {
      if (!pageId) return jsonRes({ data: null, message: "ISP not found in Notion" });
      const profile = await readPage(NOTION_API_KEY, pageId);
      return jsonRes({ data: profile });
    }

    if (action === "write") {
      if (!pageId) return jsonRes({ error: "ISP not found in Notion. Cannot update." }, 404);
      await updatePage(NOTION_API_KEY, pageId, formData);
      return jsonRes({ success: true });
    }

    return jsonRes({ error: "Invalid action. Use 'read' or 'write'." }, 400);
  } catch (err: unknown) {
    console.error("Notion ISP profile error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonRes({ error: message }, 500);
  }
});
