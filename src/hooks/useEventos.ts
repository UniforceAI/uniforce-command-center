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
        console.log(`🏢 Filtro multi-tenant: isp_id = ${EVENTOS_ISP_ID}`);

        // Primeiro, obter contagem total
        const { count: totalCount, error: countError } = await externalSupabase
          .from("eventos")
          .select("*", { count: "exact", head: true })
          .eq("isp_id", EVENTOS_ISP_ID);

        if (countError) throw countError;

        console.log(`📊 Total de eventos no banco (${EVENTOS_ISP_ID}): ${totalCount}`);

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
            .order("created_at", { ascending: false })
            .range(start, end);

          if (error) throw error;
          
          if (data && data.length > 0) {
            allData = [...allData, ...data];
            
            // Salvar colunas do primeiro registro
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
