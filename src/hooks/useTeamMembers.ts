import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { externalSupabase } from "@/integrations/supabase/external-client";

export interface TeamMember {
  id: string;
  full_name: string | null;
  initials: string;
}

export function useTeamMembers(ispId: string) {
  const { data: members = [] } = useQuery({
    queryKey: ["team-members", ispId],
    queryFn: async () => {
      const { data, error } = await externalSupabase
        .from("profiles")
        .select("id, full_name")
        .eq("isp_id", ispId);
      if (error) throw error;
      return (data || []).map((p) => ({
        id: p.id,
        full_name: p.full_name,
        initials: getInitials(p.full_name),
      }));
    },
    enabled: !!ispId,
  });

  const memberMap = useMemo(
    () => new Map(members.map((m) => [m.id, m])),
    [members]
  );

  return { members, memberMap };
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] || "?").toUpperCase();
}
