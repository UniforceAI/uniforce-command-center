import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Single Supabase client (this project = official Uniforce yqdqmudsnjhixtxldqwi) ──
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected by the Supabase runtime
const EXT_URL = Deno.env.get("SUPABASE_URL")!;
const EXT_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SUPER_ADMIN_DOMAINS = ["uniforce.com.br"];

function emailDomain(email: string): string {
  return email.split("@")[1]?.toLowerCase() || "";
}

/**
 * Verify the caller's JWT against the external Supabase auth.
 * Returns the authenticated user's id, email, and allowed isp_ids.
 */
async function verifyCaller(
  extClient: ReturnType<typeof createClient>,
  authHeader: string | null
): Promise<{
  userId: string;
  email: string;
  isSuperAdmin: boolean;
  allowedIspIds: string[];
}> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw { status: 401, message: "Token de autenticação ausente." };
  }

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error,
  } = await extClient.auth.getUser(token);

  if (error || !user) {
    throw { status: 401, message: "Token inválido ou expirado." };
  }

  const email = user.email || "";
  const isSuperAdmin = SUPER_ADMIN_DOMAINS.includes(emailDomain(email));

  if (isSuperAdmin) {
    return { userId: user.id, email, isSuperAdmin: true, allowedIspIds: [] };
  }

  const { data: profile } = await extClient
    .from("profiles")
    .select("isp_id")
    .eq("id", user.id)
    .maybeSingle();

  const allowedIspIds = profile?.isp_id ? [profile.isp_id] : [];

  return { userId: user.id, email, isSuperAdmin: false, allowedIspIds };
}

function assertIspAccess(
  caller: { isSuperAdmin: boolean; allowedIspIds: string[] },
  requestedIspId: string
) {
  if (caller.isSuperAdmin) return;
  if (!caller.allowedIspIds.includes(requestedIspId)) {
    throw {
      status: 403,
      message: "Acesso negado: você não tem permissão para acessar este ISP.",
    };
  }
}

