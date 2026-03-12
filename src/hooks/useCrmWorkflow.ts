import { useCallback, useMemo } from "react";
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
  archived: boolean;
  archived_at: string | null;
  status_entered_at: string | null;
  score_snapshot: Record<string, number> | null;
}

export function useCrmWorkflow() {
  const { ispId } = useActiveIsp();
  const queryClient = useQueryClient();
  // Memoized para referência estável — evita recriar archiveWorkflow a cada render,
  // o que causaria o useEffect de auto-archive disparar em todo re-render do componente.
  const queryKey = useMemo(() => ["crm-workflow", ispId], [ispId]);

  const { data: records = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const data = await callCrmApi({ action: "fetch_workflow", isp_id: ispId });
      return (data as CrmWorkflowRecord[]) || [];
    },
    enabled: !!ispId,
    // refetchOnMount removido: herda global false (staleTime 8h cobre sessão completa).
    // F5 / reload: CacheRefreshGuard dispara refetchQueries explicitamente.
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
    async (clienteId: number, status: WorkflowStatus, scoreSnapshot?: Record<string, number>) => {
      if (!ispId) throw new Error("No ISP");
      const result = await upsertMutation.mutateAsync({
        action: "upsert_workflow",
        cliente_id: clienteId,
        status_workflow: status,
        ...(scoreSnapshot !== undefined ? { score_snapshot: scoreSnapshot } : {}),
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

  const archiveWorkflow = useCallback(
    async (clienteId: number) => {
      if (!ispId) throw new Error("No ISP");
      // Snapshot current record for rollback in case the backend call fails
      const snapshot = queryClient.getQueryData<CrmWorkflowRecord[]>(queryKey);
      // Optimistic: remove from cache immediately
      queryClient.setQueryData<CrmWorkflowRecord[]>(queryKey, (old = []) =>
        old.filter((r) => r.cliente_id !== clienteId)
      );
      try {
        // Persist
        await callCrmApi({ action: "archive_workflow", isp_id: ispId, cliente_id: clienteId });
        // Audit comment (fire-and-forget)
        callCrmApi({
          action: "add_comment",
          isp_id: ispId,
          cliente_id: clienteId,
          body: "Card arquivado automaticamente.",
          type: "status_change",
          meta: { archived: true },
        }).catch(console.error);
      } catch (err) {
        // Rollback optimistic removal so the card reappears
        if (snapshot) queryClient.setQueryData(queryKey, snapshot);
        throw err;
      }
    },
    [ispId, queryClient, queryKey]
  );

  // Memoized so consumers don't re-render on every query re-render
  const workflowMap = useMemo(
    () => new Map(records.map((r) => [r.cliente_id, r])),
    [records]
  );

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
    archiveWorkflow,
    workflowMap,
    refetch,
  };
}
