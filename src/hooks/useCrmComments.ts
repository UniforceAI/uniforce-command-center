import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveIsp } from "@/hooks/useActiveIsp";
import { useAuth } from "@/contexts/AuthContext";

export interface CrmComment {
  id: string;
  isp_id: string;
  cliente_id: number;
  created_by: string | null;
  created_at: string;
  body: string;
  type: string; // 'comment' | 'action' | 'status_change'
  meta: Record<string, any> | null;
}

export function useCrmComments(clienteId: number | null) {
  const { ispId } = useActiveIsp();
  const { user } = useAuth();
  const [comments, setComments] = useState<CrmComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchComments = useCallback(async () => {
    if (!ispId || !clienteId) return;
    setIsLoading(true);
    const { data, error } = await (supabase as any)
      .from("crm_comments")
      .select("*")
      .eq("isp_id", ispId)
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("❌ useCrmComments fetch:", error.message);
    } else {
      setComments((data as CrmComment[]) || []);
    }
    setIsLoading(false);
  }, [ispId, clienteId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const addComment = useCallback(
    async (body: string, type: string = "comment", meta?: Record<string, any>) => {
      if (!ispId || !clienteId) return;
      const { data, error } = await (supabase as any)
        .from("crm_comments")
        .insert({
          isp_id: ispId,
          cliente_id: clienteId,
          created_by: user?.id || null,
          body,
          type,
          meta: meta || null,
        })
        .select()
        .single();

      if (error) throw error;
      setComments((prev) => [data as CrmComment, ...prev]);
      return data;
    },
    [ispId, clienteId, user]
  );

  return { comments, isLoading, addComment, refetch: fetchComments };
}
