import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveIsp } from "@/hooks/useActiveIsp";
import { externalSupabase } from "@/integrations/supabase/external-client";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { ThumbsUp, Gauge, Wrench, Headphones, AlertCircle } from "lucide-react";
import { NPSFilters } from "@/components/nps/NPSFilters";
import { NPSKPICard } from "@/components/nps/NPSKPICard";
import { NPSCharts } from "@/components/nps/NPSCharts";
import { NPSTable } from "@/components/nps/NPSTable";
import { NPSInsightsPanel } from "@/components/nps/NPSInsightsPanel";
import { RespostaNPS, ClassificacaoNPS, TipoNPS } from "@/types/nps";
import { useToast } from "@/hooks/use-toast";

const NPS = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signOut } = useAuth();
  const { ispId, ispNome } = useActiveIsp();
  const [respostasNPS, setRespostasNPS] = useState<RespostaNPS[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filtros
  const [periodo, setPeriodo] = useState("7");
  const [tipoNPS, setTipoNPS] = useState("todos");
  const [classificacao, setClassificacao] = useState("todos");


  // Função para mapear tipo_nps do banco para o formato esperado
  const mapTipoNPS = (tipo: string): TipoNPS => {
    const tipoLower = tipo?.toLowerCase().trim() || "";
    if (tipoLower === "contrato") return "contrato";
    if (tipoLower === "atendimento") return "atendimento";
    if (tipoLower === "ordem_servico" || tipoLower.includes("os") || tipoLower.includes("o.s") || tipoLower.includes("ordem") || tipoLower.includes("pós")) return "os";
    return tipoLower as TipoNPS || "atendimento";
  };

  // Função para calcular classificação baseada na nota
  const calcClassificacao = (nota: number): ClassificacaoNPS => {
    if (nota <= 6) return "Detrator";
    if (nota <= 8) return "Neutro";
    return "Promotor";
  };

  // Buscar dados do Supabase externo - tabela nps_check
  useEffect(() => {
    

    const fetchNPSData = async () => {
      try {
        setIsLoading(true);

        // Primeiro buscar sem filtro para debug
        const { data: allData } = await externalSupabase
          .from("nps_check")
          .select("*")
          .limit(5);
        
        console.log("🔍 DEBUG - Amostra de dados:", allData);
        console.log("🔍 DEBUG - isp_ids disponíveis:", [...new Set(allData?.map((d: any) => d.isp_id) || [])]);

        const { data, error } = await externalSupabase
          .from("nps_check")
          .select("*")
          .eq("isp_id", ispId)
          .not("data_resposta", "is", null) // Filtrar apenas respondidas
          .order("data_resposta", { ascending: false })
          .limit(1000);

        if (error) throw error;

        console.log(`✅ ${data?.length || 0} respostas NPS respondidas para ${ispId}`);

        // Transformar dados do banco para o formato esperado
        const respostasTransformadas: RespostaNPS[] = (data || []).map((item: any) => {
          const nota = item.nota_numerica ?? Number(item.nota) ?? 0;
          
          // Mapear classificação do banco (MAIÚSCULO) para formato esperado (Capitalizado)
          const mapClassificacao = (classif: string): "Promotor" | "Neutro" | "Detrator" => {
            const lower = classif?.toLowerCase().trim() || "";
            if (lower === "promotor") return "Promotor";
            if (lower === "neutro") return "Neutro";
            if (lower === "detrator") return "Detrator";
            return calcClassificacao(nota);
          };
          
          return {
            cliente_id: item.id_cliente || item.cliente_id || 0,
            cliente_nome: item.nome || item.cliente_nome || "N/A",
            tipo_nps: mapTipoNPS(item.nps_type || item.origem || ""),
            nota,
            classificacao: mapClassificacao(item.classificacao_nps),
            comentario: item.mensagem_melhoria || item.comentario || "",
            data_resposta: item.data_resposta || item.data_envio || new Date().toISOString().split('T')[0],
          };
        });

        setRespostasNPS(respostasTransformadas);
      } catch (error: any) {
        console.error("❌ Erro:", error);
        toast({
          title: "Erro ao carregar dados NPS",
          description: error.message || "Não foi possível carregar os dados.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchNPSData();
  }, [toast, ispId]);

  // Encontrar a data mais recente nos dados para usar como referência
  const dataReferencia = useMemo(() => {
    if (respostasNPS.length === 0) return new Date();
    const datas = respostasNPS.map(r => new Date(r.data_resposta).getTime());
    return new Date(Math.max(...datas));
  }, [respostasNPS]);

  // Aplicar filtros
  const filteredRespostas = useMemo(() => {
    let filtered = [...respostasNPS];

    console.log("🔍 Filtro período:", periodo, "| Total antes:", filtered.length, "| Data ref:", dataReferencia.toISOString());
    
    // Filtro por período - relativo à data mais recente dos dados
    if (periodo !== "todos") {
      const diasAtras = parseInt(periodo);
      const dataLimite = new Date(dataReferencia);
      dataLimite.setDate(dataLimite.getDate() - diasAtras);
      dataLimite.setHours(0, 0, 0, 0);
      
      filtered = filtered.filter(r => {
        const dataResposta = new Date(r.data_resposta);
        return dataResposta >= dataLimite;
      });
      
      console.log("📅 Data limite:", dataLimite.toISOString(), "| Após filtro:", filtered.length);
    }

    // Filtro por tipo
    if (tipoNPS !== "todos") {
      filtered = filtered.filter(r => r.tipo_nps === tipoNPS);
    }

    // Filtro por classificação
    if (classificacao !== "todos") {
      filtered = filtered.filter(r => r.classificacao === classificacao);
    }

    return filtered;
  }, [respostasNPS, periodo, tipoNPS, classificacao, dataReferencia]);

  // Calcular KPIs - Média das notas (0-10)
  const kpis = useMemo(() => {
    const calcMedia = (respostas: RespostaNPS[]) => {
      if (respostas.length === 0) return 0;
      const soma = respostas.reduce((acc, r) => acc + r.nota, 0);
      return Number((soma / respostas.length).toFixed(1));
    };

    return {
      geral: calcMedia(filteredRespostas),
      contrato: calcMedia(filteredRespostas.filter(r => r.tipo_nps === "contrato")),
      os: calcMedia(filteredRespostas.filter(r => r.tipo_nps === "os")),
      atendimento: calcMedia(filteredRespostas.filter(r => r.tipo_nps === "atendimento")),
    };
  }, [filteredRespostas]);

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };


  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Monitor de NPS
              </h1>
              <p className="text-muted-foreground mt-1">{ispNome} - Satisfação do Cliente</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ThumbsUp className="h-5 w-5" />
                <span>{filteredRespostas.length} respostas</span>
              </div>
              <Button variant="outline" onClick={handleLogout}>
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground">Carregando dados NPS...</p>
            </div>
          </div>
        ) : respostasNPS.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
              <div>
                <h3 className="text-lg font-semibold">Nenhuma resposta NPS encontrada</h3>
                <p className="text-muted-foreground">Aguardando dados da tabela nps-check...</p>
              </div>
            </div>
          </div>
        ) : (
          <>
        {/* Filtros */}
        <NPSFilters
          periodo={periodo}
          tipoNPS={tipoNPS}
          classificacao={classificacao}
          onPeriodoChange={setPeriodo}
          onTipoNPSChange={setTipoNPS}
          onClassificacaoChange={setClassificacao}
        />

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <NPSKPICard
            title="NPS Geral"
            value={kpis.geral}
            icon={Gauge}
          />
          <NPSKPICard
            title="NPS Contrato"
            value={kpis.contrato}
            icon={ThumbsUp}
          />
          <NPSKPICard
            title="NPS Pós-O.S"
            value={kpis.os}
            icon={Wrench}
          />
          <NPSKPICard
            title="NPS Atendimento"
            value={kpis.atendimento}
            icon={Headphones}
          />
        </div>

        {/* Gráficos */}
        <div>
          <h2 className="text-2xl font-bold mb-4">📊 Performance e Tendências</h2>
          <NPSCharts respostas={filteredRespostas} />
        </div>

        {/* Insights */}
        <div>
          <h2 className="text-2xl font-bold mb-4">💡 Insights Automáticos</h2>
          <NPSInsightsPanel respostas={filteredRespostas} />
        </div>

        {/* Tabela */}
        <div>
          <h2 className="text-2xl font-bold mb-4">📋 Respostas NPS</h2>
          <NPSTable respostas={filteredRespostas} />
        </div>
          </>
        )}
      </main>
    </div>
  );
};

export default NPS;
