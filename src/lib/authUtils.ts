import { externalSupabase } from "@/integrations/supabase/external-client";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface DomainValidationResult {
  valid: boolean;
  isp_id?: string;
  isp_nome?: string;
  instancia_isp?: string;
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const SUPER_ADMIN_DOMAINS = ["uniforce.com.br"];

const UNIFORCE_SENTINEL: DomainValidationResult = {
  valid: true,
  isp_id: "uniforce",
  isp_nome: "Uniforce",
  instancia_isp: "uniforce",
};

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Validates whether an email is authorized to access the system.
 *
 * POLICY: Any email domain is accepted. What matters is whether the
 * user was pre-registered by a Uniforce admin — not the email domain.
 * Gmail, corporate domains, subdomains — all are valid if registered.
 *
 * Strategy:
 * 1. @uniforce.com.br  → always authorized as super_admin (internal team)
 * 2. All other emails  → check if pre-registered via SECURITY DEFINER RPC
 *                        (bypasses RLS, works with anon key before sign-in)
 * 3. Fallback          → if RPC is unreachable, try static domain map so
 *                        existing ISP corporate emails are never locked out
 */
export async function validateEmailDomain(
  email: string
): Promise<DomainValidationResult> {
  const lower = email.toLowerCase().trim();
  const domain = lower.split("@")[1];

  if (!domain) {
    return { valid: false, error: "Email inválido." };
  }

  // ── 1. Uniforce internal team ──────────────────────────────
  if (SUPER_ADMIN_DOMAINS.includes(domain)) {
    return UNIFORCE_SENTINEL;
  }

  // ── 2. Registered user lookup (primary gate) ──────────────
  // Any email is allowed if the user was pre-created by an admin.
  // Domain is irrelevant — registration is the only requirement.
  try {
    const { data, error } = await externalSupabase
      .rpc("get_isp_for_registered_email", { p_email: lower });

    if (!error && data && data.length > 0) {
      const { isp_id, isp_nome, instancia_isp } = data[0];
      return { valid: true, isp_id, isp_nome, instancia_isp };
    }
  } catch (err) {
    // RPC unreachable — fall through to static fallback below
    console.warn("⚠️ get_isp_for_registered_email failed, trying fallback:", err);
  }

  // ── 3. Static domain fallback (safety net only) ───────────
  // Only reached if the RPC above failed (network error, cold start, etc.).
  // Prevents locking out existing ISP corporate-email users during outages.
  const STATIC_FALLBACK: Record<string, DomainValidationResult> = {
    "agytelecom.com.br":  { valid: true, isp_id: "agy-telecom", isp_nome: "AGY Telecom",  instancia_isp: "ispbox" },
    "agy-telecom.com.br": { valid: true, isp_id: "agy-telecom", isp_nome: "AGY Telecom",  instancia_isp: "ispbox" },
    "d-kiros.com.br":     { valid: true, isp_id: "d-kiros",     isp_nome: "D-Kiros",      instancia_isp: "ixc"    },
    "dkiros.com.br":      { valid: true, isp_id: "d-kiros",     isp_nome: "D-Kiros",      instancia_isp: "ixc"    },
    "zentelecom.com.br":  { valid: true, isp_id: "zen-telecom", isp_nome: "Zen Telecom",  instancia_isp: "ixc"    },
    "zen-telecom.com.br": { valid: true, isp_id: "zen-telecom", isp_nome: "Zen Telecom",  instancia_isp: "ixc"    },
    "igpfibra.com.br":    { valid: true, isp_id: "igp-fibra",   isp_nome: "IGP Fibra",    instancia_isp: "ixc"    },
    "igp-fibra.com.br":   { valid: true, isp_id: "igp-fibra",   isp_nome: "IGP Fibra",    instancia_isp: "ixc"    },
    "igpfibra.com":       { valid: true, isp_id: "igp-fibra",   isp_nome: "IGP Fibra",    instancia_isp: "ixc"    },
  };
  if (STATIC_FALLBACK[domain]) return STATIC_FALLBACK[domain];

  // ── 4. Not found ──────────────────────────────────────────
  return {
    valid: false,
    error: "Acesso não encontrado. Verifique com o administrador se seu cadastro foi criado.",
  };
}

// ─────────────────────────────────────────────────────────────
// Profile bootstrap (called after first sign-in)
// ─────────────────────────────────────────────────────────────

/**
 * Ensures a user profile exists in the external Supabase DB.
 *
 * Called by Auth.tsx as a safety net after sign-in, in case the
 * `handle_new_user` trigger didn't run (e.g., legacy accounts).
 * The trigger is the primary mechanism; this is just a fallback.
 */
export async function createUserProfileInExternal(
  userId: string,
  email: string,
  fullName: string,
  ispId: string
): Promise<{ success: boolean; error?: string }> {
  let instanciaIsp = "";
  let ispNome = ispId;

  try {
    const { data: isp } = await externalSupabase
      .from("isps")
      .select("isp_nome, instancia_isp")
      .eq("isp_id", ispId)
      .maybeSingle();

    if (isp) {
      instanciaIsp = isp.instancia_isp || "";
      ispNome = isp.isp_nome || ispId;
    }
  } catch {
    // Non-fatal; continue with empty instancia_isp
  }

  const { error: profileErr } = await externalSupabase
    .from("profiles")
    .upsert(
      { id: userId, isp_id: ispId, instancia_isp: instanciaIsp, full_name: fullName, email },
      { onConflict: "id" }
    );

  if (profileErr) {
    console.error("❌ Erro ao criar profile:", profileErr);
    return { success: false, error: "Erro ao criar perfil: " + profileErr.message };
  }

  const defaultRole = ispId === "uniforce" ? "super_admin" : "viewer";
  const { error: roleErr } = await externalSupabase
    .from("user_roles")
    .upsert(
      { user_id: userId, isp_id: ispId, instancia_isp: instanciaIsp, role: defaultRole },
      { onConflict: "user_id,isp_id,role" }
    );

  if (roleErr) {
    console.warn("⚠️ Erro ao criar role (pode já existir):", roleErr.message);
  }

  return { success: true };
}
