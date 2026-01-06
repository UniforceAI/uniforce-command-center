import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { externalSupabase, ISP_ID } from "@/integrations/supabase/external-client";
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
  const [user, setUser] = useState<User | null>(null);
  const [respostasNPS, setRespostasNPS] = useState<RespostaNPS[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filtros
  const [periodo, setPeriodo] = useState("30");
  const [tipoNPS, setTipoNPS] = useState("todos");
  const [classificacao, setClassificacao] = useState("todos");

  // Verificar autenticação
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Função para mapear tipo_nps do banco para o formato esperado
  const mapTipoNPS = (tipo: string): TipoNPS => {
    const tipoLower = tipo?.toLowerCase() || "";
    if (tipoLower.includes("instalacao") || tipoLower.includes("instalação")) return "pos_instalacao";
    if (tipoLower.includes("os") || tipoLower.includes("o.s")) return "pos_os";
    if (tipoLower.includes("atendimento")) return "pos_atendimento";
    return "pos_atendimento"; // default
  };

  // Função para calcular classificação baseada na nota
  const calcClassificacao = (nota: number): ClassificacaoNPS => {
    if (nota <= 6) return "Detrator";
    if (nota <= 8) return "Neutro";
    return "Promotor";
  };

  // Buscar dados do Supabase externo - tabela nps-check
  useEffect(() => {
    if (!user) return;

    const fetchNPSData = async () => {
      try {
        setIsLoading(true);
        console.log("🔄 Buscando dados NPS do Supabase externo...");
        console.log(`🏢 Filtro multi-tenant: isp_id = ${ISP_ID}`);
        console.log(`📊 Tabela: nps-check`);

        const { data, error } = await externalSupabase
          .from("nps-check")
          .select("*")
          .eq("isp_id", ISP_ID)
          .order("data_resposta", { ascending: false });

        if (error) throw error;

        console.log(`✅ ${data?.length || 0} respostas NPS encontradas`);

        // Transformar dados do banco para o formato esperado
        const respostasTransformadas: RespostaNPS[] = (data || []).map((item: any) => {
          const nota = Number(item.nota) || 0;
          return {
            cliente_id: item.cliente_id || item.id_cliente || 0,
            cliente_nome: item.cliente_nome || item.solicitante || "N/A",
            tipo_nps: mapTipoNPS(item.tipo_nps || item.tipo || ""),
            nota,
            classificacao: calcClassificacao(nota),
            comentario: item.comentario || item.observacao || "",
            data_resposta: item.data_resposta || new Date().toISOString().split('T')[0],
          };
        });

        setRespostasNPS(respostasTransformadas);
      } catch (error: any) {
        console.error("❌ Erro ao buscar dados NPS:", error);
        toast({
          title: "Erro ao carregar dados NPS",
          description: error.message || "Não foi possível carregar os dados. Tente novamente.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchNPSData();
  }, [user, toast]);

  // Aplicar filtros
  const filteredRespostas = useMemo(() => {
    let filtered = [...respostasNPS];

    // Filtro por período
    if (periodo !== "todos") {
      const diasAtras = parseInt(periodo);
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - diasAtras);
      filtered = filtered.filter(r => new Date(r.data_resposta) >= dataLimite);
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
  }, [respostasNPS, periodo, tipoNPS, classificacao]);

  // Calcular KPIs
  const kpis = useMemo(() => {
    const calcNPS = (respostas: RespostaNPS[]) => {
      if (respostas.length === 0) return 0;
      const promotores = respostas.filter(r => r.classificacao === "Promotor").length;
      const detratores = respostas.filter(r => r.classificacao === "Detrator").length;
      return Math.round(((promotores - detratores) / respostas.length) * 100);
    };

    return {
      geral: calcNPS(filteredRespostas),
      instalacao: calcNPS(filteredRespostas.filter(r => r.tipo_nps === "pos_instalacao")),
      os: calcNPS(filteredRespostas.filter(r => r.tipo_nps === "pos_os")),
      atendimento: calcNPS(filteredRespostas.filter(r => r.tipo_nps === "pos_atendimento")),
    };
  }, [filteredRespostas]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (!user) {
    return null;
  }

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
              <p className="text-muted-foreground mt-1">Agy Telecom - Satisfação do Cliente</p>
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
            trend={5}
            icon={Gauge}
          />
          <NPSKPICard
            title="NPS Pós-Instalação"
            value={kpis.instalacao}
            trend={-3}
            icon={Wrench}
          />
          <NPSKPICard
            title="NPS Pós-O.S"
            value={kpis.os}
            trend={-8}
            icon={Wrench}
          />
          <NPSKPICard
            title="NPS Pós-Atendimento"
            value={kpis.atendimento}
            trend={12}
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
