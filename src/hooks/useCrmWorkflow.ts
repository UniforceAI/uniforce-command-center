import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiveIsp } from "@/hooks/useActiveIsp";
import { callCrmApi } from "@/lib/crmApi";

export type WorkflowStatus = "em_tratamento" | "resolvido" | "perdido";

const STATUS_LABELS: Record<WorkflowStatus, string> = {
  em_tratamento: "Em Tratamento",
  resolvido: "Resolvido",
  perdido: "Perdido",
};

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
  const queryClient = useQueryClient();
  const queryKey = ["crm-workflow", ispId];

  const { data: records = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const data = await callCrmApi({ action: "fetch_workflow", isp_id: ispId });
      return (data as CrmWorkflowRecord[]) || [];
    },
    enabled: !!ispId,
    refetchOnMount: true,
  });

  const upsertMutation = useMutation({
    mutationFn: (payload: Record<string, any>) => callCrmApi({ ...payload, isp_id: ispId }),
    onSuccess: (newRecord: any) => {
      queryClient.setQueryData<CrmWorkflowRecord[]>(queryKey, (old = []) => {
        const idx = old.findIndex((r) => r.cliente_id === newRecord.cliente_id);
        if (idx >= 0) {
          const copy = [...old];
          copy[idx] = newRecord as CrmWorkflowRecord;
          return copy;
        }
        return [newRecord as CrmWorkflowRecord, ...old];
      });
    },
  });

  const addToWorkflow = useCallback(
    async (clienteId: number, tags?: string[]) => {
      if (!ispId) throw new Error("No ISP");
      const result = await upsertMutation.mutateAsync({
        action: "upsert_workflow",
        cliente_id: clienteId,
        status_workflow: "em_tratamento" as WorkflowStatus,
        tags: tags || [],
      });
      // Log action as a comment (fire-and-forget)
      callCrmApi({
        action: "add_comment",
        isp_id: ispId,
        cliente_id: clienteId,
        body: "Cliente adicionado ao fluxo de tratamento.",
        type: "status_change",
        meta: { new_status: "em_tratamento" },
      }).catch(console.error);
      return result;
    },
    [ispId, upsertMutation]
  );

  const updateStatus = useCallback(
    async (clienteId: number, status: WorkflowStatus) => {
      if (!ispId) throw new Error("No ISP");
      const result = await upsertMutation.mutateAsync({
        action: "upsert_workflow",
        cliente_id: clienteId,
        status_workflow: status,
      });
      // Log status change as a comment (fire-and-forget)
      callCrmApi({
        action: "add_comment",
        isp_id: ispId,
        cliente_id: clienteId,
        body: `Status alterado para: ${STATUS_LABELS[status]}`,
        type: "status_change",
        meta: { new_status: status },
      }).catch(console.error);
      return result;
    },
    [ispId, upsertMutation]
  );

  const updateTags = useCallback(
    async (clienteId: number, tags: string[]) => {
      if (!ispId) throw new Error("No ISP");
      return upsertMutation.mutateAsync({
        action: "upsert_workflow",
        cliente_id: clienteId,
        tags,
      });
    },
    [ispId, upsertMutation]
  );

  const updateOwner = useCallback(
    async (clienteId: number, ownerUserId: string | null) => {
      if (!ispId) throw new Error("No ISP");
      return upsertMutation.mutateAsync({
        action: "upsert_workflow",
        cliente_id: clienteId,
        owner_user_id: ownerUserId,
      });
    },
    [ispId, upsertMutation]
  );

  const workflowMap = new Map(records.map((r) => [r.cliente_id, r]));

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  return {
    records,
    isLoading,
    addToWorkflow,
    updateStatus,
    updateTags,
    updateOwner,
    workflowMap,
    refetch,
  };
}
