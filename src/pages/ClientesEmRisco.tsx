import { useState, useMemo, useCallback } from "react";
import { safeFormatDate } from "@/lib/safeDate";
import { useChurnData, ChurnStatus } from "@/hooks/useChurnData";
import { useChamados } from "@/hooks/useChamados";
import { useActiveIsp } from "@/hooks/useActiveIsp";
import { useChurnScoreConfig, calcScoreSuporteConfiguravel } from "@/contexts/ChurnScoreConfigContext";
import { useRiskBucketConfig, RiskBucket } from "@/hooks/useRiskBucketConfig";
import { useCrmWorkflow, WorkflowStatus } from "@/hooks/useCrmWorkflow";
import { IspActions } from "@/components/shared/IspActions";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { KanbanBoard } from "@/components/crm/KanbanBoard";
import { CrmDrawer } from "@/components/crm/CrmDrawer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Users, DollarSign, Target, Clock, AlertCircle, TrendingDown, ShieldAlert, ThumbsDown, ThumbsUp, Minus, PlayCircle, CheckCircle2, XCircle, Tag, LayoutList, Columns, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

const BUCKET_COLORS: Record<RiskBucket, string> = {
  OK: "bg-green-100 text-green-800 border-green-200",
  ALERTA: "bg-yellow-100 text-yellow-800 border-yellow-200",
  "CRÍTICO": "bg-red-100 text-red-800 border-red-200",
};

const PRIORIDADE_COLORS: Record<string, string> = {
  P0: "bg-red-100 text-red-800 border-red-300",
  P1: "bg-orange-100 text-orange-800 border-orange-300",
  P2: "bg-yellow-100 text-yellow-800 border-yellow-300",
  P3: "bg-gray-100 text-gray-700 border-gray-200",
};

const STATUS_INTERNET: Record<string, string> = {
  A: "Ativo", CA: "Bloq. Cob. Auto", CM: "Bloq. Cob. Manual",
  B: "Bloqueado", D: "Cancelado", FA: "Férias", S: "Suspenso",
};

function getPrioridade(c: ChurnStatus, bucket: RiskBucket): string {
  const ltv = c.ltv_estimado ?? 0;
  if (ltv >= 3000 && bucket === "CRÍTICO") return "P0";
  if (ltv >= 3000 && bucket === "ALERTA") return "P1";
  if (bucket === "CRÍTICO") return "P1";
  if (ltv >= 1500 && bucket === "ALERTA") return "P2";
  if (bucket === "ALERTA") return "P2";
  return "P3";
}

function ScoreBadge({ score, bucket }: { score?: number; bucket?: RiskBucket }) {
  const cls = BUCKET_COLORS[bucket || "OK"] || "bg-muted text-muted-foreground";
  return <Badge className={`${cls} font-mono text-xs border`}>{score != null ? score : bucket || "—"}</Badge>;
}

function NPSBadge({ classificacao, nota }: { classificacao?: string; nota?: number }) {
  if (!classificacao && nota == null) return <span className="text-xs text-muted-foreground">—</span>;
  const c = (classificacao || "").toUpperCase();
  if (c === "DETRATOR") return <Badge className="bg-red-100 text-red-800 border-red-200 border text-[10px] gap-1"><ThumbsDown className="h-2.5 w-2.5" />{nota ?? "Detrator"}</Badge>;
  if (c === "NEUTRO") return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 border text-[10px] gap-1"><Minus className="h-2.5 w-2.5" />{nota ?? "Neutro"}</Badge>;
  if (c === "PROMOTOR") return <Badge className="bg-green-100 text-green-800 border-green-200 border text-[10px] gap-1"><ThumbsUp className="h-2.5 w-2.5" />{nota ?? "Promotor"}</Badge>;
  return <span className="text-xs text-muted-foreground">—</span>;
}

