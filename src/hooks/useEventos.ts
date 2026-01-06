import { useState, useEffect } from "react";
import { externalSupabase, EVENTOS_ISP_ID } from "@/integrations/supabase/eventos-client";
import { Evento } from "@/types/evento";
import { useToast } from "@/hooks/use-toast";

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
        
        console.log("🔄 Buscando eventos do Supabase externo...");
        console.log(`🏢 ISP_ID configurado: ${EVENTOS_ISP_ID}`);

        // Primeiro, buscar SEM filtro para debug
        console.log("🔍 Teste 1: Buscando SEM filtro de isp_id...");
        const { data: testData, error: testError } = await externalSupabase
          .from("eventos")
          .select("*")
          .limit(5);

        if (testError) {
          console.error("❌ Erro no teste sem filtro:", testError);
        } else {
          console.log(`✅ Teste sem filtro: ${testData?.length} registros`);
          if (testData && testData.length > 0) {
            console.log("📋 ISP_IDs disponíveis:", [...new Set(testData.map(e => e.isp_id))]);
            console.log("📋 Exemplo de registro:", testData[0]);
            console.log("📋 COLUNAS:", Object.keys(testData[0]));
          }
        }

        // Agora buscar com filtro
        console.log(`🔍 Teste 2: Buscando com isp_id = "${EVENTOS_ISP_ID}"...`);
        
        const { count: totalCount, error: countError } = await externalSupabase
          .from("eventos")
          .select("*", { count: "exact", head: true })
          .eq("isp_id", EVENTOS_ISP_ID);

        if (countError) {
          console.error("❌ Erro ao contar:", countError);
          throw countError;
        }

        console.log(`📊 Total de eventos para ${EVENTOS_ISP_ID}: ${totalCount}`);

        // Se não encontrou com filtro mas encontrou sem, o isp_id pode estar errado
        if (totalCount === 0 && testData && testData.length > 0) {
          console.warn("⚠️ Dados existem mas não para este isp_id!");
          console.warn("⚠️ ISP_IDs encontrados:", [...new Set(testData.map(e => e.isp_id))]);
          
          // Usar dados sem filtro para debug
          setColumns(Object.keys(testData[0]));
          setEventos(testData as Evento[]);
          setIsLoading(false);
          return;
        }

        // Buscar em batches de 1000
        const BATCH_SIZE = 1000;
        const totalBatches = Math.ceil((totalCount || 0) / BATCH_SIZE);
        let allData: any[] = [];

        for (let i = 0; i < totalBatches; i++) {
          const start = i * BATCH_SIZE;
          const end = start + BATCH_SIZE - 1;
          
          console.log(`📥 Buscando batch ${i + 1}/${totalBatches} (${start}-${end})...`);
          
          const { data, error } = await externalSupabase
            .from("eventos")
            .select("*")
            .eq("isp_id", EVENTOS_ISP_ID)
            .order("event_datetime", { ascending: false })
            .range(start, end);

          if (error) throw error;
          
          if (data && data.length > 0) {
            allData = [...allData, ...data];
            
            if (i === 0) {
              const cols = Object.keys(data[0]);
              setColumns(cols);
              console.log("📋 COLUNAS DA TABELA EVENTOS:", cols);
              console.log("📋 EXEMPLO DE REGISTRO:", data[0]);
            }
          }
        }

        console.log(`✅ Total de eventos buscados: ${allData.length}`);
        setEventos(allData as Evento[]);
        
      } catch (err: any) {
        console.error("❌ Erro ao buscar eventos:", err);
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
