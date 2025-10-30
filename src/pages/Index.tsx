import { useState, useEffect } from "react";
import { Chamado } from "@/types/chamado";
import { mockChamados } from "@/lib/mockData";
import { KPICard } from "@/components/dashboard/KPICard";
import { DashboardFilters } from "@/components/dashboard/DashboardFilters";
import { ClientesTable } from "@/components/dashboard/ClientesTable";
import { ClienteDetailsSheet } from "@/components/dashboard/ClienteDetailsSheet";
import { PerformanceCharts } from "@/components/dashboard/PerformanceCharts";
import { InsightsPanel } from "@/components/dashboard/InsightsPanel";
import { 
  Phone, 
  Clock, 
  RefreshCcw, 
  CheckCircle2, 
  AlertCircle,
  BarChart3 
} from "lucide-react";

const Index = () => {
  const [chamados, setChamados] = useState<Chamado[]>(mockChamados);
  const [filteredChamados, setFilteredChamados] = useState<Chamado[]>(mockChamados);
  const [selectedCliente, setSelectedCliente] = useState<Chamado | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  
  // Filtros
  const [periodo, setPeriodo] = useState("30");
  const [status, setStatus] = useState("todos");
  const [urgencia, setUrgencia] = useState("todas");
  const [setor, setSetor] = useState("todos");

  // Aplicar filtros
  useEffect(() => {
    let filtered = [...chamados];

    if (status !== "todos") {
      filtered = filtered.filter((c) => c.Status === status);
    }

    if (urgencia !== "todas") {
      filtered = filtered.filter((c) => c.Urgência === urgencia);
    }

    if (setor !== "todos") {
      filtered = filtered.filter((c) => c.Setor === setor);
    }

    setFilteredChamados(filtered);
  }, [chamados, status, urgencia, setor, periodo]);

  // Calcular KPIs
  const totalChamados = filteredChamados.length;
  const chamadosResolvidos = filteredChamados.filter((c) => c.Status === "Resolvido" || c.Status === "Fechado").length;
  const chamadosAbertos = filteredChamados.filter((c) => c.Status === "Novo" || c.Status === "Em Andamento").length;
  const reincidentes = filteredChamados.filter((c) => c.Classificação === "Reincidente").length;
  const percentualReincidentes = totalChamados > 0 ? ((reincidentes / totalChamados) * 100).toFixed(1) : "0";
  
  // Calcular tempo médio (simplificado)
  const calcularTempoMedio = () => {
    let totalHoras = 0;
    let count = 0;
    
    filteredChamados.forEach((chamado) => {
      const tempo = chamado["Tempo de Atendimento"];
      if (tempo !== "0h") {
        let horas = 0;
        if (tempo.includes("h")) {
          horas = parseInt(tempo.split("h")[0]);
        } else if (tempo.includes("min")) {
          horas = parseInt(tempo.split("min")[0]) / 60;
        }
        totalHoras += horas;
        count++;
      }
    });
    
    return count > 0 ? (totalHoras / count).toFixed(1) : "0";
  };

  const tempoMedio = calcularTempoMedio();
  const percentualAbertos = totalChamados > 0 ? ((chamadosAbertos / totalChamados) * 100).toFixed(0) : "0";

  // Urgência
  const urgenciaAlta = filteredChamados.filter((c) => c.Urgência === "Alta").length;
  const urgenciaMedia = filteredChamados.filter((c) => c.Urgência === "Média").length;
  const urgenciaBaixa = filteredChamados.filter((c) => c.Urgência === "Baixa").length;

  const handleClienteClick = (chamado: Chamado) => {
    setSelectedCliente(chamado);
    setSheetOpen(true);
  };

  // Ordenar clientes críticos por quantidade de chamados
  const clientesCriticos = [...filteredChamados]
    .sort((a, b) => b["Qtd. Chamados"] - a["Qtd. Chamados"])
    .slice(0, 10);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Monitor de Atendimento e Reincidência
              </h1>
              <p className="text-muted-foreground mt-1">Agy Telecom</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BarChart3 className="h-5 w-5" />
              <span>Atualizado agora</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-8">
        {/* Filtros */}
        <DashboardFilters
          periodo={periodo}
          status={status}
          urgencia={urgencia}
          setor={setor}
          onPeriodoChange={setPeriodo}
          onStatusChange={setStatus}
          onUrgenciaChange={setUrgencia}
          onSetorChange={setSetor}
        />

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <KPICard
            title="Total de Chamados"
            value={totalChamados}
            subtitle="no período"
            icon={Phone}
            variant="default"
          />
          <KPICard
            title="Tempo Médio"
            value={`${tempoMedio}h`}
            subtitle="de atendimento"
            icon={Clock}
            variant="default"
          />
          <KPICard
            title="Reincidentes"
            value={`${percentualReincidentes}%`}
            subtitle={`${reincidentes} chamados`}
            icon={RefreshCcw}
            variant="destructive"
          />
          <KPICard
            title="Resolvidos < 24h"
            value={`${((chamadosResolvidos / totalChamados) * 100).toFixed(0)}%`}
            subtitle={`${chamadosResolvidos} chamados`}
            icon={CheckCircle2}
            variant="success"
          />
          <KPICard
            title="Chamados Abertos"
            value={`${percentualAbertos}%`}
            subtitle={`${chamadosAbertos} ativos`}
            icon={AlertCircle}
            variant="warning"
          />
          <KPICard
            title="Urgência"
            value={urgenciaAlta}
            subtitle={`Alta | ${urgenciaMedia} Média | ${urgenciaBaixa} Baixa`}
            icon={AlertCircle}
            variant={urgenciaAlta > 0 ? "destructive" : "default"}
          />
        </div>

        {/* Gráficos de Performance */}
        <div>
          <h2 className="text-2xl font-bold mb-4">📊 Performance e Tendências</h2>
          <PerformanceCharts chamados={filteredChamados} />
        </div>

        {/* Clientes Críticos */}
        <div>
          <h2 className="text-2xl font-bold mb-4">🔴 Clientes Críticos</h2>
          <ClientesTable 
            chamados={clientesCriticos} 
            onClienteClick={handleClienteClick}
          />
        </div>

        {/* Insights */}
        <div>
          <h2 className="text-2xl font-bold mb-4">💡 Insights Automáticos</h2>
          <InsightsPanel chamados={filteredChamados} />
        </div>
      </main>

      {/* Sheet de Detalhes */}
      <ClienteDetailsSheet
        chamado={selectedCliente}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
};

export default Index;
