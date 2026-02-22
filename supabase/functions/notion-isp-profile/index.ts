import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NOTION_API = "https://api.notion.com/v1";
const DATABASE_ID = "229d9215a80c8017b0d2d9b597f4f314";

// Notion field mapping: form key → Notion property name + type
const FIELD_MAP: Record<string, { notion: string; type: "title" | "rich_text" | "email" | "phone_number" | "url" | "select" | "date" }> = {
  nome_fantasia:            { notion: "Cliente",              type: "rich_text" },
  cnpj:                     { notion: "CNPJ",                 type: "rich_text" },
  contato_oficial_nome:     { notion: "Representante Legal",  type: "title" },
  contato_oficial_telefone: { notion: "Phone Number",         type: "phone_number" },
  email_oficial:            { notion: "Contact Email",        type: "email" },
  email_financeiro:         { notion: "Email Cobrança",       type: "email" },
  area:                     { notion: "area",                 type: "rich_text" },
  atendentes:               { notion: "atendentes",           type: "rich_text" },
  produto:                  { notion: "Produto",              type: "rich_text" },
  data_pagamento:           { notion: "Data de pagamento",    type: "rich_text" },
  link_contrato:            { notion: "Link do contrato",     type: "url" },
  lead_status:              { notion: "Lead Status",          type: "select" },
};

function notionHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json",
  };
}

/** Find a page in the database by the "Cliente" rich_text property matching ispNome */
async function findPageByIspNome(token: string, ispNome: string): Promise<string | null> {
  const res = await fetch(`${NOTION_API}/databases/${DATABASE_ID}/query`, {
    method: "POST",
    headers: notionHeaders(token),
    body: JSON.stringify({
      filter: {
        property: "Cliente",
        rich_text: { equals: ispNome },
      },
      page_size: 1,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Notion query failed: ${JSON.stringify(data)}`);
  return data.results?.[0]?.id ?? null;
}

/** Extract plain text from a Notion property value */
function extractValue(prop: any): string {
  if (!prop) return "";
  switch (prop.type) {
    case "title":
      return prop.title?.map((t: any) => t.plain_text).join("") ?? "";
    case "rich_text":
      return prop.rich_text?.map((t: any) => t.plain_text).join("") ?? "";
    case "email":
      return prop.email ?? "";
    case "phone_number":
      return prop.phone_number ?? "";
    case "url":
      return prop.url ?? "";
    case "select":
      return prop.select?.name ?? "";
    case "date":
      return prop.date?.start ?? "";
    default:
      return "";
  }
}

/** Read all mapped fields from a Notion page */
async function readPage(token: string, pageId: string): Promise<Record<string, string>> {
  const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
    headers: notionHeaders(token),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Notion read failed: ${JSON.stringify(data)}`);

  const result: Record<string, string> = {};
  for (const [formKey, { notion }] of Object.entries(FIELD_MAP)) {
    result[formKey] = extractValue(data.properties?.[notion]);
  }
  return result;
}

/** Build Notion property payload from form data */
function buildProperties(formData: Record<string, string>) {
  const properties: Record<string, any> = {};
  for (const [formKey, value] of Object.entries(formData)) {
    const mapping = FIELD_MAP[formKey];
    if (!mapping) continue;
    const { notion, type } = mapping;
    switch (type) {
      case "title":
        properties[notion] = { title: [{ text: { content: value } }] };
        break;
      case "rich_text":
        properties[notion] = { rich_text: [{ text: { content: value } }] };
        break;
      case "email":
        properties[notion] = { email: value || null };
        break;
      case "phone_number":
        properties[notion] = { phone_number: value || null };
        break;
      case "url":
        properties[notion] = { url: value || null };
        break;
      case "select":
        properties[notion] = value ? { select: { name: value } } : { select: null };
        break;
      case "date":
        properties[notion] = value ? { date: { start: value } } : { date: null };
        break;
    }
  }
  return properties;
}

/** Update a Notion page */
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

  const NOTION_API_KEY = Deno.env.get("NOTION_API_KEY");
  if (!NOTION_API_KEY) {
    return new Response(JSON.stringify({ error: "NOTION_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { action, isp_nome, data: formData } = await req.json();

    if (!isp_nome) {
      return new Response(JSON.stringify({ error: "isp_nome is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pageId = await findPageByIspNome(NOTION_API_KEY, isp_nome);

    if (action === "read") {
      if (!pageId) {
        return new Response(JSON.stringify({ data: null, message: "ISP not found in Notion" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const profile = await readPage(NOTION_API_KEY, pageId);
      return new Response(JSON.stringify({ data: profile }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "write") {
      if (!pageId) {
        return new Response(JSON.stringify({ error: "ISP not found in Notion. Cannot update." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await updatePage(NOTION_API_KEY, pageId, formData);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use 'read' or 'write'." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    console.error("Notion ISP profile error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
