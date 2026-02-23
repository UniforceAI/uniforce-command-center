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
  type: string;
  meta: Record<string, any> | null;
}

async function callCrmApi(payload: Record<string, any>) {
  const { data, error } = await supabase.functions.invoke("crm-api", {
    body: payload,
  });
  if (error) throw error;
  return data;
}

export function useCrmComments(clienteId: number | null) {
  const { ispId } = useActiveIsp();
  const { user } = useAuth();
  const [comments, setComments] = useState<CrmComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchComments = useCallback(async () => {
    if (!ispId || !clienteId) return;
    setIsLoading(true);
    try {
      const data = await callCrmApi({
        action: "fetch_comments",
        isp_id: ispId,
        cliente_id: clienteId,
      });
      setComments((data as CrmComment[]) || []);
    } catch (err: any) {
      console.error("❌ useCrmComments fetch:", err.message);
    }
    setIsLoading(false);
  }, [ispId, clienteId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const addComment = useCallback(
    async (body: string, type: string = "comment", meta?: Record<string, any>) => {
      if (!ispId || !clienteId) return;
      const data = await callCrmApi({
        action: "add_comment",
        isp_id: ispId,
        cliente_id: clienteId,
        created_by: user?.id || null,
        body,
        type,
        meta: meta || null,
      });
      setComments((prev) => [data as CrmComment, ...prev]);
      return data;
    },
    [ispId, clienteId, user]
  );

  return { comments, isLoading, addComment, refetch: fetchComments };
}
