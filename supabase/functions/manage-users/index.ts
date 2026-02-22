import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// External Supabase (auth provider)
const EXT_URL = "https://yqdqmudsnjhixtxldqwi.supabase.co";
const EXT_SERVICE_KEY = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY")!;

function adminClient() {
  return createClient(EXT_URL, EXT_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Verify the caller's JWT against the external Supabase */
async function verifyCallerIsAdmin(authHeader: string | null): Promise<{ userId: string; email: string }> {
  if (!authHeader) throw new Error("Token de autenticação ausente.");

  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(EXT_URL, EXT_SERVICE_KEY);
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) throw new Error("Token inválido ou expirado.");

  // Check if user has admin or super_admin role
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const isAdmin = roles?.some(
    (r: any) => r.role === "admin" || r.role === "super_admin"
  );

  if (!isAdmin) throw new Error("Permissão negada. Somente administradores podem gerenciar contas.");

  return { userId: user.id, email: user.email || "" };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, ...payload } = await req.json();
    const authHeader = req.headers.get("authorization");
    await verifyCallerIsAdmin(authHeader);
    const admin = adminClient();

    // ── CREATE USER ─────────────────────────────────────────
    if (action === "create") {
      const { email, password, full_name, isp_id, instancia_isp, role } = payload;

      if (!email || !password || !full_name || !isp_id) {
        throw new Error("Campos obrigatórios: email, password, full_name, isp_id");
      }

      // 1. Create auth user
      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm so user can login immediately
        user_metadata: { full_name },
      });

      if (authError) throw new Error(`Erro ao criar usuário: ${authError.message}`);

      const newUserId = authData.user.id;

      // 2. Upsert profile
      const { error: profileError } = await admin
        .from("profiles")
        .upsert({
          id: newUserId,
          full_name,
          email,
          isp_id,
          instancia_isp: instancia_isp || "",
        }, { onConflict: "id" });

      if (profileError) {
        console.error("Profile creation error:", profileError);
        // Don't fail — user exists in auth, profile can be retried
      }

      // 3. Insert role
      const userRole = role || "user";
      const { error: roleError } = await admin
        .from("user_roles")
        .upsert({
          user_id: newUserId,
          isp_id,
          instancia_isp: instancia_isp || "",
          role: userRole,
        }, { onConflict: "user_id,isp_id,role" });

      if (roleError) {
        console.error("Role creation error:", roleError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          user: { id: newUserId, email, full_name, role: userRole },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── DELETE USER ──────────────────────────────────────────
    if (action === "delete") {
      const { user_id } = payload;
      if (!user_id) throw new Error("user_id é obrigatório.");

      // 1. Remove roles
      await admin.from("user_roles").delete().eq("user_id", user_id);

      // 2. Remove profile
      await admin.from("profiles").delete().eq("id", user_id);

      // 3. Delete auth user
      const { error: deleteError } = await admin.auth.admin.deleteUser(user_id);
      if (deleteError) throw new Error(`Erro ao deletar usuário: ${deleteError.message}`);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Ação desconhecida: ${action}`);
  } catch (err: any) {
    console.error("manage-users error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
