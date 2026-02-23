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

  /** Adiciona cliente ao workflow (idempotent upsert) */
  const addToWorkflow = useCallback(
    async (clienteId: number, tags?: string[]) => {
      if (!ispId) throw new Error("No ISP");

      // Check if record already exists to preserve entered_workflow_at
      const existing = records.find(
        (r) => r.cliente_id === clienteId
      );

      const payload: any = {
        isp_id: ispId,
        cliente_id: clienteId,
        status_workflow: "em_tratamento" as WorkflowStatus,
        tags: tags || [],
        last_action_at: new Date().toISOString(),
      };

      // Only set entered_workflow_at on new records
      if (!existing) {
        payload.entered_workflow_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from("crm_workflow")
        .upsert(payload, { onConflict: "isp_id,cliente_id" })
        .select()
        .single();

      if (error) throw error;
      setRecords((prev) => {
        const filtered = prev.filter((r) => r.cliente_id !== clienteId);
        return [data as CrmWorkflowRecord, ...filtered];
      });
      return data;
    },
    [ispId, records]
  );

  /** Atualiza status com upsert idempotente */
  const updateStatus = useCallback(
    async (clienteId: number, status: WorkflowStatus) => {
      if (!ispId) throw new Error("No ISP");

      const existing = records.find((r) => r.cliente_id === clienteId);

      const payload: any = {
        isp_id: ispId,
        cliente_id: clienteId,
        status_workflow: status,
        last_action_at: new Date().toISOString(),
      };

      if (!existing) {
        payload.entered_workflow_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from("crm_workflow")
        .upsert(payload, { onConflict: "isp_id,cliente_id" })
        .select()
        .single();

      if (error) throw error;
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
    [ispId, records]
  );

  /** Atualiza tags */
  const updateTags = useCallback(
    async (clienteId: number, tags: string[]) => {
      if (!ispId) throw new Error("No ISP");

      const { data, error } = await supabase
        .from("crm_workflow")
        .upsert(
          {
            isp_id: ispId,
            cliente_id: clienteId,
            tags,
            last_action_at: new Date().toISOString(),
          },
          { onConflict: "isp_id,cliente_id" }
        )
        .select()
        .single();

      if (error) throw error;
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

      const { data, error } = await supabase
        .from("crm_workflow")
        .upsert(
          {
            isp_id: ispId,
            cliente_id: clienteId,
            owner_user_id: ownerUserId,
            last_action_at: new Date().toISOString(),
          },
          { onConflict: "isp_id,cliente_id" }
        )
        .select()
        .single();

      if (error) throw error;
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
