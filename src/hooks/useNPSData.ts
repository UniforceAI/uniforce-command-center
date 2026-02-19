import { useState, useEffect } from "react";
import { externalSupabase } from "@/integrations/supabase/external-client";

export interface NPSRespostaEnriquecida {
  cliente_id: number;
  nota: number;
  classificacao: "Promotor" | "Neutro" | "Detrator";
  tipo_nps: string;
  data_resposta: string;
  // Campos para match alternativo
  celular?: string;
  cpf?: string;
  cnpj?: string;
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
          .select("id_cliente, cliente_id, nota_numerica, nota, classificacao_nps, nps_type, origem, data_resposta, celular, telefone, cpf, cnpj, cliente_celular, cliente_cpf, cliente_cnpj, phone, documento")
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

        // Normalize phone: remove non-digits, keep last 11 digits (br format)
        const normalizePhone = (val: any): string | undefined => {
          if (!val) return undefined;
          const digits = String(val).replace(/\D/g, "");
          return digits.length >= 8 ? digits.slice(-11) : undefined;
        };

        const normalizeCpfCnpj = (val: any): string | undefined => {
          if (!val) return undefined;
          const digits = String(val).replace(/\D/g, "");
          return digits.length >= 11 ? digits : undefined;
        };

        const transformed: NPSRespostaEnriquecida[] = (data || []).map((item: any) => {
          const rawNota = item.nota_numerica != null ? Number(item.nota_numerica) : Number(item.nota);
          const nota = (!isNaN(rawNota) && rawNota >= 0 && rawNota <= 10) ? rawNota : 0;

          const phone = normalizePhone(item.celular) ||
                        normalizePhone(item.telefone) ||
                        normalizePhone(item.cliente_celular) ||
                        normalizePhone(item.phone);

          const doc = normalizeCpfCnpj(item.cpf) ||
                      normalizeCpfCnpj(item.cnpj) ||
                      normalizeCpfCnpj(item.cliente_cpf) ||
                      normalizeCpfCnpj(item.cliente_cnpj) ||
                      normalizeCpfCnpj(item.documento);

          return {
            cliente_id: item.id_cliente || item.cliente_id || 0,
            nota,
            classificacao: mapClassificacao(item.classificacao_nps, nota),
            tipo_nps: item.nps_type || item.origem || "",
            data_resposta: item.data_resposta || "",
            celular: phone,
            cpf: doc,
          };
        });

        // Log sample to debug matching
        console.log("🔍 NPS sample (primeiros 3):", transformed.slice(0, 3));
        console.log("🔍 NPS total:", transformed.length);

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

