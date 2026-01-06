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

        // Buscar todos os eventos do isp_id configurado
        const { data, error: fetchError } = await externalSupabase
          .from("eventos")
          .select("*")
          .eq("isp_id", EVENTOS_ISP_ID)
          .order("event_datetime", { ascending: false });

        if (fetchError) throw fetchError;

        if (data && data.length > 0) {
          setColumns(Object.keys(data[0]));
          setEventos(data as Evento[]);
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
