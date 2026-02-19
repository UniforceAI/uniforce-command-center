import { useState, useEffect } from "react";
import { externalSupabase } from "@/integrations/supabase/external-client";

export interface NPSRespostaEnriquecida {
  cliente_id: number;
  nota: number;
  classificacao: "Promotor" | "Neutro" | "Detrator";
  tipo_nps: string;
  data_resposta: string;
}

export function useNPSData(ispId: string) {
  const [npsData, setNpsData] = useState<NPSRespostaEnriquecida[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!ispId) return;

    const fetch = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await externalSupabase
          .from("nps_check")
          .select("id_cliente, cliente_id, nota_numerica, nota, classificacao_nps, nps_type, origem, data_resposta")
          .eq("isp_id", ispId)
          .not("data_resposta", "is", null)
          .limit(5000);

        if (error) throw error;

        const calcClassificacao = (nota: number): "Promotor" | "Neutro" | "Detrator" => {
          if (nota <= 6) return "Detrator";
          if (nota <= 8) return "Neutro";
          return "Promotor";
        };

        const mapClassificacao = (classif: string, nota: number): "Promotor" | "Neutro" | "Detrator" => {
          const lower = (classif || "").toLowerCase().trim();
          if (lower === "promotor") return "Promotor";
          if (lower === "neutro") return "Neutro";
          if (lower === "detrator") return "Detrator";
          return calcClassificacao(nota);
        };

        const transformed: NPSRespostaEnriquecida[] = (data || []).map((item: any) => {
          const rawNota = item.nota_numerica != null ? Number(item.nota_numerica) : Number(item.nota);
          const nota = (!isNaN(rawNota) && rawNota >= 0 && rawNota <= 10) ? rawNota : 0;
          return {
            cliente_id: item.id_cliente || item.cliente_id || 0,
            nota,
            classificacao: mapClassificacao(item.classificacao_nps, nota),
            tipo_nps: item.nps_type || item.origem || "",
            data_resposta: item.data_resposta || "",
          };
        }).filter(r => r.cliente_id > 0);

        setNpsData(transformed);
      } catch (e) {
        console.error("useNPSData error:", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetch();
  }, [ispId]);

  return { npsData, isLoading };
}
