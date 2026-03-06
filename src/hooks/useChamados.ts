import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { externalSupabase } from "@/integrations/supabase/external-client";
import { useActiveIsp } from "@/hooks/useActiveIsp";

export interface ChamadoData {
  id_cliente: string | number;
  qtd_chamados: number;
  protocolo: string;
  data_abertura: string;
  ultima_atualizacao: string;
  responsavel: string;
  setor: string;
  categoria: string;
  motivo_contato: string;
  origem: string;
  solicitante: string;
  urgencia: string;
  status: string;
  dias_desde_ultimo: number | null;
  tempo_atendimento: string;
  classificacao: string;
  insight: string;
  chamados_anteriores: string;
  id: string;
}

export interface ChamadosPorCliente {
  cliente_id: number;
  total_chamados: number;
  chamados_periodo: number;
  reincidente: boolean;
  ultimo_chamado: string;
  setores: string[];
  categorias: string[];
}

const CHAMADOS_COLUMNS = [
  "id", "isp_id", "id_cliente", "qtd_chamados", "protocolo",
  "data_abertura", "ultima_atualizacao", "created_at",
  "responsavel", "setor", "categoria", "motivo_contato",
  "origem", "solicitante", "urgencia", "status",
  "dias_desde_ultimo", "tempo_atendimento", "classificacao",
  "insight", "chamados_anteriores",
].join(",");

const BATCH_SIZE = 1000;
const MAX_RECORDS = 15_000; // safety cap (15 batches × 1000)
const PARALLEL_LIMIT = 6;   // max simultaneous requests per round

async function fetchChamados(ispId: string): Promise<ChamadoData[]> {
  // Step 1: lightweight HEAD to get total count (no body returned)
  const { count, error: countErr } = await externalSupabase
    .from("chamados")
    .select("*", { count: "exact", head: true })
    .eq("isp_id", ispId);

  if (countErr || count === null) {
    console.warn("⚠️ COUNT falhou para chamados — usando busca sequencial");
    return fetchChamadosSequential(ispId);
  }

  const total = Math.min(count, MAX_RECORDS);
  const totalPages = Math.ceil(total / BATCH_SIZE);
  const allData: any[] = [];

  // Step 2: fetch all pages in parallel chunks (PARALLEL_LIMIT at a time)
  for (let start = 0; start < totalPages; start += PARALLEL_LIMIT) {
    const end = Math.min(start + PARALLEL_LIMIT, totalPages);
    const results = await Promise.all(
      Array.from({ length: end - start }, (_, i) => start + i).map(page =>
        externalSupabase
          .from("chamados")
          .select(CHAMADOS_COLUMNS)
          .eq("isp_id", ispId)
          .order("created_at", { ascending: false })
          .range(page * BATCH_SIZE, Math.min((page + 1) * BATCH_SIZE - 1, total - 1))
      )
    );
    for (const { data, error } of results) {
      if (error) throw error;
      if (data?.length) allData.push(...data);
    }
  }

  // Deduplicate by protocolo
  const uniqueMap = new Map<string, any>();
  allData.forEach(c => {
    if (!uniqueMap.has(c.protocolo)) uniqueMap.set(c.protocolo, c);
  });
  const uniqueData = Array.from(uniqueMap.values());
  console.log(`✅ Chamados: ${uniqueData.length} únicos (${totalPages} páginas em paralelo) para ${ispId}`);
  return uniqueData as ChamadoData[];
}

// Fallback sequencial — usado se COUNT falhar
async function fetchChamadosSequential(ispId: string): Promise<ChamadoData[]> {
  const MAX_BATCHES = Math.ceil(MAX_RECORDS / BATCH_SIZE);
  let allData: any[] = [];

  for (let i = 0; i < MAX_BATCHES; i++) {
    const { data, error } = await externalSupabase
      .from("chamados")
      .select(CHAMADOS_COLUMNS)
      .eq("isp_id", ispId)
      .order("created_at", { ascending: false })
      .range(i * BATCH_SIZE, (i + 1) * BATCH_SIZE - 1);
    if (error) throw error;
    if (!data?.length) break;
    allData = allData.concat(data);
    if (data.length < BATCH_SIZE) break;
  }

  const uniqueMap = new Map<string, any>();
  allData.forEach(c => {
    if (!uniqueMap.has(c.protocolo)) uniqueMap.set(c.protocolo, c);
  });
  const uniqueData = Array.from(uniqueMap.values());
  console.log(`✅ Chamados (sequential): ${uniqueData.length} únicos para ${ispId}`);
  return uniqueData as ChamadoData[];
}

