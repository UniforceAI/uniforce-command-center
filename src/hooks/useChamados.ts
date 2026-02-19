import { useState, useEffect, useCallback } from "react";
import { externalSupabase } from "@/integrations/supabase/external-client";
import { useToast } from "@/hooks/use-toast";
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

export function useChamados() {
  const { toast } = useToast();
  const { ispId } = useActiveIsp();
  const [chamados, setChamados] = useState<ChamadoData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchChamados = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log(`🔄 Buscando chamados (isp_id=${ispId})...`);

        // Buscar em batches para pegar todos os chamados recentes
        const BATCH_SIZE = 1000;
        const MAX_BATCHES = 15;
        let allData: any[] = [];
        let hasMore = true;

        for (let i = 0; i < MAX_BATCHES && hasMore; i++) {
          const start = i * BATCH_SIZE;
          const end = start + BATCH_SIZE - 1;

          const { data, error: batchError } = await externalSupabase
            .from("chamados")
            .select("*")
            .eq("isp_id", ispId)
            .order("data_abertura", { ascending: false })
            .range(start, end);

          if (batchError) throw batchError;

          if (data && data.length > 0) {
            allData = [...allData, ...data];
            hasMore = data.length === BATCH_SIZE;
          } else {
            hasMore = false;
          }
        }

        // Deduplicar por protocolo (manter o mais recente)
        const uniqueMap = new Map<string, any>();
        allData.forEach(c => {
          const key = c.protocolo;
          if (!uniqueMap.has(key)) {
            uniqueMap.set(key, c);
          }
        });
        const uniqueData = Array.from(uniqueMap.values());
        
        setChamados(uniqueData as ChamadoData[]);
        console.log(`✅ ${uniqueData.length} chamados únicos carregados para ${ispId} (de ${allData.length} registros)`);
        
      } catch (err: any) {
        setError(err.message);
        toast({
          title: "Erro ao carregar chamados",
          description: err.message || "Não foi possível carregar os dados.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchChamados();
  }, [toast, ispId]);

  // Agregar chamados por cliente - memoized
  const getChamadosPorCliente = useCallback((periodoFiltro?: number): Map<number, ChamadosPorCliente> => {
    const clientesMap = new Map<number, ChamadosPorCliente>();
    
    // Calcular data limite RELATIVA ao chamado mais recente (não Date.now())
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

    console.log(`🔍 Chamados: maxDate=${maxDate.toISOString()}, dataLimite=${dataLimite?.toISOString()}, total=${chamados.length}`);

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

  // Agregar por plano (para cohort)
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

  return { chamados, isLoading, error, getChamadosPorCliente, getChamadosPorPlano };
}
