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

// Role hierarchy: higher number = more privilege
const ROLE_LEVEL: Record<string, number> = {
  user: 1,
  support_staff: 2,
  admin: 3,
  super_admin: 4,
};

function adminClient() {
  return createClient(EXT_URL, EXT_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Verify caller's JWT and return their highest role */
async function verifyCaller(authHeader: string | null): Promise<{ userId: string; email: string; role: string; roleLevel: number }> {
  if (!authHeader) throw new Error("Token de autenticação ausente.");

  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(EXT_URL, EXT_SERVICE_KEY);
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) throw new Error("Token inválido ou expirado.");

  // Get caller's roles
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  // Find highest role
  let highestRole = "user";
  let highestLevel = 0;
  for (const r of roles || []) {
    const level = ROLE_LEVEL[r.role] ?? 0;
    if (level > highestLevel) {
      highestLevel = level;
      highestRole = r.role;
    }
  }

  // Must be at least admin to manage accounts
  if (highestLevel < ROLE_LEVEL.admin) {
    throw new Error("Permissão negada. Somente administradores podem gerenciar contas.");
  }

  return { userId: user.id, email: user.email || "", role: highestRole, roleLevel: highestLevel };
}

/** Validate that the caller can assign the target role */
function validateRoleHierarchy(callerLevel: number, targetRole: string) {
  const targetLevel = ROLE_LEVEL[targetRole];
  if (targetLevel === undefined) {
    throw new Error(`Role inválida: ${targetRole}`);
  }
  if (targetLevel > callerLevel) {
    throw new Error(`Você não pode atribuir o perfil "${targetRole}" pois é superior ao seu.`);
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, ...payload } = await req.json();
    const authHeader = req.headers.get("authorization");
    const caller = await verifyCaller(authHeader);
    const admin = adminClient();

    // ── CREATE USER ─────────────────────────────────────────
    if (action === "create") {
      const { email, password, full_name, isp_id, instancia_isp, role } = payload;

      if (!email || !password || !full_name || !isp_id) {
        throw new Error("Campos obrigatórios: email, password, full_name, isp_id");
      }

      const userRole = role || "user";
      validateRoleHierarchy(caller.roleLevel, userRole);

      // 1. Create auth user
      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
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
      }

      // 3. Insert role
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

      // Prevent self-deletion
      if (user_id === caller.userId) {
        throw new Error("Você não pode excluir sua própria conta.");
      }

      // Check target user's role — can't delete someone above you
      const { data: targetRoles } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", user_id);

      for (const r of targetRoles || []) {
        const level = ROLE_LEVEL[r.role] ?? 0;
        if (level > caller.roleLevel) {
          throw new Error("Você não pode excluir um usuário com perfil superior ao seu.");
        }
      }

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
