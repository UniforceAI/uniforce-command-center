import { useState, useMemo, useCallback } from "react";
import { usePageFilters } from "@/hooks/usePageFilters";
import { useNavigate } from "react-router-dom";
import { Chamado } from "@/types/chamado";
import { useAuth } from "@/contexts/AuthContext";
import { getCategoriaName } from "@/lib/categoriasMap";
import { useActiveIsp } from "@/hooks/useActiveIsp";
import { useChurnScore } from "@/hooks/useChurnScore";
import { useChurnData } from "@/hooks/useChurnData";
import { useRiskBucketConfig } from "@/hooks/useRiskBucketConfig";
import { useCrmWorkflow } from "@/hooks/useCrmWorkflow";
import { useChamados } from "@/hooks/useChamados";
import { CrmDrawer } from "@/components/crm/CrmDrawer";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { KPICardNew } from "@/components/shared/KPICardNew";
import { IspActions } from "@/components/shared/IspActions";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { DashboardFilters } from "@/components/dashboard/DashboardFilters";
import { ClientesTable } from "@/components/dashboard/ClientesTable";
import { ClienteDetailsSheet } from "@/components/dashboard/ClienteDetailsSheet";
import { PerformanceCharts } from "@/components/dashboard/PerformanceCharts";
import { InsightsPanel } from "@/components/dashboard/InsightsPanel";
import { Phone, Clock, RefreshCcw, CheckCircle2, AlertCircle, AlertTriangle, BarChart3, Lightbulb } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signOut, isSuperAdmin, clearSelectedIsp } = useAuth();
  const { ispId, ispNome } = useActiveIsp();
  const { scoreMap, churnStatus, churnEvents, getScoreTotalReal } = useChurnScore();
  const { getBucket } = useRiskBucketConfig();
  const { workflowMap, addToWorkflow, updateStatus, updateTags, updateOwner } = useCrmWorkflow();
  const { chamados: rawChamados, isLoading } = useChamados();

  const [selectedCliente, setSelectedCliente] = useState<Chamado | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Filtros — persisted in sessionStorage for the session
  const { filters, setFilter } = usePageFilters("chamados-frequentes", {
    periodo: "7" as string,
    status: "todos" as string,
    urgencia: "todas" as string,
    setor: "todos" as string,
    selectedCrmClienteId: "" as string,
  });

  const selectedCrmClienteId = filters.selectedCrmClienteId ? parseInt(filters.selectedCrmClienteId, 10) || null : null;
  const { periodo, status, urgencia, setor } = filters;

  // Transform raw chamados from hook into Chamado[] type with dedup
  const chamados = useMemo(() => {
    // Deduplicar por protocolo + id_cliente
    const uniqueMap = new Map<string, any>();
    rawChamados.forEach((item: any) => {
      const key = `${item.id_cliente}_${item.protocolo}`;
      const existing = uniqueMap.get(key);
      if (!existing || (item.updated_at && (!existing.updated_at || item.updated_at > existing.updated_at))) {
        uniqueMap.set(key, item);
      }
    });
    const uniqueData = Array.from(uniqueMap.values());

    return uniqueData.map((item: any) => {
      const categoria = item.categoria || "";
      const motivoFinal = getCategoriaName(categoria, ispId);
      return {
        "ID Cliente": item.id_cliente || "",
        "Qtd. Chamados": item.qtd_chamados ?? 0,
        Protocolo: item.protocolo || "",
        "Data de Abertura": item.data_abertura || "",
        "Última Atualização": item.ultima_atualizacao || "",
        Responsável: item.responsavel || "",
        Setor: item.setor || "",
        Categoria: categoria,
        "Motivo do Contato": motivoFinal,
        Origem: item.origem || "",
        Solicitante: item.solicitante || item.id_cliente || "",
        Urgência: item.urgencia || "",
        Status: item.status || "",
        "Dias ultimo chamado": item.dias_desde_ultimo ?? null,
        "Tempo de Atendimento": item.tempo_atendimento || "",
        Classificação: item.classificacao || "",
        Insight: item.insight || "",
        "Chamados Anteriores": item.chamados_anteriores || "",
        _id: item.id,
        isp_id: item.isp_id || null,
        instancia_isp: item.instancia_isp || null,
      } as Chamado;
    });
  }, [rawChamados, ispId]);

  // Encontrar a data mais recente dos dados
  const dataMaisRecente = useMemo(() => {
    let maxDate: Date | null = null;
    chamados.forEach((c) => {
      const dataString = c["Data de Abertura"];
      if (!dataString || dataString.trim() === "") return;
      try {
        let dataAbertura: Date;
        if (dataString.includes("-")) {
          const [datePart] = dataString.split(" ");
          const [ano, mes, dia] = datePart.split("-");
          dataAbertura = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia), 0, 0, 0);
        } else {
          const [datePart] = dataString.split(" ");
          const [dia, mes, ano] = datePart.split("/");
          dataAbertura = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia), 0, 0, 0);
        }
        if (!isNaN(dataAbertura.getTime()) && (!maxDate || dataAbertura > maxDate)) {
          maxDate = dataAbertura;
        }
      } catch (e) {}
    });
    return maxDate || new Date();
  }, [chamados]);

  // Aplicar filtros
  const filteredChamados = useMemo(() => {
    let filtered = [...chamados];

    if (periodo !== "todos") {
      const diasAtras = parseInt(periodo);
      const hoje = new Date(dataMaisRecente.getFullYear(), dataMaisRecente.getMonth(), dataMaisRecente.getDate(), 0, 0, 0);
      let dataLimite: Date;
      if (diasAtras === 0) {
        dataLimite = hoje;
      } else if (diasAtras === 1) {
        dataLimite = new Date(hoje);
        dataLimite.setDate(dataLimite.getDate() - 1);
      } else {
        dataLimite = new Date(hoje);
        dataLimite.setDate(dataLimite.getDate() - diasAtras);
      }

      filtered = filtered.filter((c) => {
        try {
          const dataString = c["Data de Abertura"];
          if (!dataString || dataString.trim() === "") return false;
          let dataAbertura: Date;
          if (dataString.includes("-")) {
            const [datePart] = dataString.split(" ");
            const [ano, mes, dia] = datePart.split("-");
            dataAbertura = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia), 0, 0, 0);
          } else {
            const [datePart] = dataString.split(" ");
            const [dia, mes, ano] = datePart.split("/");
            dataAbertura = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia), 0, 0, 0);
          }
          if (isNaN(dataAbertura.getTime())) return false;
          return dataAbertura >= dataLimite;
        } catch (e) {
          return false;
        }
      });
    }
    if (status !== "todos") filtered = filtered.filter((c) => c.Status === status);
    if (urgencia !== "todas") filtered = filtered.filter((c) => c.Urgência === urgencia);
    if (setor !== "todos") filtered = filtered.filter((c) => c.Setor?.trim() === setor.trim());

    return filtered;
  }, [chamados, status, urgencia, setor, periodo, dataMaisRecente]);

  // KPIs
  const kpis = useMemo(() => {
    const totalChamados = filteredChamados.length;
    const chamadosResolvidos = filteredChamados.filter(
      (c) => c.Status === "Resolvido" || c.Status === "Fechado",
    ).length;
    const chamadosAbertos = filteredChamados.filter((c) => {
      const s = c.Status?.trim();
      return s === "Novo" || s === "Em Andamento" || s === "Aberto" || s === "EN";
    }).length;
    const reincidentes = filteredChamados.filter((c) => c.Classificação === "Reincidente").length;
    const percentualReincidentes = totalChamados > 0 ? ((reincidentes / totalChamados) * 100).toFixed(1) : "0";

    let totalHoras = 0;
    let count = 0;
    filteredChamados.forEach((chamado) => {
      const tempo = chamado["Tempo de Atendimento"];
      let horas = 0;
      if (typeof tempo === 'number') {
        horas = tempo;
      } else if (typeof tempo === 'string') {
        if (tempo.includes("d")) {
          const dias = parseFloat(tempo.split("d")[0]);
          horas = dias * 24;
        } else if (tempo.includes("h")) {
          horas = parseFloat(tempo.split("h")[0]);
        } else if (tempo.includes("min")) {
          horas = parseFloat(tempo.split("min")[0]) / 60;
        } else {
          const parsed = parseFloat(tempo);
          if (!isNaN(parsed)) horas = parsed;
        }
      }
      if (horas > 0) {
        totalHoras += horas;
        count++;
      }
    });

    const tempoMedio = count > 0 ? (totalHoras / count).toFixed(1) : "0";
    const percentualAbertos = totalChamados > 0 ? ((chamadosAbertos / totalChamados) * 100).toFixed(0) : "0";
    const urgenciaAlta = filteredChamados.filter((c) => c.Urgência === "Alta").length;
    const urgenciaMedia = filteredChamados.filter((c) => c.Urgência === "Média").length;
    const urgenciaBaixa = filteredChamados.filter((c) => c.Urgência === "Baixa").length;

    return {
      totalChamados, chamadosResolvidos, chamadosAbertos, reincidentes,
      percentualReincidentes, tempoMedio, percentualAbertos,
      urgenciaAlta, urgenciaMedia, urgenciaBaixa,
    };
  }, [filteredChamados]);

  const handleClienteClick = useCallback((chamado: Chamado) => {
    setSelectedCliente(chamado);
    setSheetOpen(true);
  }, []);

  const handleOpenProfile = useCallback((chamado: Chamado) => {
    const clienteId = typeof chamado["ID Cliente"] === 'string'
      ? parseInt(chamado["ID Cliente"], 10)
      : chamado["ID Cliente"];
    setFilter("selectedCrmClienteId", String(clienteId));
  }, [setFilter]);

  const selectedCrmCliente = useMemo(() => {
    if (!selectedCrmClienteId) return null;
    return churnStatus.find(c => c.cliente_id === selectedCrmClienteId) || null;
  }, [selectedCrmClienteId, churnStatus]);

  const selectedCrmEvents = useMemo(() => {
    if (!selectedCrmClienteId) return [];
    return churnEvents.filter(e => e.cliente_id === selectedCrmClienteId);
  }, [selectedCrmClienteId, churnEvents]);

  const selectedCrmChamados = useMemo(() => {
    if (!selectedCrmClienteId) return [];
    return rawChamados.filter(c => {
      const id = typeof c.id_cliente === "string" ? parseInt(c.id_cliente as any) : c.id_cliente;
      return id === selectedCrmClienteId;
    });
  }, [selectedCrmClienteId, rawChamados]);

  // Função auxiliar para parsear data
  const parseData = (dataStr: string) => {
    try {
      const [datePart, timePart] = dataStr.split(" ");
      let dia: string, mes: string, ano: string;
      if (datePart.includes("-")) {
        [ano, mes, dia] = datePart.split("-");
      } else {
        [dia, mes, ano] = datePart.split("/");
      }
      const [hora, min, seg] = (timePart || "00:00:00").split(":");
      return new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia), parseInt(hora || "0"), parseInt(min || "0"), parseInt(seg || "0")).getTime();
    } catch (e) {
      return 0;
    }
  };

  // Agrupar e processar clientes
  const clientesCriticos = useMemo(() => {
    const todosChamadosPorCliente = chamados.reduce(
      (acc, chamado) => {
        const idCliente = String(chamado["ID Cliente"] || "").trim();
        const protocolo = chamado.Protocolo || "";
        if (!idCliente) return acc;

        if (!acc[idCliente]) {
          acc[idCliente] = { principal: chamado, todos: [chamado], protocolosUnicos: new Set([protocolo]) };
        } else {
          if (protocolo && !acc[idCliente].protocolosUnicos.has(protocolo)) {
            acc[idCliente].todos.push(chamado);
            acc[idCliente].protocolosUnicos.add(protocolo);
          } else if (!protocolo) {
            acc[idCliente].todos.push(chamado);
          }
          const dataAtual = parseData(acc[idCliente].principal["Data de Abertura"] || "");
          const dataNovo = parseData(chamado["Data de Abertura"] || "");
          if (dataNovo > dataAtual) acc[idCliente].principal = chamado;
        }
        return acc;
      },
      {} as Record<string, { principal: Chamado; todos: Chamado[]; protocolosUnicos: Set<string> }>,
    );

    Object.entries(todosChamadosPorCliente).forEach(([, { principal, protocolosUnicos, todos }]) => {
      const qtdReal = protocolosUnicos.size > 0 ? protocolosUnicos.size : todos.length;
      principal["Qtd. Chamados"] = qtdReal;
    });

    let clientesParaMostrar = Object.values(todosChamadosPorCliente);

    if (periodo !== "todos") {
      const diasAtras = parseInt(periodo);
      const hoje = new Date(dataMaisRecente.getFullYear(), dataMaisRecente.getMonth(), dataMaisRecente.getDate(), 0, 0, 0);
      let dataLimite: Date;
      if (diasAtras === 0) { dataLimite = hoje; }
      else if (diasAtras === 1) { dataLimite = new Date(hoje); dataLimite.setDate(dataLimite.getDate() - 1); }
      else { dataLimite = new Date(hoje); dataLimite.setDate(dataLimite.getDate() - diasAtras); }

      clientesParaMostrar = clientesParaMostrar.filter(({ principal }) => {
        try {
          const dataString = principal["Data de Abertura"];
          const [datePart] = dataString.split(" ");
          let dia: string, mes: string, ano: string;
          if (datePart.includes("-")) { [ano, mes, dia] = datePart.split("-"); }
          else { [dia, mes, ano] = datePart.split("/"); }
          const dataAbertura = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia), 0, 0, 0);
          return dataAbertura >= dataLimite;
        } catch (e) { return true; }
      });
    }

    if (status !== "todos") clientesParaMostrar = clientesParaMostrar.filter(({ principal }) => principal.Status === status);
    if (urgencia !== "todas") clientesParaMostrar = clientesParaMostrar.filter(({ principal }) => principal.Urgência === urgencia);
    if (setor !== "todos") clientesParaMostrar = clientesParaMostrar.filter(({ principal }) => principal.Setor?.trim() === setor.trim());

    return clientesParaMostrar
      .map(({ principal, todos }) => {
        const ordenados = [...todos].sort((a, b) => parseData(b["Data de Abertura"]) - parseData(a["Data de Abertura"]));
        const chamadosAnteriores = ordenados.slice(1);
        return { ...principal, "Qtd. Chamados": todos.length, _chamadosAnteriores: chamadosAnteriores };
      })
      .sort((a, b) => b["Qtd. Chamados"] - a["Qtd. Chamados"]);
  }, [chamados, periodo, status, urgencia, setor, dataMaisRecente]);

  const churnMap = useMemo(() => {
    const m = new Map<number, { score: number; bucket: string }>();
    scoreMap.forEach((val, clienteId) => {
      m.set(clienteId, { score: val.score, bucket: val.bucket });
    });
    return m;
  }, [scoreMap]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Chamados Frequentes
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                Análise operacional de chamados · {ispNome}
              </p>
            </div>
            <IspActions />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6 space-y-6">
        {isLoading ? (
          <LoadingScreen />
        ) : chamados.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
              <div>
                <h3 className="text-lg font-semibold">Nenhum chamado encontrado</h3>
                <p className="text-muted-foreground">Aguardando dados...</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <DashboardFilters
              periodo={periodo}
              status={status}
              urgencia={urgencia}
              setor={setor}
              onPeriodoChange={(v) => setFilter("periodo", v)}
              onStatusChange={(v) => setFilter("status", v)}
              onUrgenciaChange={(v) => setFilter("urgencia", v)}
              onSetorChange={(v) => setFilter("setor", v)}
            />

            {/* KPIs — using KPICardNew for visual consistency */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <KPICardNew
                title="Total Chamados"
                value={kpis.totalChamados.toLocaleString()}
                subtitle="no período"
                icon={Phone}
                variant="info"
              />
              <KPICardNew
                title="Tempo Médio"
                value={`${kpis.tempoMedio}h`}
                subtitle="de atendimento"
                icon={Clock}
                variant="default"
              />
              <KPICardNew
                title="Reincidentes"
                value={`${kpis.percentualReincidentes}%`}
                subtitle={`${kpis.reincidentes} chamados`}
                icon={RefreshCcw}
                variant="danger"
              />
              <KPICardNew
                title="Resolvidos < 24h"
                value={`${kpis.totalChamados > 0 ? ((kpis.chamadosResolvidos / kpis.totalChamados) * 100).toFixed(0) : 0}%`}
                subtitle={`${kpis.chamadosResolvidos} chamados`}
                icon={CheckCircle2}
                variant="success"
              />
              <KPICardNew
                title="Chamados Abertos"
                value={`${kpis.percentualAbertos}%`}
                subtitle={`${kpis.chamadosAbertos} ativos`}
                icon={AlertCircle}
                variant="warning"
              />
              <KPICardNew
                title="Urgência Alta"
                value={kpis.urgenciaAlta.toString()}
                subtitle={`${kpis.urgenciaMedia} média · ${kpis.urgenciaBaixa} baixa`}
                icon={AlertTriangle}
                variant={kpis.urgenciaAlta > 0 ? "danger" : "default"}
              />
            </div>

            {/* Performance Charts */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Performance e Tendências</h2>
              </div>
              <PerformanceCharts chamados={filteredChamados} />
            </section>

            {/* Clientes Críticos */}
            <section>
              <div className="mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <h2 className="text-lg font-semibold">Clientes em Risco</h2>
                </div>
                <p className="text-sm text-muted-foreground mt-1 ml-7">
                  Clientes com abertura frequente de chamados no período selecionado
                </p>
              </div>
              <ClientesTable chamados={clientesCriticos} onClienteClick={handleClienteClick} onOpenProfile={handleOpenProfile} churnMap={churnMap} />
            </section>

            {/* Insights */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Insights Automáticos</h2>
              </div>
              <InsightsPanel chamados={filteredChamados} />
            </section>
          </>
        )}
      </main>

      <ClienteDetailsSheet chamado={selectedCliente} open={sheetOpen} onOpenChange={setSheetOpen} />

      {/* CRM Profile Drawer */}
      {selectedCrmCliente && (
        <CrmDrawer
          cliente={selectedCrmCliente}
          score={getScoreTotalReal(selectedCrmCliente)}
          bucket={getBucket(getScoreTotalReal(selectedCrmCliente))}
          workflow={workflowMap.get(selectedCrmCliente.cliente_id)}
          events={selectedCrmEvents}
          chamadosCliente={selectedCrmChamados}
          onClose={() => setFilter("selectedCrmClienteId", "")}
          onStartTreatment={async () => {
            await addToWorkflow(selectedCrmCliente.cliente_id);
          }}
          onUpdateStatus={async (status) => {
            await updateStatus(selectedCrmCliente.cliente_id, status);
          }}
          onUpdateTags={async (tags) => {
            await updateTags(selectedCrmCliente.cliente_id, tags);
          }}
          onUpdateOwner={async (ownerId) => {
            await updateOwner(selectedCrmCliente.cliente_id, ownerId);
          }}
        />
      )}
    </div>
  );
};

export default Index;
