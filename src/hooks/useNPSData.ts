import { useQuery } from "@tanstack/react-query";
import { externalSupabase } from "@/integrations/supabase/external-client";

export interface NPSRespostaEnriquecida {
  cliente_id: number;
  nota: number;
  classificacao: "Promotor" | "Neutro" | "Detrator";
  tipo_nps: string;
  data_resposta: string;
  celular?: string;
  cpf?: string;
  cnpj?: string;
}

async function fetchNPSData(ispId: string): Promise<NPSRespostaEnriquecida[]> {
  const { data, error } = await externalSupabase
    .from("nps_check")
    .select("id_cliente, nota_numerica, nota, classificacao_nps, nps_type, origem, data_resposta, cpf_cnpj")
    .eq("isp_id", ispId)
    .not("data_resposta", "is", null)
    .order("data_resposta", { ascending: false })
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

  const normalizeCpfCnpj = (val: any): string | undefined => {
    if (!val) return undefined;
    const digits = String(val).replace(/\D/g, "");
    return digits.length >= 11 ? digits : undefined;
  };

  const transformed: NPSRespostaEnriquecida[] = (data || []).map((item: any) => {
    const rawNota = item.nota_numerica != null ? Number(item.nota_numerica) : Number(item.nota);
    const nota = (!isNaN(rawNota) && rawNota >= 0 && rawNota <= 10) ? rawNota : 0;
    const doc = normalizeCpfCnpj(item.cpf_cnpj);
    const rawId = item.id_cliente;
    const clienteIdNum = rawId != null ? Number(rawId) : NaN;

    return {
      cliente_id: !isNaN(clienteIdNum) ? clienteIdNum : 0,
      nota,
      classificacao: mapClassificacao(item.classificacao_nps, nota),
      tipo_nps: item.nps_type || item.origem || "",
      data_resposta: item.data_resposta || "",
      cpf: doc,
    };
  });

  console.log("✅ NPS total:", transformed.length);
  return transformed;
}

export function useNPSData(ispId: string) {
  const { data, isLoading } = useQuery({
    queryKey: ["nps-data", ispId],
    queryFn: () => fetchNPSData(ispId),
    enabled: !!ispId,
  });

  return { npsData: data ?? [], isLoading };
}
