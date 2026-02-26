import { useMemo, useCallback } from "react";
import { useChurnData, ChurnStatus } from "@/hooks/useChurnData";
import { useChamados } from "@/hooks/useChamados";
import { useChurnScoreConfig, calcScoreSuporteConfiguravel, calcScoreFinanceiroConfiguravel } from "@/contexts/ChurnScoreConfigContext";
import { useRiskBucketConfig, RiskBucket } from "@/hooks/useRiskBucketConfig";

/**
 * Hook centralizado para cálculo de score de churn.
 * TODAS as páginas devem usar este hook para garantir score consistente.
 */
export function useChurnScore() {
  const { churnStatus, churnEvents, isLoading, error } = useChurnData();
  const { chamados, getChamadosPorCliente } = useChamados();
  const { config } = useChurnScoreConfig();
  const { getBucket, config: bucketConfig, isLoading: bucketLoading } = useRiskBucketConfig();

  const chamadosPorClienteMap = useMemo(() => ({
    d30: getChamadosPorCliente(30),
    d90: getChamadosPorCliente(90),
  }), [getChamadosPorCliente]);

  const npsMap = useMemo(() => {
    const m = new Map<number, { nota: number; classificacao: string; data: string | null }>();
    churnStatus.forEach((c) => {
      if (c.nps_ultimo_score != null && c.nps_classificacao) {
        m.set(c.cliente_id, {
          nota: c.nps_ultimo_score,
          classificacao: c.nps_classificacao.toUpperCase(),
          data: (c as any).nps_data ?? null,
        });
      }
    });
    return m;
  }, [churnStatus]);

  const getScoreSuporteReal = useCallback((cliente: ChurnStatus): number => {
    // Usar dados reais de chamados; fallback para qtd do churn_status se não houver match
    const chamadoData30 = chamadosPorClienteMap.d30.get(cliente.cliente_id);
    const chamadoData90 = chamadosPorClienteMap.d90.get(cliente.cliente_id);
    const ch30 = chamadoData30?.chamados_periodo ?? cliente.qtd_chamados_30d ?? 0;
    const ch90 = chamadoData90?.chamados_periodo ?? cliente.qtd_chamados_90d ?? 0;
    return calcScoreSuporteConfiguravel(ch30, ch90, config);
  }, [chamadosPorClienteMap, config]);

  const getScoreNPSReal = useCallback((cliente: ChurnStatus): number => {
    const nps = npsMap.get(cliente.cliente_id);
    if (nps?.classificacao === "DETRATOR") return config.npsDetrator;
    return cliente.score_nps ?? 0;
  }, [npsMap, config]);

  /** Score total recalculado — fonte única de verdade */
  const getScoreTotalReal = useCallback((cliente: ChurnStatus): number => {
    const suporteReal = getScoreSuporteReal(cliente);
    const npsReal = getScoreNPSReal(cliente);
    const financeiro = calcScoreFinanceiroConfiguravel(cliente.dias_atraso, config);
    const qualidadeBase = 25;
    const qualidade = Math.round(((cliente.score_qualidade ?? 0) / qualidadeBase) * config.qualidade);
    const comportamental = Math.round(((cliente.score_comportamental ?? 0) / 20) * config.comportamental);
    return Math.max(0, Math.min(500, financeiro + suporteReal + comportamental + qualidade + npsReal));
  }, [getScoreSuporteReal, getScoreNPSReal, config]);

  /** Mapa rápido de cliente_id → { score, bucket } para lookups em qualquer página */
  const scoreMap = useMemo(() => {
    const m = new Map<number, { score: number; bucket: RiskBucket }>();
    churnStatus.forEach((c) => {
      const existing = m.get(c.cliente_id);
      const score = getScoreTotalReal(c);
      if (!existing || score > existing.score) {
        m.set(c.cliente_id, { score, bucket: getBucket(score) });
      }
    });
    return m;
  }, [churnStatus, getScoreTotalReal, getBucket]);

  return {
    churnStatus,
    churnEvents,
    isLoading: isLoading || bucketLoading,
    error,
    chamados,
    chamadosPorClienteMap,
    npsMap,
    config,
    getBucket,
    getScoreSuporteReal,
    getScoreNPSReal,
    getScoreTotalReal,
    scoreMap,
  };
}
