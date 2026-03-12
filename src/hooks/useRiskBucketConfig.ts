import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiveIsp } from "@/hooks/useActiveIsp";
import { callCrmApi } from "@/lib/crmApi";

export interface RiskBucketConfig {
  id?: string;
  isp_id: string;
  ok_max: number;
  alert_min: number;
  alert_max: number;
  critical_min: number;
}

const DEFAULTS: Omit<RiskBucketConfig, "isp_id"> = {
  ok_max: 39,
  alert_min: 40,
  alert_max: 69,
  critical_min: 70,
};

export type RiskBucket = "OK" | "ALERTA" | "CRÍTICO";

export function useRiskBucketConfig() {
  const { ispId } = useActiveIsp();
  const queryClient = useQueryClient();
  const queryKey = ["risk-bucket-config", ispId];

  const { data: config, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      try {
        const data = await callCrmApi({ action: "fetch_risk_bucket_config", isp_id: ispId });
        return data ? (data as RiskBucketConfig) : { ...DEFAULTS, isp_id: ispId };
      } catch (err: any) {
        console.warn("⚠️ useRiskBucketConfig fetch error:", err.message);
        return { ...DEFAULTS, isp_id: ispId };
      }
    },
    enabled: !!ispId,
    // refetchOnMount removido: herda global false (staleTime 8h cobre sessão completa).
    // F5 / reload: CacheRefreshGuard dispara refetchQueries explicitamente.
  });

  const currentConfig = config ?? { ...DEFAULTS, isp_id: ispId };

  const saveMutation = useMutation({
    mutationFn: async (updates: Partial<Omit<RiskBucketConfig, "isp_id" | "id">>) => {
      const merged = { ...currentConfig, ...updates };
      const data = await callCrmApi({
        action: "save_risk_bucket_config",
        isp_id: ispId,
        ok_max: merged.ok_max,
        alert_min: merged.alert_min,
        alert_max: merged.alert_max,
        critical_min: merged.critical_min,
      });
      if (data?.error) throw new Error(data.error);
      return data as RiskBucketConfig;
    },
    onSuccess: (newData) => {
      queryClient.setQueryData(queryKey, newData);
    },
  });

  const saveConfig = useCallback(
    async (updates: Partial<Omit<RiskBucketConfig, "isp_id" | "id">>) => {
      return saveMutation.mutateAsync(updates);
    },
    [saveMutation]
  );

  const getBucket = useCallback((score: number): RiskBucket => {
    if (score >= currentConfig.critical_min) return "CRÍTICO";
    if (score >= currentConfig.alert_min) return "ALERTA";
    return "OK";
  }, [currentConfig]);

  return { config: currentConfig, isLoading, isFetching, saveConfig, getBucket };
}
