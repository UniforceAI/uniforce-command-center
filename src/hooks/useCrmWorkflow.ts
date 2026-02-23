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

async function callCrmApi(payload: Record<string, any>) {
  const { data, error } = await supabase.functions.invoke("crm-api", {
    body: payload,
  });
  if (error) throw error;
  return data;
}

export function useCrmWorkflow() {
  const { ispId } = useActiveIsp();
  const [records, setRecords] = useState<CrmWorkflowRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRecords = useCallback(async () => {
    if (!ispId) return;
    setIsLoading(true);
    try {
      const data = await callCrmApi({ action: "fetch_workflow", isp_id: ispId });
      setRecords((data as CrmWorkflowRecord[]) || []);
    } catch (err: any) {
      console.error("❌ useCrmWorkflow fetch error:", err.message);
    }
    setIsLoading(false);
  }, [ispId]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  /** Adiciona cliente ao workflow (idempotent — INSERT se novo, UPDATE se existente) */
  const addToWorkflow = useCallback(
    async (clienteId: number, tags?: string[]) => {
      if (!ispId) throw new Error("No ISP");

      const payload: Record<string, any> = {
        action: "upsert_workflow",
        isp_id: ispId,
        cliente_id: clienteId,
        status_workflow: "em_tratamento" as WorkflowStatus,
        tags: tags || [],
      };

      const data = await callCrmApi(payload);
      setRecords((prev) => {
        const idx = prev.findIndex((r) => r.cliente_id === clienteId);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = data as CrmWorkflowRecord;
          return copy;
        }
        return [data as CrmWorkflowRecord, ...prev];
      });
      return data;
    },
    [ispId]
  );

  /** Atualiza status — apenas UPDATE, nunca delete */
  const updateStatus = useCallback(
    async (clienteId: number, status: WorkflowStatus) => {
      if (!ispId) throw new Error("No ISP");

      const data = await callCrmApi({
        action: "upsert_workflow",
        isp_id: ispId,
        cliente_id: clienteId,
        status_workflow: status,
      });
      setRecords((prev) => {
        const idx = prev.findIndex((r) => r.cliente_id === clienteId);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = data as CrmWorkflowRecord;
          return copy;
        }
        return [data as CrmWorkflowRecord, ...prev];
      });
      return data;
    },
    [ispId]
  );

  /** Atualiza tags */
  const updateTags = useCallback(
    async (clienteId: number, tags: string[]) => {
      if (!ispId) throw new Error("No ISP");

      const data = await callCrmApi({
        action: "upsert_workflow",
        isp_id: ispId,
        cliente_id: clienteId,
        tags,
      });
      setRecords((prev) =>
        prev.map((r) =>
          r.cliente_id === clienteId ? (data as CrmWorkflowRecord) : r
        )
      );
      return data;
    },
    [ispId]
  );

  /** Atualiza owner */
  const updateOwner = useCallback(
    async (clienteId: number, ownerUserId: string | null) => {
      if (!ispId) throw new Error("No ISP");

      const data = await callCrmApi({
        action: "upsert_workflow",
        isp_id: ispId,
        cliente_id: clienteId,
        owner_user_id: ownerUserId,
      });
      setRecords((prev) =>
        prev.map((r) =>
          r.cliente_id === clienteId ? (data as CrmWorkflowRecord) : r
        )
      );
      return data;
    },
    [ispId]
  );

  const workflowMap = new Map(records.map((r) => [r.cliente_id, r]));

  return {
    records,
    isLoading,
    addToWorkflow,
    updateStatus,
    updateTags,
    updateOwner,
    workflowMap,
    refetch: fetchRecords,
  };
}
