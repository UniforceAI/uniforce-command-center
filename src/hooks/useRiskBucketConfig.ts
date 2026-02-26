import { useState, useEffect, useCallback } from "react";
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
  const [config, setConfig] = useState<RiskBucketConfig>({ ...DEFAULTS, isp_id: ispId });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!ispId) return;

    const fetchConfig = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("crm-api", {
          body: { action: "fetch_risk_bucket_config", isp_id: ispId },
        });
        if (error) {
          console.warn("⚠️ useRiskBucketConfig fetch error:", error.message);
        }
        setConfig(data ? (data as RiskBucketConfig) : { ...DEFAULTS, isp_id: ispId });
      } catch (e: any) {
        console.warn("⚠️ useRiskBucketConfig fetch error:", e.message);
        setConfig({ ...DEFAULTS, isp_id: ispId });
      }
      setIsLoading(false);
    };

    fetchConfig();
  }, [ispId]);

  const saveConfig = useCallback(async (updates: Partial<Omit<RiskBucketConfig, "isp_id" | "id">>) => {
    const merged = { ...config, ...updates };

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
    setConfig(data as RiskBucketConfig);
    return data;
  }, [config, ispId]);

  /** Classifica um score no bucket correto */
  const getBucket = useCallback((score: number): RiskBucket => {
    if (score >= config.critical_min) return "CRÍTICO";
    if (score >= config.alert_min) return "ALERTA";
    return "OK";
  }, [config]);

  return { config, isLoading, saveConfig, getBucket };
}
