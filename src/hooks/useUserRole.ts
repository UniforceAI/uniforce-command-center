// src/hooks/useUserRole.ts
// Busca o role do usuário logado para controle de UI (show/hide botões de billing)

import { useQuery } from "@tanstack/react-query";
import { externalSupabase } from "@/integrations/supabase/external-client";

export type UserRole = "super_admin" | "admin" | "support" | "user";

export function useUserRole() {
  return useQuery<UserRole | null>({
    queryKey: ["user-role"],
    queryFn: async () => {
      const { data: { user } } = await externalSupabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await externalSupabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error || !data) return null;
      return data.role as UserRole;
    },
    staleTime: 1000 * 60 * 30, // 30 min
    retry: 1,
    throwOnError: false,
  });
}
