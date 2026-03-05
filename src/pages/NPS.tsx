import { useState, useMemo, useCallback } from "react";
import { usePageFilters } from "@/hooks/usePageFilters";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveIsp } from "@/hooks/useActiveIsp";
import { useNPSData } from "@/hooks/useNPSData";
import { useChurnData } from "@/hooks/useChurnData";
import { useChurnScore } from "@/hooks/useChurnScore";
import { useRiskBucketConfig } from "@/hooks/useRiskBucketConfig";
import { useCrmWorkflow } from "@/hooks/useCrmWorkflow";
import { useChamados } from "@/hooks/useChamados";
import { CrmDrawer } from "@/components/crm/CrmDrawer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ThumbsUp, Gauge, Wrench, BarChart3, Upload, Sparkles,
  TrendingUp, MessageSquarePlus, Percent,
} from "lucide-react";
import { NPSFilters } from "@/components/nps/NPSFilters";
import { IspActions } from "@/components/shared/IspActions";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { NPSKPICard } from "@/components/nps/NPSKPICard";
import { NPSCharts } from "@/components/nps/NPSCharts";
import { NPSTable } from "@/components/nps/NPSTable";
import { NPSInsightsPanel } from "@/components/nps/NPSInsightsPanel";
import { NPSImportDialog } from "@/components/nps/NPSImportDialog";
import { RespostaNPS, ClassificacaoNPS, TipoNPS } from "@/types/nps";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const NPS = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signOut } = useAuth();
  const { ispId, ispNome } = useActiveIsp();
  const queryClient = useQueryClient();
  const { npsData, isLoading } = useNPSData(ispId);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedClienteId, setSelectedClienteId] = useState<number | null>(null);

  // CRM hooks for profile drawer
  const { churnStatus, churnEvents } = useChurnData();
  const { getScoreTotalReal } = useChurnScore();
  const { getBucket } = useRiskBucketConfig();
  const { workflowMap, addToWorkflow, updateStatus, updateTags, updateOwner } = useCrmWorkflow();
  const { chamados } = useChamados();

  const selectedCliente = useMemo(() => {
    if (!selectedClienteId) return null;
    return churnStatus.find(c => c.cliente_id === selectedClienteId) || null;
  }, [selectedClienteId, churnStatus]);

  const selectedEvents = useMemo(() => {
    if (!selectedClienteId) return [];
    return churnEvents.filter(e => e.cliente_id === selectedClienteId);
  }, [selectedClienteId, churnEvents]);

  const selectedChamados = useMemo(() => {
    if (!selectedClienteId) return [];
    return chamados.filter(c => {
      const id = typeof c.id_cliente === "string" ? parseInt(c.id_cliente as any) : c.id_cliente;
      return id === selectedClienteId;
    });
  }, [selectedClienteId, chamados]);

  // Filtros — persisted in sessionStorage for the session
  const { filters, setFilter } = usePageFilters("nps", {
    periodo: "30" as string,
    tipoNPS: "todos" as string,
    classificacao: "todos" as string,
  });
  const { periodo, tipoNPS, classificacao } = filters;

  const mapTipoNPS = (tipo: string): TipoNPS => {
    const tipoLower = tipo?.toLowerCase().trim() || "";
    if (tipoLower === "contrato") return "contrato";
    if (tipoLower === "ordem_servico" || tipoLower.includes("os") || tipoLower.includes("o.s") || tipoLower.includes("ordem") || tipoLower.includes("pós")) return "os";
    return "contrato";
  };

  const calcClassificacao = (nota: number): ClassificacaoNPS => {
    if (nota <= 6) return "Detrator";
    if (nota <= 8) return "Neutro";
    return "Promotor";
  };

  // Transform hook data to RespostaNPS[]
  const respostasNPS = useMemo((): RespostaNPS[] => {
    return npsData.map((item) => ({
      cliente_id: item.cliente_id,
      cliente_nome: "N/A",
      tipo_nps: mapTipoNPS(item.tipo_nps),
      nota: item.nota,
      classificacao: item.classificacao,
      comentario: "",
      data_resposta: item.data_resposta || new Date().toISOString().split("T")[0],
      celular: "",
    }));
  }, [npsData]);

  const handleRefreshNPS = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["nps-data", ispId] });
  }, [queryClient, ispId]);

  const dataReferencia = useMemo(() => {
    if (respostasNPS.length === 0) return new Date();
    const datas = respostasNPS.map((r) => new Date(r.data_resposta).getTime());
    return new Date(Math.max(...datas));
  }, [respostasNPS]);

  // Filter out "atendimento" type globally
  const respostasSemAtendimento = useMemo(() => 
    respostasNPS.filter(r => r.tipo_nps !== "atendimento"),
    [respostasNPS]
  );

  const filteredRespostas = useMemo(() => {
    let filtered = [...respostasSemAtendimento];

    if (periodo !== "todos") {
      const diasAtras = parseInt(periodo);
      const dataLimite = new Date(dataReferencia);
      dataLimite.setDate(dataLimite.getDate() - diasAtras);
      dataLimite.setHours(0, 0, 0, 0);
      filtered = filtered.filter((r) => new Date(r.data_resposta) >= dataLimite);
    }
    if (tipoNPS !== "todos") {
      filtered = filtered.filter((r) => r.tipo_nps === tipoNPS);
    }
    if (classificacao !== "todos") {
      filtered = filtered.filter((r) => r.classificacao === classificacao);
    }
    return filtered;
  }, [respostasSemAtendimento, periodo, tipoNPS, classificacao, dataReferencia]);

  // KPIs
  const kpis = useMemo(() => {
    const calcMedia = (respostas: RespostaNPS[]) => {
      if (respostas.length === 0) return 0;
      return Number((respostas.reduce((acc, r) => acc + r.nota, 0) / respostas.length).toFixed(1));
    };

    const respondidas = filteredRespostas.length;
    const totalPesquisas = respostasSemAtendimento.length;
    const taxaResposta = totalPesquisas > 0 ? Math.round((respondidas / totalPesquisas) * 100) : 0;

    return {
      geral: calcMedia(filteredRespostas),
      contrato: calcMedia(filteredRespostas.filter((r) => r.tipo_nps === "contrato")),
      os: calcMedia(filteredRespostas.filter((r) => r.tipo_nps === "os")),
      taxaResposta,
      totalRespostas: respondidas,
    };
  }, [filteredRespostas, respostasSemAtendimento]);

  // Empty state
  if (!isLoading && respostasNPS.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm shadow-sm">
          <div className="container mx-auto px-6 py-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Monitor de NPS
                </h1>
                <p className="text-muted-foreground text-sm mt-0.5">{ispNome}</p>
              </div>
              <IspActions />
            </div>
          </div>
        </header>
        <main className="container mx-auto px-6 py-16">
          <div className="max-w-2xl mx-auto text-center space-y-8">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <MessageSquarePlus className="h-10 w-10 text-primary" />
            </div>
            <div className="space-y-3">
              <h2 className="text-2xl font-bold">Nenhum dado NPS disponível</h2>
              <p className="text-muted-foreground">
                Para acompanhar a satisfação dos seus clientes, você pode ativar o agente
                <span className="font-semibold text-primary"> NPS Check Uniforce</span> ou importar seus dados manualmente.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer">
                <CardContent className="p-6 text-center space-y-3">
                  <Sparkles className="h-8 w-8 text-primary mx-auto" />
                  <h3 className="font-semibold">NPS Check Uniforce</h3>
                  <p className="text-xs text-muted-foreground">
                    Automação inteligente de pesquisas NPS integrada ao seu provedor.
                    Coleta automática via WhatsApp com análise em tempo real.
                  </p>
                  <Button size="sm" className="w-full">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Saiba Mais
                  </Button>
                </CardContent>
              </Card>

              <Card className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setImportOpen(true)}>
                <CardContent className="p-6 text-center space-y-3">
                  <Upload className="h-8 w-8 text-muted-foreground mx-auto" />
                  <h3 className="font-semibold">Importar Manualmente</h3>
                  <p className="text-xs text-muted-foreground">
                    Faça upload de dados via arquivo CSV. Baixe o template,
                    preencha com seus dados e importe para o dashboard.
                  </p>
                  <Button size="sm" variant="outline" className="w-full">
                    <Upload className="h-4 w-4 mr-2" />
                    Importar CSV
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
          <NPSImportDialog open={importOpen} onOpenChange={setImportOpen} onSuccess={handleRefreshNPS} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm shadow-sm">
        <div className="container mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Monitor de NPS
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">{ispNome} - Satisfação do Cliente</p>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Importar
              </Button>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ThumbsUp className="h-5 w-5" />
                <span>{filteredRespostas.length} respostas</span>
              </div>
              <IspActions />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-8">
        {isLoading ? (
          <LoadingScreen />
        ) : (
          <>
            <NPSFilters
              periodo={periodo}
              tipoNPS={tipoNPS}
              classificacao={classificacao}
              onPeriodoChange={(v) => setFilter("periodo", v)}
              onTipoNPSChange={(v) => setFilter("tipoNPS", v)}
              onClassificacaoChange={(v) => setFilter("classificacao", v)}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <NPSKPICard title="NPS Geral" value={kpis.geral} icon={Gauge} count={filteredRespostas.length} />
              <NPSKPICard title="NPS Contrato" value={kpis.contrato} icon={ThumbsUp} count={filteredRespostas.filter((r) => r.tipo_nps === "contrato").length} />
              <NPSKPICard title="NPS Pós-O.S" value={kpis.os} icon={Wrench} count={filteredRespostas.filter((r) => r.tipo_nps === "os").length} />
              <NPSKPICard title="Taxa de Resposta" value={kpis.taxaResposta} icon={Percent} count={kpis.totalRespostas} isPercentage />
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Performance e Tendências
              </h2>
              <NPSCharts respostas={filteredRespostas} />
            </div>

            <NPSInsightsPanel respostas={filteredRespostas} />
            <NPSTable respostas={filteredRespostas} onOpenProfile={(id) => setSelectedClienteId(id)} />
          </>
        )}
        <NPSImportDialog open={importOpen} onOpenChange={setImportOpen} onSuccess={handleRefreshNPS} />

        {selectedCliente && (
          <CrmDrawer
            cliente={selectedCliente}
            score={getScoreTotalReal(selectedCliente)}
            bucket={getBucket(getScoreTotalReal(selectedCliente))}
            workflow={workflowMap.get(selectedCliente.cliente_id)}
            events={selectedEvents}
            chamadosCliente={selectedChamados}
            onClose={() => setSelectedClienteId(null)}
            onStartTreatment={() => addToWorkflow(selectedCliente.cliente_id)}
            onUpdateStatus={(s) => updateStatus(selectedCliente.cliente_id, s)}
            onUpdateTags={(t) => updateTags(selectedCliente.cliente_id, t)}
            onUpdateOwner={(o) => updateOwner(selectedCliente.cliente_id, o || "")}
          />
        )}
      </main>
    </div>
  );
};

export default NPS;
