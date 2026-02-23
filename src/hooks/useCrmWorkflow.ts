import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveIsp } from "@/hooks/useActiveIsp";

export type WorkflowStatus = "em_tratamento" | "resolvido" | "perdido";

export interface CrmWorkflowRecord {
  id: string;
  isp_id: string;
  cliente_id: number;
  status_workflow: WorkflowStatus;
  owner_user_id: string | null;
  tags: string[];
  entered_workflow_at: string;
  last_action_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useCrmWorkflow() {
  const { ispId } = useActiveIsp();
  const [records, setRecords] = useState<CrmWorkflowRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRecords = useCallback(async () => {
    if (!ispId) return;
    setIsLoading(true);

    const { data, error } = await supabase
      .from("crm_workflow")
      .select("*")
      .eq("isp_id", ispId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ useCrmWorkflow fetch error:", error.message);
    } else {
      setRecords((data as CrmWorkflowRecord[]) || []);
    }
    setIsLoading(false);
  }, [ispId]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  /** Adiciona cliente ao workflow de retenção */
  const addToWorkflow = useCallback(async (clienteId: number, tags?: string[]) => {
    const { data, error } = await supabase
      .from("crm_workflow")
      .upsert(
        {
          isp_id: ispId,
          cliente_id: clienteId,
          status_workflow: "em_tratamento" as WorkflowStatus,
          tags: tags || [],
        },
        { onConflict: "isp_id,cliente_id" }
      )
      .select()
      .single();

    if (error) throw error;
    setRecords((prev) => {
      const filtered = prev.filter((r) => r.cliente_id !== clienteId);
      return [data as CrmWorkflowRecord, ...filtered];
    });
    return data;
  }, [ispId]);

  /** Atualiza status do workflow */
  const updateStatus = useCallback(async (clienteId: number, status: WorkflowStatus) => {
    const { data, error } = await supabase
      .from("crm_workflow")
      .update({
        status_workflow: status,
        last_action_at: new Date().toISOString(),
      })
      .eq("isp_id", ispId)
      .eq("cliente_id", clienteId)
      .select()
      .single();

    if (error) throw error;
    setRecords((prev) =>
      prev.map((r) => (r.cliente_id === clienteId ? (data as CrmWorkflowRecord) : r))
    );
    return data;
  }, [ispId]);

  /** Atualiza tags do cliente no workflow */
  const updateTags = useCallback(async (clienteId: number, tags: string[]) => {
    const { data, error } = await supabase
      .from("crm_workflow")
      .update({ tags })
      .eq("isp_id", ispId)
      .eq("cliente_id", clienteId)
      .select()
      .single();

    if (error) throw error;
    setRecords((prev) =>
      prev.map((r) => (r.cliente_id === clienteId ? (data as CrmWorkflowRecord) : r))
    );
    return data;
  }, [ispId]);

  /** Mapa rápido clienteId → record */
  const workflowMap = new Map(records.map((r) => [r.cliente_id, r]));

  return {
    records,
    isLoading,
    addToWorkflow,
    updateStatus,
    updateTags,
    workflowMap,
    refetch: fetchRecords,
  };
}