export function useChamados() {
  const { ispId } = useActiveIsp();

  const { data, isLoading, error } = useQuery({
    queryKey: ["chamados", ispId],
    queryFn: () => fetchChamados(ispId),
    enabled: !!ispId,
    // refetchOnMount removido: herda global false (staleTime 8h cobre sessão completa).
    // F5 / reload: CacheRefreshGuard dispara refetchQueries explicitamente.
  });

  const chamados = data ?? [];

  const getChamadosPorCliente = useCallback((periodoFiltro?: number): Map<number, ChamadosPorCliente> => {
    const clientesMap = new Map<number, ChamadosPorCliente>();

    let maxDate = new Date(0);
    chamados.forEach(c => {
      try {
        let d: Date | null = null;
        if (c.data_abertura.includes("/")) {
          const [datePart] = c.data_abertura.split(" ");
          const [dia, mes, ano] = datePart.split("/");
          d = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
        } else {
          d = new Date(c.data_abertura);
        }
        if (d && !isNaN(d.getTime()) && d > maxDate) maxDate = d;
      } catch (e) {}
    });

    if (maxDate.getTime() === 0) maxDate = new Date();

    const dataLimite = periodoFiltro
      ? new Date(maxDate.getTime() - periodoFiltro * 24 * 60 * 60 * 1000)
      : null;

    chamados.forEach(c => {
      const clienteId = typeof c.id_cliente === 'string' ? parseInt(c.id_cliente, 10) : c.id_cliente;
      if (isNaN(clienteId)) return;

      let dataAbertura: Date | null = null;
      try {
        if (c.data_abertura.includes("/")) {
          const [datePart] = c.data_abertura.split(" ");
          const [dia, mes, ano] = datePart.split("/");
          dataAbertura = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
        } else {
          dataAbertura = new Date(c.data_abertura);
        }
      } catch (e) {}

      const dentroPeriodo = !dataLimite || (dataAbertura && dataAbertura >= dataLimite);

      if (!clientesMap.has(clienteId)) {
        clientesMap.set(clienteId, {
          cliente_id: clienteId,
          total_chamados: 0,
          chamados_periodo: 0,
          reincidente: false,
          ultimo_chamado: c.data_abertura,
          setores: [],
          categorias: [],
        });
      }

      const cliente = clientesMap.get(clienteId)!;
      cliente.total_chamados++;

      if (dentroPeriodo) {
        cliente.chamados_periodo++;
      }

      if (c.setor && !cliente.setores.includes(c.setor)) {
        cliente.setores.push(c.setor);
      }
      if (c.categoria && !cliente.categorias.includes(c.categoria)) {
        cliente.categorias.push(c.categoria);
      }

      if (cliente.chamados_periodo > 1) {
        cliente.reincidente = true;
      }
    });

    return clientesMap;
  }, [chamados]);

  const getChamadosPorPlano = (clientePlanoMap: Map<number, string>, periodoFiltro?: number): Map<string, { total: number; reincidentes: number }> => {
    const planosMap = new Map<string, { total: number; reincidentes: number; clientes: Set<number> }>();
    const chamadosPorCliente = getChamadosPorCliente(periodoFiltro);

    chamadosPorCliente.forEach((dados, clienteId) => {
      const plano = clientePlanoMap.get(clienteId) || "Sem plano";

      if (!planosMap.has(plano)) {
        planosMap.set(plano, { total: 0, reincidentes: 0, clientes: new Set() });
      }

      const planoData = planosMap.get(plano)!;
      planoData.total += dados.chamados_periodo;
      if (dados.reincidente) {
        planoData.reincidentes++;
      }
      planoData.clientes.add(clienteId);
    });

    return new Map(
      Array.from(planosMap.entries()).map(([k, v]) => [k, { total: v.total, reincidentes: v.reincidentes }])
    );
  };

  return { chamados, isLoading, error: error?.message ?? null, getChamadosPorCliente, getChamadosPorPlano };
}
