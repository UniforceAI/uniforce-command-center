import { useState, useEffect } from "react";
import { externalSupabase } from "@/integrations/supabase/external-client";
import { Evento } from "@/types/evento";
import { useToast } from "@/hooks/use-toast";
import { useActiveIsp } from "@/hooks/useActiveIsp";

// Colunas essenciais - evitar select("*") que causa timeout em tabelas grandes
const ESSENTIAL_COLUMNS = [
  "id", "isp_id", "event_type", "event_datetime", "created_at", "updated_at",
  "cliente_id", "cliente_nome", "cliente_email", "cliente_celular",
  "cliente_cidade", "cliente_uf", "cliente_bairro", "cliente_segmento",
  "plano_nome", "valor_mensalidade", "dia_vencimento",
  "servico_status", "status_contrato", "data_instalacao",
  "cobranca_status", "data_vencimento", "data_pagamento",
  "valor_cobranca", "valor_pago", "metodo_cobranca",
  "dias_atraso", "vencido",
  "ultimo_atendimento",
  "nps_score", "nps_comment",
  "churn_risk_score", "churn_risk_bucket",
  "alerta_tipo", "acao_recomendada_1", "acao_recomendada_2", "acao_recomendada_3",
  "ltv_meses_estimado", "ltv_reais_estimado",
  "geo_lat", "geo_lng",
  "downtime_min_24h",
  "rx_dbm", "tx_dbm", "snr_db",
  "instancia_isp"
].join(",");

export function useEventos() {
  const { toast } = useToast();
  const { ispId } = useActiveIsp();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [columns, setColumns] = useState<string[]>([]);

  useEffect(() => {
    const fetchEventos = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log(`🔄 Buscando eventos (isp_id=${ispId})...`);

        const BATCH_SIZE = 1000;
        const MAX_BATCHES = 10; // Aumentado para cobrir ISPs com mais dados
        let allData: any[] = [];
        let hasMore = true;

        for (let i = 0; i < MAX_BATCHES && hasMore; i++) {
          const start = i * BATCH_SIZE;
          const end = start + BATCH_SIZE - 1;

          console.log(`📥 Eventos batch ${i + 1} (${start}-${end})...`);

          const { data, error: batchError } = await externalSupabase
            .from("eventos")
            .select(ESSENTIAL_COLUMNS)
            .eq("isp_id", ispId)
            .order("event_datetime", { ascending: false })
            .range(start, end);

          if (batchError) {
            console.error(`❌ Erro batch ${i + 1}:`, batchError);
            throw batchError;
          }

          if (data && data.length > 0) {
            allData = [...allData, ...data];
            hasMore = data.length === BATCH_SIZE;
          } else {
            hasMore = false;
          }
        }

        console.log(`✅ Total eventos: ${allData.length}`);

        const uniqueData = Array.from(
          new Map(allData.map(item => [item.id, item])).values()
        );

        if (uniqueData.length > 0) {
          setColumns(Object.keys(uniqueData[0]));
          console.log("📋 Amostra evento:", JSON.stringify(uniqueData[0]).substring(0, 500));
          
          // DEBUG DETALHADO: campos financeiros
          const cobrancaStatuses = new Map<string, number>();
          const vencidoValues = new Map<string, number>();
          const alertaTipos = new Map<string, number>();
          let comValorCobranca = 0;
          let comValorPago = 0;
          let comDiasAtraso = 0;
          let comChurnScore = 0;
          let comGeoLat = 0;
          let comNps = 0;
          
          uniqueData.forEach((e: any) => {
            const cs = String(e.cobranca_status || "null");
            cobrancaStatuses.set(cs, (cobrancaStatuses.get(cs) || 0) + 1);
            const v = String(e.vencido);
            vencidoValues.set(v, (vencidoValues.get(v) || 0) + 1);
            if (e.alerta_tipo) alertaTipos.set(e.alerta_tipo, (alertaTipos.get(e.alerta_tipo) || 0) + 1);
            if (e.valor_cobranca && e.valor_cobranca > 0) comValorCobranca++;
            if (e.valor_pago && e.valor_pago > 0) comValorPago++;
            if (e.dias_atraso && e.dias_atraso > 0) comDiasAtraso++;
            if (e.churn_risk_score && e.churn_risk_score > 0) comChurnScore++;
            if (e.geo_lat && e.geo_lat !== 0) comGeoLat++;
            if (e.nps_score !== null && e.nps_score !== undefined) comNps++;
          });
          
          console.log("📊 DIAGNÓSTICO COMPLETO:", {
            total: uniqueData.length,
            cobranca_status: Object.fromEntries(cobrancaStatuses),
            vencido_values: Object.fromEntries(vencidoValues),
            alerta_tipos: Object.fromEntries(alertaTipos),
            comValorCobranca,
            comValorPago,
            comDiasAtraso,
            comChurnScore,
            comGeoLat,
            comNps,
          });
          
          // Amostra de 3 eventos com dados financeiros
          const amostraFinanceira = uniqueData
            .filter((e: any) => e.valor_cobranca || e.dias_atraso)
            .slice(0, 3);
          console.log("💰 Amostra financeira:", JSON.stringify(amostraFinanceira).substring(0, 1000));
          
          setEventos(uniqueData as Evento[]);
        } else {
          console.log("⚠️ Nenhum evento encontrado");
          setEventos([]);
        }
        
      } catch (err: any) {
        console.error("❌ Erro eventos:", err);
        setError(err.message);
        toast({
          title: "Erro ao carregar eventos",
          description: err.message || "Não foi possível carregar os dados.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchEventos();
  }, [toast, ispId]);

  return { eventos, isLoading, error, columns };
}
