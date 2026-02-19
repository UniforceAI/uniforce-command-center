import { useMemo } from "react";
import { useEventos } from "@/hooks/useEventos";

// ChurnStatus derivado a partir dos campos da tabela `eventos`
export interface ChurnStatus {
  id: string;
  isp_id: string;
  cliente_id: number;
  cliente_nome: string;
  cliente_cidade: string;
  cliente_uf: string;
  cliente_bairro?: string;
  plano_nome: string;
  valor_mensalidade: number;
  status_churn: "ativo" | "risco" | "cancelado";
  churn_risk_score?: number;
  churn_risk_bucket?: string;
  dias_em_risco?: number;
  data_cancelamento?: string;
  motivo_risco_principal?: string;
  qtd_chamados_30d?: number;
  qtd_chamados_90d?: number;
  nps_ultimo_score?: number;
  dias_atraso?: number;
  ltv_estimado?: number;
  tempo_cliente_meses?: number;
  score_financeiro?: number;
  score_atendimento?: number;
  score_nps?: number;
  score_uso?: number;
  // campos extras da tabela eventos
  servico_status?: string;
  status_contrato?: string;
  cobranca_status?: string;
  alerta_tipo?: string;
  acao_recomendada_1?: string;
  acao_recomendada_2?: string;
  acao_recomendada_3?: string;
  data_instalacao?: string;
  event_datetime?: string;
  created_at?: string;
  [key: string]: any;
}

export interface ChurnEvent {
  id: string;
  isp_id: string;
  cliente_id: number;
  event_type: string;
  event_date: string;
  motivo?: string;
  detalhes?: string;
  created_at?: string;
  [key: string]: any;
}

/**
 * Deriva status_churn a partir dos campos disponíveis na tabela eventos:
 * - "cancelado": status_contrato === "Cancelado" OU servico_status === "Cancelado"
 * - "risco": churn_risk_bucket in ["Alto","Crítico"] OU (dias_atraso > 30 e cobranca_status !== "Pago")
 * - "ativo": demais
 */
function deriveStatusChurn(e: any): "ativo" | "risco" | "cancelado" {
  const contrato = (e.status_contrato || "").toLowerCase();
  const servico = (e.servico_status || "").toLowerCase();
  if (contrato === "cancelado" || servico === "cancelado") return "cancelado";

  const bucket = e.churn_risk_bucket || "";
  const diasAtraso = e.dias_atraso || 0;
  const vencido = e.vencido === true;

  if (bucket === "Alto" || bucket === "Crítico") return "risco";
  if (diasAtraso > 30 && vencido) return "risco";
  if (contrato === "suspenso" || servico === "bloqueado" || contrato === "bloqueado") return "risco";

  return "ativo";
}

/**
 * Calcula tempo de cliente em meses a partir de data_instalacao
 */
function calcTempoMeses(dataInstalacao?: string): number | undefined {
  if (!dataInstalacao) return undefined;
  const inst = new Date(dataInstalacao);
  const now = new Date();
  const diff = (now.getFullYear() - inst.getFullYear()) * 12 + (now.getMonth() - inst.getMonth());
  return Math.max(0, diff);
}

/**
 * Hook que converte eventos em ChurnStatus derivados.
 * Usa a tabela `eventos` como fonte de verdade, pois churn_status está vazia.
 * Deduplica por cliente_id (mantém o evento mais recente).
 */
