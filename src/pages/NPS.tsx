import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { ThumbsUp, Gauge, Wrench, Headphones } from "lucide-react";
import { NPSFilters } from "@/components/nps/NPSFilters";
import { NPSKPICard } from "@/components/nps/NPSKPICard";
import { NPSCharts } from "@/components/nps/NPSCharts";
import { NPSTable } from "@/components/nps/NPSTable";
import { NPSInsightsPanel } from "@/components/nps/NPSInsightsPanel";
import { mockNPSData } from "@/lib/mockDataNPS";

const NPS = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);

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

  // Aplicar filtros
  const filteredRespostas = useMemo(() => {
    let filtered = [...mockNPSData];

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
  }, [periodo, tipoNPS, classificacao]);

  // Calcular KPIs
  const kpis = useMemo(() => {
    const calcNPS = (respostas: typeof mockNPSData) => {
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
      </main>
    </div>
  );
};

export default NPS;
