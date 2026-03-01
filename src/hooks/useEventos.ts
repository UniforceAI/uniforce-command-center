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
  "dias_atraso", "vencido", "data_cancelamento",
  "ultimo_atendimento",
  "nps_score", "nps_comment",
  "churn_risk_score", "churn_risk_bucket",
  "alerta_tipo", "acao_recomendada_1", "acao_recomendada_2", "acao_recomendada_3",
  "ltv_meses_estimado", "ltv_reais_estimado",
  "geo_lat", "geo_lng",
  "downtime_min_24h",
  "rx_dbm", "tx_dbm", "snr_db",
  "instancia_isp",
  "filial_id"
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

        // Busca 1: snapshots recentes (últimos 7 dias de dados) para KPIs gerais
        const BATCH_SIZE = 1000;
        const MAX_BATCHES = 10;
        let allData: any[] = [];
        let hasMore = true;

        for (let i = 0; i < MAX_BATCHES && hasMore; i++) {
          const start = i * BATCH_SIZE;
          const end = start + BATCH_SIZE - 1;

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

        // Busca 2: TODOS os eventos vencidos (dias_atraso > 0) independente da data
        // Necessário pois inadimplentes têm data_vencimento no passado e ficam fora dos batches recentes
        let vencidosData: any[] = [];
        let vencidosHasMore = true;
        let vencidosPage = 0;
        const VENCIDOS_MAX_BATCHES = 10;

        while (vencidosHasMore && vencidosPage < VENCIDOS_MAX_BATCHES) {
          const start = vencidosPage * BATCH_SIZE;
          const end = start + BATCH_SIZE - 1;

          const { data, error: vErr } = await externalSupabase
            .from("eventos")
            .select(ESSENTIAL_COLUMNS)
            .eq("isp_id", ispId)
            .gt("dias_atraso", 0)
            .order("dias_atraso", { ascending: false })
            .range(start, end);

          if (vErr) {
            console.warn("⚠️ Erro ao buscar vencidos:", vErr.message);
            break;
          }

          if (data && data.length > 0) {
            vencidosData = [...vencidosData, ...data];
            vencidosHasMore = data.length === BATCH_SIZE;
          } else {
            vencidosHasMore = false;
          }
          vencidosPage++;
        }

        console.log(`✅ Eventos recentes: ${allData.length} | Vencidos: ${vencidosData.length}`);

        // Mesclar e deduplicar por id
        const merged = [...allData, ...vencidosData];

        console.log(`✅ Total eventos recentes: ${allData.length} | Vencidos extras: ${vencidosData.length}`);

        const uniqueData = Array.from(
          new Map(merged.map(item => [item.id, item])).values()
        );

        if (uniqueData.length > 0) {
          setColumns(Object.keys(uniqueData[0]));
          
          // Log diagnóstico
          const comDiasAtraso = uniqueData.filter((e: any) => e.dias_atraso && e.dias_atraso > 0).length;
          const clientesVencidosUnicos = new Set(
            uniqueData.filter((e: any) => e.dias_atraso && e.dias_atraso > 0).map((e: any) => e.cliente_id)
          ).size;
          console.log("📊 DIAGNÓSTICO:", {
            total_registros: uniqueData.length,
            registros_com_atraso: comDiasAtraso,
            clientes_unicos_vencidos: clientesVencidosUnicos,
          });
          
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
