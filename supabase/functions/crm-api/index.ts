import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { action, isp_id, ...params } = body;

    if (!isp_id || typeof isp_id !== "string" || isp_id.trim() === "") {
      return new Response(JSON.stringify({ error: "isp_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: any;

    switch (action) {
      // ── Workflow ──
      case "fetch_workflow": {
        const { data, error } = await supabase
          .from("crm_workflow")
          .select("*")
          .eq("isp_id", isp_id)
          .order("created_at", { ascending: false });
        if (error) throw error;
        result = data;
        break;
      }

      case "upsert_workflow": {
        const { cliente_id, status_workflow, tags, owner_user_id, entered_workflow_at } = params;
        if (!cliente_id) throw new Error("cliente_id required");

        const { data: existing, error: fetchErr } = await supabase
          .from("crm_workflow")
          .select("*")
          .eq("isp_id", isp_id)
          .eq("cliente_id", cliente_id)
          .maybeSingle();
        if (fetchErr) throw fetchErr;

        if (existing) {
          const updates: Record<string, any> = {
            last_action_at: new Date().toISOString(),
          };
          if (status_workflow !== undefined) updates.status_workflow = status_workflow;
          if (tags !== undefined) updates.tags = tags;
          if (owner_user_id !== undefined) updates.owner_user_id = owner_user_id;

          const { data, error } = await supabase
            .from("crm_workflow")
            .update(updates)
            .eq("id", existing.id)
            .select()
            .single();
          if (error) throw error;
          result = data;
        } else {
          const { data, error } = await supabase
            .from("crm_workflow")
            .insert({
              isp_id,
              cliente_id,
              status_workflow: status_workflow || "em_tratamento",
              tags: tags || [],
              owner_user_id: owner_user_id || null,
              entered_workflow_at: entered_workflow_at || new Date().toISOString(),
              last_action_at: new Date().toISOString(),
            })
            .select()
            .single();
          if (error) throw error;
          result = data;
        }
        break;
      }

      // ── Comments ──
      case "fetch_comments": {
        const { cliente_id, limit = 50 } = params;
        if (!cliente_id) throw new Error("cliente_id required");

        const { data, error } = await supabase
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

        const { data, error } = await supabase
          .from("crm_comments")
          .insert({
            isp_id,
            cliente_id,
            created_by: created_by || null,
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

        const { data, error } = await supabase
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

        const { error } = await supabase
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
        const { data, error } = await supabase
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

        const { data, error } = await supabase
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

        const { error } = await supabase
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
        const { data, error } = await supabase
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
        const { data, error } = await supabase
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
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("crm-api error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