export function useChurnData() {
  const { eventos, isLoading, error } = useEventos();

  const churnStatus = useMemo((): ChurnStatus[] => {
    if (!eventos || eventos.length === 0) return [];

    // Deduplica por cliente_id: mantém o mais recente (eventos já vêm ordenados por event_datetime desc)
    const seen = new Map<number, any>();
    for (const e of eventos) {
      if (!seen.has(e.cliente_id)) {
        seen.set(e.cliente_id, e);
      }
    }

    const uniqueEventos = Array.from(seen.values());
    console.log(`🔄 useChurnData: ${uniqueEventos.length} clientes únicos de ${eventos.length} eventos`);

    return uniqueEventos.map((e): ChurnStatus => {
      const status_churn = deriveStatusChurn(e);
      const tempoMeses = calcTempoMeses(e.data_instalacao);

      return {
        id: e.id,
        isp_id: e.isp_id,
        cliente_id: e.cliente_id,
        cliente_nome: e.cliente_nome || "—",
        cliente_cidade: e.cliente_cidade || "",
        cliente_uf: e.cliente_uf || "",
        cliente_bairro: e.cliente_bairro,
        plano_nome: e.plano_nome || "—",
        valor_mensalidade: e.valor_mensalidade || 0,
        status_churn,
        churn_risk_score: e.churn_risk_score ?? undefined,
        churn_risk_bucket: e.churn_risk_bucket ?? undefined,
        dias_em_risco: e.dias_atraso ? Math.max(0, Math.floor(e.dias_atraso)) : undefined,
        data_cancelamento: status_churn === "cancelado" ? (e.event_datetime || e.created_at) : undefined,
        motivo_risco_principal: e.alerta_tipo || e.acao_recomendada_1 || undefined,
        qtd_chamados_30d: undefined,
        qtd_chamados_90d: undefined,
        nps_ultimo_score: e.nps_score ?? undefined,
        dias_atraso: e.dias_atraso ?? undefined,
        ltv_estimado: e.ltv_reais_estimado ?? undefined,
        tempo_cliente_meses: tempoMeses,
        score_financeiro: e.dias_atraso != null ? Math.max(0, 100 - Math.min(100, e.dias_atraso * 2)) : undefined,
        score_atendimento: undefined,
        score_nps: e.nps_score != null ? Math.round((e.nps_score / 10) * 100) : undefined,
        score_uso: undefined,
        // extras
        servico_status: e.servico_status,
        status_contrato: e.status_contrato,
        cobranca_status: e.cobranca_status,
        alerta_tipo: e.alerta_tipo,
        acao_recomendada_1: e.acao_recomendada_1,
        acao_recomendada_2: e.acao_recomendada_2,
        acao_recomendada_3: e.acao_recomendada_3,
        data_instalacao: e.data_instalacao,
        event_datetime: e.event_datetime,
        created_at: e.created_at,
      };
    });
  }, [eventos]);

  // ChurnEvents: usa os próprios eventos como histórico do cliente
  const churnEvents = useMemo((): ChurnEvent[] => {
    return eventos.map((e): ChurnEvent => ({
      id: e.id,
      isp_id: e.isp_id,
      cliente_id: e.cliente_id,
      event_type: e.event_type || "SNAPSHOT",
      event_date: e.event_datetime || e.created_at || "",
      motivo: e.alerta_tipo || undefined,
      detalhes: [e.acao_recomendada_1, e.acao_recomendada_2, e.acao_recomendada_3].filter(Boolean).join(" | ") || undefined,
      created_at: e.created_at,
      cobranca_status: e.cobranca_status,
      valor_cobranca: e.valor_cobranca,
      dias_atraso: e.dias_atraso,
      churn_risk_score: e.churn_risk_score,
      churn_risk_bucket: e.churn_risk_bucket,
    }));
  }, [eventos]);

  const summary = useMemo(() => {
    const ativos = churnStatus.filter(c => c.status_churn === "ativo").length;
    const risco = churnStatus.filter(c => c.status_churn === "risco").length;
    const cancelados = churnStatus.filter(c => c.status_churn === "cancelado").length;
    console.log(`📊 useChurnData summary: ${ativos} ativos, ${risco} risco, ${cancelados} cancelados`);
    return { ativos, risco, cancelados };
  }, [churnStatus]);

  return { churnStatus, churnEvents, isLoading, error, summary };
}