// ── Main handler ──
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Single client for auth + data (external Supabase with service role)
    const extClient = createClient(EXT_URL, EXT_SERVICE_KEY);

    // 1. Authenticate caller
    const authHeader = req.headers.get("authorization");
    const caller = await verifyCaller(extClient, authHeader);

    // 2. Parse body
    const body = await req.json();
    const { action, isp_id, ...params } = body;

    if (!isp_id || typeof isp_id !== "string" || isp_id.trim() === "") {
      return jsonResponse({ error: "isp_id is required" }, 400);
    }

    // 3. Authorize ISP access
    assertIspAccess(caller, isp_id);

    // 4. All data operations use the same extClient (service role)
    let result: any;

    switch (action) {
      // ── Workflow ──
      case "fetch_workflow": {
        const { data, error } = await extClient
          .from("crm_workflow")
          .select("*")
          .eq("isp_id", isp_id)
          .eq("archived", false)
          .order("created_at", { ascending: false });
        if (error) throw error;
        result = data;
        break;
      }

      case "upsert_workflow": {
        const { cliente_id, status_workflow, tags, owner_user_id, entered_workflow_at, score_snapshot } = params;
        if (!cliente_id) throw new Error("cliente_id required");

        const { data: existing, error: fetchErr } = await extClient
          .from("crm_workflow")
          .select("*")
          .eq("isp_id", isp_id)
          .eq("cliente_id", cliente_id)
          .maybeSingle();
        if (fetchErr) throw fetchErr;

        const now = new Date().toISOString();

        if (existing) {
          const updates: Record<string, any> = {
            last_action_at: now,
          };
          if (status_workflow !== undefined) {
            updates.status_workflow = status_workflow;
            updates.status_entered_at = now;
            // Se o registro estava arquivado (ex: re-adicionado após archive),
            // reativa automaticamente para que apareça no kanban.
            if (existing.archived) {
              updates.archived = false;
              updates.archived_at = null;
            }
          }
          if (tags !== undefined) updates.tags = tags;
          if (owner_user_id !== undefined) updates.owner_user_id = owner_user_id;
          if (status_workflow === "resolvido") {
            updates.score_snapshot = score_snapshot ?? null;
          } else if (status_workflow !== undefined) {
            updates.score_snapshot = null;
          }

          const { data, error } = await extClient
            .from("crm_workflow")
            .update(updates)
            .eq("id", existing.id)
            .select()
            .single();
          if (error) throw error;
          result = data;
        } else {
          const { data, error } = await extClient
            .from("crm_workflow")
            .insert({
              isp_id,
              cliente_id,
              status_workflow: status_workflow || "em_tratamento",
              tags: tags || [],
              owner_user_id: owner_user_id || null,
              entered_workflow_at: entered_workflow_at || now,
              last_action_at: now,
              archived: false,
              status_entered_at: now,
              score_snapshot: null,
            })
            .select()
            .single();
          if (error) throw error;
          result = data;
        }
        break;
      }

      case "archive_workflow": {
        const { cliente_id } = params;
        if (!cliente_id) throw new Error("cliente_id required");

        // ── Buscar registro atual para validar elegibilidade ──
        const { data: wfRecord, error: wfErr } = await extClient
          .from("crm_workflow")
          .select("id, status_workflow, status_entered_at, archived")
          .eq("isp_id", isp_id)
          .eq("cliente_id", cliente_id)
          .maybeSingle();
        if (wfErr) throw wfErr;
        if (!wfRecord) throw new Error("Workflow record not found");

        // Idempotente: já arquivado → retorna sem erro e sem ação
        if (wfRecord.archived) {
          result = wfRecord;
          break;
        }

        // ── GUARD BACKEND: valida thresholds antes de arquivar ──
        // Esta é a camada definitiva de proteção — o servidor é o árbitro final.
        // Rejeita pedidos de archive prematuro mesmo que venham de JS antigo no cliente.
        if (wfRecord.status_entered_at) {
          const msPerDay = 1000 * 60 * 60 * 24;
          const now = new Date();
          const enteredAt = new Date(wfRecord.status_entered_at);

          if (wfRecord.status_workflow === "resolvido") {
            const calendarDays =
              Math.floor(now.getTime() / msPerDay) -
              Math.floor(enteredAt.getTime() / msPerDay);
            if (calendarDays < 30) {
              throw {
                status: 400,
                message: `Archive prematuro: ${calendarDays} de 30 dias corridos decorridos para status "resolvido".`,
              };
            }
          }

          if (wfRecord.status_workflow === "perdido") {
            let businessDays = 0;
            const cursor = new Date(enteredAt);
            cursor.setHours(0, 0, 0, 0);
            const end = new Date(now);
            end.setHours(0, 0, 0, 0);
            while (cursor < end) {
              cursor.setDate(cursor.getDate() + 1);
              const dow = cursor.getDay();
              if (dow !== 0 && dow !== 6) businessDays++;
            }
            if (businessDays < 30) {
              throw {
                status: 400,
                message: `Archive prematuro: ${businessDays} de 30 dias úteis decorridos para status "perdido".`,
              };
            }
          }
        }

        const { data, error } = await extClient
          .from("crm_workflow")
          .update({
            archived: true,
            archived_at: new Date().toISOString(),
            last_action_at: new Date().toISOString(),
          })
          .eq("id", wfRecord.id)
          .select()
          .single();
        if (error) throw error;
        result = data;
        break;
      }

      // ── Comments ──
      case "fetch_comments": {
        const { cliente_id, limit = 50 } = params;
        if (!cliente_id) throw new Error("cliente_id required");

        const { data, error } = await extClient
          .from("crm_comments")
          .select("*")
          .eq("isp_id", isp_id)
          .eq("cliente_id", cliente_id)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error) throw error;
        result = data;
        break;
      }

      case "add_comment": {
        const { cliente_id, body: commentBody, type = "comment", meta, created_by } = params;
        if (!cliente_id || !commentBody) throw new Error("cliente_id and body required");

        const { data, error } = await extClient
          .from("crm_comments")
          .insert({
            isp_id,
            cliente_id,
            created_by: created_by || caller.userId,
            body: commentBody,
            type,
            meta: meta || null,
          })
          .select()
          .single();
        if (error) throw error;
        result = data;
        break;
      }

      case "update_comment": {
        const { comment_id, body: updatedBody } = params;
        if (!comment_id || !updatedBody) throw new Error("comment_id and body required");

        const { data, error } = await extClient
          .from("crm_comments")
          .update({ body: updatedBody })
          .eq("id", comment_id)
          .eq("isp_id", isp_id)
          .select()
          .single();
        if (error) throw error;
        result = data;
        break;
      }

      case "delete_comment": {
        const { comment_id } = params;
        if (!comment_id) throw new Error("comment_id required");

        const { error } = await extClient
          .from("crm_comments")
          .delete()
          .eq("id", comment_id)
          .eq("isp_id", isp_id);
        if (error) throw error;
        result = { success: true };
        break;
      }

      // ── Tags catalog ──
      case "fetch_tags": {
        const { data, error } = await extClient
          .from("crm_tags")
          .select("*")
          .eq("isp_id", isp_id)
          .order("name");
        if (error) throw error;
        result = data;
        break;
      }

      case "create_tag": {
        const { name, color = "#6366f1" } = params;
        if (!name) throw new Error("name required");

        const { data, error } = await extClient
          .from("crm_tags")
          .upsert({ isp_id, name, color }, { onConflict: "isp_id,name" })
          .select()
          .single();
        if (error) throw error;
        result = data;
        break;
      }

      case "delete_tag": {
        const { tag_id } = params;
        if (!tag_id) throw new Error("tag_id required");

        const { error } = await extClient
          .from("crm_tags")
          .delete()
          .eq("id", tag_id)
          .eq("isp_id", isp_id);
        if (error) throw error;
        result = { success: true };
        break;
      }

      // ── Risk Bucket Config ──
      case "fetch_risk_bucket_config": {
        const { data, error } = await extClient
          .from("risk_bucket_config")
          .select("*")
          .eq("isp_id", isp_id)
          .maybeSingle();
        if (error) throw error;
        result = data;
        break;
      }

      case "save_risk_bucket_config": {
        const { ok_max, alert_min, alert_max, critical_min } = params;
        const { data, error } = await extClient
          .from("risk_bucket_config")
          .upsert(
            { isp_id, ok_max, alert_min, alert_max, critical_min },
            { onConflict: "isp_id" }
          )
          .select()
          .single();
        if (error) throw error;
        result = data;
        break;
      }

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }

    return jsonResponse(result);
  } catch (err: any) {
    const status = err.status || 500;
    const message = err.message || "Internal server error";
    console.error(`crm-api error [${status}]:`, message);
    return jsonResponse({ error: message }, status);
  }
});
