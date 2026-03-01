import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveIsp } from "@/hooks/useActiveIsp";
import { externalSupabase } from "@/integrations/supabase/external-client";
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

const NPS = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signOut } = useAuth();
  const { ispId, ispNome } = useActiveIsp();
  const [respostasNPS, setRespostasNPS] = useState<RespostaNPS[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);

  // Filtros
  const [periodo, setPeriodo] = useState("30");
  const [tipoNPS, setTipoNPS] = useState("todos");
  const [classificacao, setClassificacao] = useState("todos");

  const mapTipoNPS = (tipo: string): TipoNPS => {
    const tipoLower = tipo?.toLowerCase().trim() || "";
    if (tipoLower === "contrato") return "contrato";
    if (tipoLower === "ordem_servico" || tipoLower.includes("os") || tipoLower.includes("o.s") || tipoLower.includes("ordem") || tipoLower.includes("pós")) return "os";
    return "contrato"; // Default to contrato, no atendimento
  };

  const calcClassificacao = (nota: number): ClassificacaoNPS => {
    if (nota <= 6) return "Detrator";
    if (nota <= 8) return "Neutro";
    return "Promotor";
  };

  const fetchNPSData = useCallback(async () => {
    try {
      setIsLoading(true);
      // Total de pesquisas enviadas (inclui sem resposta) para taxa de resposta
      const { count: totalPesquisas } = await externalSupabase
        .from("nps_check")
        .select("*", { count: "exact", head: true })
        .eq("isp_id", ispId);

      // Apenas registros com resposta (data_resposta não nula)
      const { data, error } = await externalSupabase
        .from("nps_check")
        .select("*")
        .eq("isp_id", ispId)
        .not("data_resposta", "is", null)
        .order("data_resposta", { ascending: false })
        .limit(5000);

      if (error) throw error;

      const totalRecords = totalPesquisas || data?.length || 0;

      const respostasTransformadas: RespostaNPS[] = (data || [])
        .map((item: any) => {
          const rawNota = item.nota_numerica != null ? Number(item.nota_numerica) : Number(item.nota);
          const nota = (!isNaN(rawNota) && rawNota >= 0 && rawNota <= 10) ? rawNota : 0;

          const mapClassificacaoFromDB = (classif: string): ClassificacaoNPS => {
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
            classificacao: mapClassificacaoFromDB(item.classificacao_nps),
            comentario: item.mensagem_melhoria || item.comentario || "",
            data_resposta: item.data_resposta || new Date().toISOString().split("T")[0],
            celular: item.celular || item.telefone || "",
            // Store total records for taxa de resposta
            _totalPesquisas: totalRecords,
          };
        });

      setRespostasNPS(respostasTransformadas);
    } catch (error: any) {
      console.error("❌ Erro NPS:", error);
      toast({
        title: "Erro ao carregar dados NPS",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [ispId, toast]);

  useEffect(() => {
    fetchNPSData();
  }, [fetchNPSData]);

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
    // Taxa de resposta: respondidas (com nota) vs total de pesquisas enviadas
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
              {/* NPS Check CTA */}
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

              {/* Import CSV CTA */}
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
          <NPSImportDialog open={importOpen} onOpenChange={setImportOpen} onSuccess={fetchNPSData} />
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
              onPeriodoChange={setPeriodo}
              onTipoNPSChange={setTipoNPS}
              onClassificacaoChange={setClassificacao}
            />

            {/* KPIs - sem atendimento, com taxa de resposta */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <NPSKPICard
                title="NPS Geral"
                value={kpis.geral}
                icon={Gauge}
                count={filteredRespostas.length}
              />
              <NPSKPICard
                title="NPS Contrato"
                value={kpis.contrato}
                icon={ThumbsUp}
                count={filteredRespostas.filter((r) => r.tipo_nps === "contrato").length}
              />
              <NPSKPICard
                title="NPS Pós-O.S"
                value={kpis.os}
                icon={Wrench}
                count={filteredRespostas.filter((r) => r.tipo_nps === "os").length}
              />
              <NPSKPICard
                title="Taxa de Resposta"
                value={kpis.taxaResposta}
                icon={Percent}
                count={kpis.totalRespostas}
                isPercentage
              />
            </div>

            {/* Charts */}
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Performance e Tendências
              </h2>
              <NPSCharts respostas={filteredRespostas} />
            </div>

            {/* Insights */}
            <NPSInsightsPanel respostas={filteredRespostas} />

            {/* Table */}
            <NPSTable respostas={filteredRespostas} />
          </>
        )}
        <NPSImportDialog open={importOpen} onOpenChange={setImportOpen} onSuccess={fetchNPSData} />
      </main>
    </div>
  );
};

export default NPS;
