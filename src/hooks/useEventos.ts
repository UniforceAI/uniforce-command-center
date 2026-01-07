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

        // Buscar TODOS os eventos vencidos primeiro (prioridade)
        const { data: vencidosData, error: vencidosError } = await externalSupabase
          .from("eventos")
          .select("*")
          .eq("isp_id", EVENTOS_ISP_ID)
          .eq("vencido", true)
          .order("dias_atraso", { ascending: false });

        if (vencidosError) throw vencidosError;

        // Buscar eventos não-vencidos (limite maior para ter contexto)
        const { data: outrosData, error: outrosError } = await externalSupabase
          .from("eventos")
          .select("*")
          .eq("isp_id", EVENTOS_ISP_ID)
          .or("vencido.is.null,vencido.eq.false")
          .order("event_datetime", { ascending: false })
          .range(0, 4999);

        if (outrosError) throw outrosError;

        // Combinar: vencidos primeiro + outros
        const allData = [...(vencidosData || []), ...(outrosData || [])];
        
        // Remover duplicatas por ID
        const uniqueData = Array.from(
          new Map(allData.map(item => [item.id, item])).values()
        );

        console.log("📊 EVENTOS CARREGADOS:", {
          vencidos: vencidosData?.length || 0,
          outros: outrosData?.length || 0,
          total: uniqueData.length,
          clientesVencidos: new Set(vencidosData?.map(e => e.cliente_id) || []).size
        });

        if (uniqueData.length > 0) {
          setColumns(Object.keys(uniqueData[0]));
          setEventos(uniqueData as Evento[]);
        } else {
          setEventos([]);
        }
        
      } catch (err: any) {
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
