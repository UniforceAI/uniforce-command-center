import { useState, useEffect } from "react";
import { externalSupabase, EVENTOS_ISP_ID } from "@/integrations/supabase/eventos-client";
import { Evento } from "@/types/evento";
import { useToast } from "@/hooks/use-toast";

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
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [columns, setColumns] = useState<string[]>([]);

  useEffect(() => {
    const fetchEventos = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log(`🔄 Buscando eventos (isp_id=${EVENTOS_ISP_ID})...`);

        // Buscar em batches com colunas específicas para evitar timeout
        const BATCH_SIZE = 1000;
        const MAX_BATCHES = 5; // Máximo 5000 registros
        let allData: any[] = [];
        let hasMore = true;

        for (let i = 0; i < MAX_BATCHES && hasMore; i++) {
          const start = i * BATCH_SIZE;
          const end = start + BATCH_SIZE - 1;

          console.log(`📥 Eventos batch ${i + 1} (${start}-${end})...`);

          const { data, error: batchError } = await externalSupabase
            .from("eventos")
            .select(ESSENTIAL_COLUMNS)
            .eq("isp_id", EVENTOS_ISP_ID)
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

        // Remover duplicatas por ID
        const uniqueData = Array.from(
          new Map(allData.map(item => [item.id, item])).values()
        );

        if (uniqueData.length > 0) {
          setColumns(Object.keys(uniqueData[0]));
          console.log("📋 Amostra evento:", JSON.stringify(uniqueData[0]).substring(0, 200));
          
          const vencidos = uniqueData.filter((e: any) => 
            e.vencido === true || String(e.vencido).toLowerCase() === "true"
          );
          console.log(`📊 Eventos vencidos: ${vencidos.length}`);
          
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
  }, [toast]);

  return { eventos, isLoading, error, columns };
}