const ClientesEmRisco = () => {
  const { churnStatus, churnEvents, isLoading, error } = useChurnData();
  const { getChamadosPorCliente } = useChamados();
  const { ispId } = useActiveIsp();
  const { config } = useChurnScoreConfig();
  const { getBucket } = useRiskBucketConfig();
  const { workflowMap, addToWorkflow, updateStatus, updateTags, updateOwner } = useCrmWorkflow();
  const { toast } = useToast();

  const chamadosPorClienteMap = useMemo(() => ({
    d30: getChamadosPorCliente(30),
    d90: getChamadosPorCliente(90),
  }), [getChamadosPorCliente]);

  const npsMap = useMemo(() => {
    const m = new Map<number, { nota: number; classificacao: string; data: string | null }>();
    churnStatus.forEach((c) => {
      if (c.nps_ultimo_score != null && c.nps_classificacao) {
        m.set(c.cliente_id, { nota: c.nps_ultimo_score, classificacao: c.nps_classificacao.toUpperCase(), data: (c as any).nps_data ?? null });
      }
    });
    return m;
  }, [churnStatus]);

  // Filters
  const [scoreMin, setScoreMin] = useState(0);
  const [bucket, setBucket] = useState("todos");
  const [plano, setPlano] = useState("todos");
  const [cidade, setCidade] = useState("todos");
  const [bairro, setBairro] = useState("todos");
  const [selectedCliente, setSelectedCliente] = useState<ChurnStatus | null>(null);
  const [viewMode, setViewMode] = useState<"lista" | "kanban">("kanban");

  const clientesRisco = useMemo(() => churnStatus.filter((c) => c.status_churn === "risco"), [churnStatus]);

  const filterOptions = useMemo(() => {
    const planos = new Set<string>();
    const cidades = new Set<string>();
    const bairros = new Set<string>();
    clientesRisco.forEach((c) => {
      if (c.plano_nome) planos.add(c.plano_nome);
      if (c.cliente_cidade) cidades.add(c.cliente_cidade);
      if (c.cliente_bairro) bairros.add(c.cliente_bairro);
    });
    return {
      planos: Array.from(planos).sort(),
      cidades: Array.from(cidades).sort(),
      bairros: Array.from(bairros).sort(),
    };
  }, [clientesRisco]);

  const getScoreSuporteReal = useCallback((cliente: ChurnStatus): number => {
    const ch30 = chamadosPorClienteMap.d30.get(cliente.cliente_id)?.chamados_periodo ?? 0;
    const ch90 = chamadosPorClienteMap.d90.get(cliente.cliente_id)?.chamados_periodo ?? 0;
    return calcScoreSuporteConfiguravel(ch30, ch90, config);
  }, [chamadosPorClienteMap, config]);

  const getScoreNPSReal = useCallback((cliente: ChurnStatus): number => {
    const nps = npsMap.get(cliente.cliente_id);
    if (nps?.classificacao === "DETRATOR") return config.npsDetrator;
    return cliente.score_nps ?? 0;
  }, [npsMap, config]);

  const getScoreTotalReal = useCallback((cliente: ChurnStatus): number => {
    const suporteReal = getScoreSuporteReal(cliente);
    const npsReal = getScoreNPSReal(cliente);
    const financeiro = Math.round(((cliente.score_financeiro ?? 0) / 30) * config.faturaAtrasada);
    const qualidadeBase = 25;
    const qualidade = Math.round(((cliente.score_qualidade ?? 0) / qualidadeBase) * config.qualidade);
    const comportamental = Math.round(((cliente.score_comportamental ?? 0) / 20) * config.comportamental);
    return Math.max(0, Math.min(500, financeiro + suporteReal + comportamental + qualidade + npsReal));
  }, [getScoreSuporteReal, getScoreNPSReal, config]);

  const filtered = useMemo(() => {
    let f = [...clientesRisco];
    if (scoreMin > 0) f = f.filter((c) => getScoreTotalReal(c) >= scoreMin);
    if (bucket !== "todos") f = f.filter((c) => getBucket(getScoreTotalReal(c)) === bucket);
    if (plano !== "todos") f = f.filter((c) => c.plano_nome === plano);
    if (cidade !== "todos") f = f.filter((c) => c.cliente_cidade === cidade);
    if (bairro !== "todos") f = f.filter((c) => c.cliente_bairro === bairro);
    return f.sort((a, b) => getScoreTotalReal(b) - getScoreTotalReal(a) || (b.dias_atraso || 0) - (a.dias_atraso || 0));
  }, [clientesRisco, scoreMin, bucket, plano, cidade, bairro, getScoreTotalReal, getBucket]);

  const kpis = useMemo(() => {
    const totalRisco = filtered.length;
    const mrrRisco = filtered.reduce((acc, c) => acc + (c.valor_mensalidade || 0), 0);
    const ltvRisco = filtered.reduce((acc, c) => acc + (c.ltv_estimado || 0), 0);
    const scores = filtered.map((c) => getScoreTotalReal(c));
    const scoreMedio = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "—";
    const bloqueadosCobranca = filtered.filter(c => ["CA", "CM", "B"].includes(c.status_internet || "")).length;
    return { totalRisco, mrrRisco, ltvRisco, scoreMedio, bloqueadosCobranca };
  }, [filtered, getScoreTotalReal]);

  const hasActiveFilters = scoreMin > 0 || bucket !== "todos" || plano !== "todos" || cidade !== "todos" || bairro !== "todos";

  const clearFilters = () => {
    setScoreMin(0);
    setBucket("todos");
    setPlano("todos");
    setCidade("todos");
    setBairro("todos");
  };

  // Events for selected client
  const clienteEvents = useMemo(() => {
    if (!selectedCliente) return [];
    const eventos = churnEvents
      .filter((e) => e.cliente_id === selectedCliente.cliente_id)
      .filter((e) => e.tipo_evento !== "chamado_reincidente")
      .filter((e) => e.tipo_evento !== "nps_detrator")
      .slice(0, 15);

    const ch30Real = chamadosPorClienteMap.d30.get(selectedCliente.cliente_id)?.chamados_periodo ?? 0;
    const rawUltimoChamado = chamadosPorClienteMap.d30.get(selectedCliente.cliente_id)?.ultimo_chamado ?? selectedCliente.ultimo_atendimento_data ?? new Date().toISOString();
    const ultimoChamadoData = typeof rawUltimoChamado === "string" ? rawUltimoChamado.replace(" ", "T") : new Date().toISOString();
    if (ch30Real >= 2) {
      const impacto = ch30Real >= 3 ? config.chamados30dBase + (ch30Real - 2) * config.chamadoAdicional : config.chamados30dBase;
      eventos.unshift({
        id: "real-reincidente", isp_id: selectedCliente.isp_id, cliente_id: selectedCliente.cliente_id,
        id_contrato: null, tipo_evento: "chamado_reincidente", peso_evento: ch30Real >= 3 ? 3 : 2,
        impacto_score: impacto, descricao: `${ch30Real} chamados nos últimos 30 dias — impacto de +${impacto}pts`,
        dados_evento: { qtd_chamados_30d_real: ch30Real }, data_evento: ultimoChamadoData, created_at: ultimoChamadoData,
      });
    }

    const npsCliente = npsMap.get(selectedCliente.cliente_id);
    if (npsCliente?.classificacao === "DETRATOR") {
      const npsData = npsCliente.data ?? new Date().toISOString();
      eventos.unshift({
        id: "real-nps-detrator", isp_id: selectedCliente.isp_id, cliente_id: selectedCliente.cliente_id,
        id_contrato: null, tipo_evento: "nps_detrator", peso_evento: 4, impacto_score: config.npsDetrator,
        descricao: `NPS Detrator — nota ${npsCliente.nota}/10 — impacto de +${config.npsDetrator}pts`,
        dados_evento: { nota_nps: npsCliente.nota, classificacao: npsCliente.classificacao },
        data_evento: npsData, created_at: npsData,
      });
    }

    return eventos;
  }, [selectedCliente, churnEvents, chamadosPorClienteMap, npsMap, config]);

  // Handlers
  const handleStartTreatment = useCallback(async (c: ChurnStatus) => {
    const autoTags: string[] = [];
    const b = getBucket(getScoreTotalReal(c));
    if (b === "CRÍTICO") autoTags.push("Crítico");
    if ((c.ltv_estimado ?? 0) >= 3000) autoTags.push("Alto Ticket");
    const nps = npsMap.get(c.cliente_id);
    if (nps?.classificacao === "DETRATOR") autoTags.push("NPS Detrator");
    if ((c.score_financeiro ?? 0) >= 20) autoTags.push("Financeiro");
    await addToWorkflow(c.cliente_id, autoTags);
    toast({ title: "Cliente adicionado ao workflow" });
  }, [getBucket, getScoreTotalReal, npsMap, addToWorkflow, toast]);

  const handleUpdateStatus = useCallback(async (clienteId: number, status: WorkflowStatus) => {
    await updateStatus(clienteId, status);
    toast({ title: `Marcado como ${status}` });
  }, [updateStatus, toast]);

  if (isLoading) return <div className="min-h-screen bg-background"><LoadingScreen /></div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Clientes em Risco</h1>
              <p className="text-muted-foreground text-sm mt-0.5">{clientesRisco.length.toLocaleString()} clientes com sinais de risco</p>
            </div>
            <IspActions />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-4 space-y-3">
        {error && (
          <div className="flex items-center gap-2 text-destructive bg-destructive/10 rounded-lg p-4">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Erro ao carregar dados: {error}</span>
          </div>
        )}

        {/* Compact bar: KPIs + Filters */}
        <Card>
          <CardContent className="py-2.5 px-4">
            {/* KPIs inline */}
            <div className="flex flex-wrap items-center gap-4 mb-2 pb-2 border-b border-border/50">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                <span className="text-xs text-muted-foreground">Risco:</span>
                <span className="text-sm font-bold">{kpis.totalRisco}</span>
              </div>
              {kpis.mrrRisco > 0 && (
                <div className="flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-yellow-600" />
                  <span className="text-xs text-muted-foreground">MRR:</span>
                  <span className="text-sm font-bold">R$ {kpis.mrrRisco.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</span>
                </div>
              )}
              {kpis.ltvRisco > 0 && (
                <div className="flex items-center gap-1.5">
                  <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                  <span className="text-xs text-muted-foreground">LTV:</span>
                  <span className="text-sm font-bold">R$ {kpis.ltvRisco.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs text-muted-foreground">Score:</span>
                <span className="text-sm font-bold">{kpis.scoreMedio}</span>
              </div>
              {kpis.bloqueadosCobranca > 0 && (
                <div className="flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5 text-yellow-600" />
                  <span className="text-xs text-muted-foreground">Bloq:</span>
                  <span className="text-sm font-bold">{kpis.bloqueadosCobranca}</span>
                </div>
              )}

              {/* View toggle (right side) */}
              <div className="flex items-center gap-1.5 ml-auto">
                <Button variant={viewMode === "kanban" ? "default" : "outline"} size="sm" className="h-7 text-xs gap-1" onClick={() => setViewMode("kanban")}>
                  <Columns className="h-3.5 w-3.5" />Kanban
                </Button>
                <Button variant={viewMode === "lista" ? "default" : "outline"} size="sm" className="h-7 text-xs gap-1" onClick={() => setViewMode("lista")}>
                  <LayoutList className="h-3.5 w-3.5" />Lista
                </Button>
              </div>
            </div>

            {/* Filters row */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 min-w-[160px]">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Score Mín.</span>
                  <span className="text-xs font-mono font-bold">{scoreMin}</span>
                </div>
                <div className="w-24">
                  <Slider min={0} max={100} step={5} value={[scoreMin]} onValueChange={(v) => setScoreMin(v[0])} />
                </div>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Bucket</span>
                <Select value={bucket} onValueChange={setBucket}>
                  <SelectTrigger className="h-7 text-xs w-[100px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="CRÍTICO">Crítico</SelectItem>
                    <SelectItem value="ALERTA">Alerta</SelectItem>
                    <SelectItem value="OK">OK</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {filterOptions.planos.length > 0 && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Plano</span>
                  <Select value={plano} onValueChange={setPlano}>
                    <SelectTrigger className="h-7 text-xs w-[130px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {filterOptions.planos.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {filterOptions.cidades.length > 0 && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Cidade</span>
                  <Select value={cidade} onValueChange={setCidade}>
                    <SelectTrigger className="h-7 text-xs w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas</SelectItem>
                      {filterOptions.cidades.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {filterOptions.bairros.length > 0 && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Bairro</span>
                  <Select value={bairro} onValueChange={setBairro}>
                    <SelectTrigger className="h-7 text-xs w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {filterOptions.bairros.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={clearFilters}>
                  <X className="h-3 w-3" />Limpar
                </Button>
              )}

              <span className="ml-auto text-xs text-muted-foreground">
                {filtered.length.toLocaleString()} clientes
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Kanban or Lista */}
        {viewMode === "kanban" ? (
          <KanbanBoard
            clientes={filtered}
            getScore={getScoreTotalReal}
            getBucket={getBucket}
            workflowMap={workflowMap}
            onSelectCliente={setSelectedCliente}
            onStartTreatment={handleStartTreatment}
            onUpdateStatus={handleUpdateStatus}
          />
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Clientes em Risco — ordenados por criticidade</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-[calc(100vh-300px)]">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead className="text-xs whitespace-nowrap">Cliente</TableHead>
                      <TableHead className="text-xs whitespace-nowrap text-center">Score/Bucket</TableHead>
                      <TableHead className="text-xs whitespace-nowrap text-center">Dias Atraso</TableHead>
                      <TableHead className="text-xs whitespace-nowrap text-center">NPS</TableHead>
                      <TableHead className="text-xs whitespace-nowrap">Internet</TableHead>
                      <TableHead className="text-xs whitespace-nowrap text-right">Mensalidade</TableHead>
                      <TableHead className="text-xs whitespace-nowrap">Motivo</TableHead>
                      <TableHead className="text-xs whitespace-nowrap">CRM</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-10 text-sm">
                          Nenhum cliente em risco com os filtros aplicados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((c) => {
                        const derivedBucket = getBucket(getScoreTotalReal(c));
                        const npsCliente = npsMap.get(c.cliente_id);
                        const wf = workflowMap.get(c.cliente_id);
                        return (
                          <TableRow key={c.id || c.cliente_id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedCliente(c)}>
                            <TableCell className="text-xs font-medium max-w-[140px] truncate">{c.cliente_nome}</TableCell>
                            <TableCell className="text-center"><ScoreBadge score={getScoreTotalReal(c)} bucket={derivedBucket} /></TableCell>
                            <TableCell className="text-center text-xs">
                              {c.dias_atraso != null && c.dias_atraso > 0 ? (
                                <span className={c.dias_atraso > 30 ? "text-destructive font-medium" : "text-yellow-600"}>{Math.round(c.dias_atraso)}d</span>
                              ) : "—"}
                            </TableCell>
                            <TableCell className="text-center"><NPSBadge classificacao={npsCliente?.classificacao} nota={npsCliente?.nota} /></TableCell>
                            <TableCell className="text-xs">{STATUS_INTERNET[c.status_internet || ""] || c.status_internet || "—"}</TableCell>
                            <TableCell className="text-right text-xs">{c.valor_mensalidade ? `R$ ${c.valor_mensalidade.toFixed(2)}` : "—"}</TableCell>
                            <TableCell className="text-xs max-w-[150px] truncate text-muted-foreground">{c.motivo_risco_principal || "—"}</TableCell>
                            <TableCell>
                              {wf ? (
                                <Badge variant="outline" className={`text-[10px] ${wf.status_workflow === "em_tratamento" ? "text-yellow-600" : wf.status_workflow === "resolvido" ? "text-green-600" : "text-destructive"}`}>
                                  {wf.status_workflow === "em_tratamento" ? "Tratando" : wf.status_workflow === "resolvido" ? "Resolvido" : "Perdido"}
                                </Badge>
                              ) : <span className="text-[10px] text-muted-foreground">—</span>}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* CRM Drawer */}
      {selectedCliente && (
        <CrmDrawer
          cliente={selectedCliente}
          score={getScoreTotalReal(selectedCliente)}
          bucket={getBucket(getScoreTotalReal(selectedCliente))}
          workflow={workflowMap.get(selectedCliente.cliente_id)}
          events={clienteEvents}
          onClose={() => setSelectedCliente(null)}
          onStartTreatment={async () => {
            await handleStartTreatment(selectedCliente);
          }}
          onUpdateStatus={async (status) => {
            await handleUpdateStatus(selectedCliente.cliente_id, status);
          }}
          onUpdateTags={async (tags) => {
            await updateTags(selectedCliente.cliente_id, tags);
          }}
          onUpdateOwner={async (ownerId) => {
            await updateOwner(selectedCliente.cliente_id, ownerId);
          }}
        />
      )}
    </div>
  );
};

export default ClientesEmRisco;
