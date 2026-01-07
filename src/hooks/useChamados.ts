import { useState, useEffect, useCallback } from "react";
import { externalSupabase, ISP_ID } from "@/integrations/supabase/external-client";
import { useToast } from "@/hooks/use-toast";

export interface ChamadoData {
  id_cliente: number;
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
  const [chamados, setChamados] = useState<ChamadoData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchChamados = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Primeiro, obter a contagem total
        const { count: totalCount, error: countError } = await externalSupabase
          .from("chamados")
          .select("*", { count: "exact", head: true })
          .eq("isp_id", ISP_ID);

        if (countError) throw countError;

        // Buscar em batches de 1000
        const BATCH_SIZE = 1000;
        const totalBatches = Math.ceil((totalCount || 0) / BATCH_SIZE);
        let allData: any[] = [];

        for (let i = 0; i < totalBatches; i++) {
          const start = i * BATCH_SIZE;
          const end = start + BATCH_SIZE - 1;
          
          const { data, error } = await externalSupabase
            .from("chamados")
            .select("*")
            .eq("isp_id", ISP_ID)
            .order("data_abertura", { ascending: false })
            .range(start, end);

          if (error) throw error;
          
          if (data) {
            allData = [...allData, ...data];
          }
        }

        setChamados(allData as ChamadoData[]);
        
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
  }, [toast]);

  // Agregar chamados por cliente - memoized
  const getChamadosPorCliente = useCallback((periodoFiltro?: number): Map<number, ChamadosPorCliente> => {
    const clientesMap = new Map<number, ChamadosPorCliente>();
    
    const dataLimite = periodoFiltro 
      ? new Date(Date.now() - periodoFiltro * 24 * 60 * 60 * 1000)
      : null;

    chamados.forEach(c => {
      // Parse data DD/MM/YYYY HH:MM:SS
      let dataAbertura: Date | null = null;
      try {
        const [datePart] = c.data_abertura.split(" ");
        const [dia, mes, ano] = datePart.split("/");
        dataAbertura = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
      } catch (e) {
        // Keep null if parse fails
      }

      const dentroPeriodo = !dataLimite || (dataAbertura && dataAbertura >= dataLimite);

      if (!clientesMap.has(c.id_cliente)) {
        clientesMap.set(c.id_cliente, {
          cliente_id: c.id_cliente,
          total_chamados: 0,
          chamados_periodo: 0,
          reincidente: false,
          ultimo_chamado: c.data_abertura,
          setores: [],
          categorias: [],
        });
      }

      const cliente = clientesMap.get(c.id_cliente)!;
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
      
      // Reincidente se tem mais de 1 chamado no período
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
