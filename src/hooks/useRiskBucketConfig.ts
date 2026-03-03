import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveIsp } from "@/hooks/useActiveIsp";

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

  const { data: config, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("crm-api", {
        body: { action: "fetch_risk_bucket_config", isp_id: ispId },
      });
      if (error) console.warn("⚠️ useRiskBucketConfig fetch error:", error.message);
      return data ? (data as RiskBucketConfig) : { ...DEFAULTS, isp_id: ispId };
    },
    enabled: !!ispId,
  });

  const currentConfig = config ?? { ...DEFAULTS, isp_id: ispId };

  const saveMutation = useMutation({
    mutationFn: async (updates: Partial<Omit<RiskBucketConfig, "isp_id" | "id">>) => {
      const merged = { ...currentConfig, ...updates };
      const { data, error } = await supabase.functions.invoke("crm-api", {
        body: {
          action: "save_risk_bucket_config",
          isp_id: ispId,
          ok_max: merged.ok_max,
          alert_min: merged.alert_min,
          alert_max: merged.alert_max,
          critical_min: merged.critical_min,
        },
      });
      if (error) throw error;
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

  return { config: currentConfig, isLoading, saveConfig, getBucket };
}
