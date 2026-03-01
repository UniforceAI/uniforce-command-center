import { useState, useMemo, useCallback } from "react";
import { safeFormatDate } from "@/lib/safeDate";
import { ChurnStatus } from "@/hooks/useChurnData";
import { useChamados } from "@/hooks/useChamados";
import { useActiveIsp } from "@/hooks/useActiveIsp";
import { useChurnScoreConfig, calcScoreSuporteConfiguravel, calcScoreFinanceiroConfiguravel } from "@/contexts/ChurnScoreConfigContext";
import { useRiskBucketConfig, RiskBucket } from "@/hooks/useRiskBucketConfig";
import { useCrmWorkflow, WorkflowStatus } from "@/hooks/useCrmWorkflow";
import { useChurnScore } from "@/hooks/useChurnScore";
import { IspActions } from "@/components/shared/IspActions";
import { ActionMenu } from "@/components/shared/ActionMenu";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { KanbanBoard } from "@/components/crm/KanbanBoard";
import { CrmDrawer } from "@/components/crm/CrmDrawer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Users, DollarSign, Target, Clock, AlertCircle, TrendingDown, ShieldAlert, ThumbsDown, ThumbsUp, Minus, PlayCircle, CheckCircle2, XCircle, Tag, LayoutList, Columns, X, ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react";
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
  const { churnStatus, churnEvents, isLoading, error, chamadosPorClienteMap, npsMap, getScoreSuporteReal, getScoreNPSReal, getScoreTotalReal, config, getBucket } = useChurnScore();
  const { chamados, getChamadosPorCliente } = useChamados();
  const { ispId } = useActiveIsp();
  const { workflowMap, addToWorkflow, updateStatus, updateTags, updateOwner } = useCrmWorkflow();
  const { toast } = useToast();

  // Filters
  const [scoreMin, setScoreMin] = useState(0);
  const [bucket, setBucket] = useState("todos");
  const [plano, setPlano] = useState("todos");
  const [cidade, setCidade] = useState("todos");
  const [bairro, setBairro] = useState("todos");
  const [periodo, setPeriodo] = useState("7");
  const [selectedCliente, setSelectedCliente] = useState<ChurnStatus | null>(null);
  const [viewMode, setViewMode] = useState<"lista" | "kanban">("kanban");

  // Sort state for lista view
  type SortField = "score" | "cliente_nome" | "dias_atraso" | "chamados_90d" | "nps" | "internet" | "valor_mensalidade" | "motivo" | "crm";
  type SortDir = "asc" | "desc";
  const [sortField, setSortField] = useState<SortField>("score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }, [sortField]);

  const SortIcon = useCallback(({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 text-muted-foreground/50" />;
    return sortDir === "desc" ? <ChevronDown className="h-3 w-3 ml-1 text-primary" /> : <ChevronUp className="h-3 w-3 ml-1 text-primary" />;
  }, [sortField, sortDir]);

  // Data max do dataset para filtro de período
  const dataMaxDataset = useMemo(() => {
    let max = 0;
    churnStatus.forEach((c) => {
      const ts = new Date(c.created_at || "").getTime();
      if (ts > max) max = ts;
    });
    return max > 0 ? new Date(max) : new Date();
  }, [churnStatus]);

  // Filtro 100% baseado no score recalculado — ignora status_churn do banco
  // Apenas clientes cujo score >= alert_min (bucket ALERTA ou CRÍTICO) entram
  const clientesRisco = useMemo(() => {
    // Deduplicar por cliente_id — manter o registro com maior score
    // Excluir clientes cancelados (status_internet = "D") — não há retenção possível
    const map = new Map<number, typeof churnStatus[0]>();
    churnStatus.forEach((c) => {
      if (c.status_internet === "D") return; // Cancelado — ignorar
      const score = getScoreTotalReal(c);
      const b = getBucket(score);
      if (b !== "ALERTA" && b !== "CRÍTICO") return; // Ignora OK
      const existing = map.get(c.cliente_id);
      if (!existing || score > getScoreTotalReal(existing)) {
        map.set(c.cliente_id, c);
      }
    });
    return Array.from(map.values());
  }, [churnStatus, getScoreTotalReal, getBucket]);

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

  const filtered = useMemo(() => {
    let f = [...clientesRisco];

    // Filtro de período baseado na data máxima do dataset
    if (periodo !== "todos") {
      const dias = parseInt(periodo, 10);
      const cutoff = new Date(dataMaxDataset);
      cutoff.setDate(cutoff.getDate() - dias);
      f = f.filter((c) => {
        const d = new Date(c.created_at || "");
        return !isNaN(d.getTime()) && d >= cutoff;
      });
    }

    if (scoreMin > 0) f = f.filter((c) => getScoreTotalReal(c) >= scoreMin);
    if (bucket !== "todos") f = f.filter((c) => getBucket(getScoreTotalReal(c)) === bucket);
    if (plano !== "todos") f = f.filter((c) => c.plano_nome === plano);
    if (cidade !== "todos") f = f.filter((c) => c.cliente_cidade === cidade);
    if (bairro !== "todos") f = f.filter((c) => c.cliente_bairro === bairro);

    // Apply sort
    const dir = sortDir === "desc" ? -1 : 1;
    const getNpsOrder = (c: ChurnStatus) => {
      const n = npsMap.get(c.cliente_id);
      if (!n?.classificacao) return 99;
      if (n.classificacao === "DETRATOR") return 0;
      if (n.classificacao === "NEUTRO") return 1;
      return 2;
    };
    const getWfOrder = (c: ChurnStatus) => {
      const wf = workflowMap.get(c.cliente_id);
      if (!wf) return 0; // não tratado = primeiro
      if (wf.status_workflow === "em_tratamento") return 1;
      if (wf.status_workflow === "resolvido") return 2;
      return 3;
    };
    f.sort((a, b) => {
      let va: number, vb: number;
      switch (sortField) {
        case "score": va = getScoreTotalReal(a); vb = getScoreTotalReal(b); break;
        case "cliente_nome": return dir * (a.cliente_nome || "").localeCompare(b.cliente_nome || "");
        case "dias_atraso": va = a.dias_atraso ?? 0; vb = b.dias_atraso ?? 0; break;
        case "chamados_90d":
          va = chamadosPorClienteMap.d90.get(a.cliente_id)?.chamados_periodo ?? a.qtd_chamados_90d ?? 0;
          vb = chamadosPorClienteMap.d90.get(b.cliente_id)?.chamados_periodo ?? b.qtd_chamados_90d ?? 0;
          break;
        case "nps": va = getNpsOrder(a); vb = getNpsOrder(b); break;
        case "internet": return dir * (a.status_internet || "").localeCompare(b.status_internet || "");
        case "valor_mensalidade": va = a.valor_mensalidade ?? 0; vb = b.valor_mensalidade ?? 0; break;
        case "motivo": return dir * (a.motivo_risco_principal || "").localeCompare(b.motivo_risco_principal || "");
        case "crm": va = getWfOrder(a); vb = getWfOrder(b); break;
        default: va = getScoreTotalReal(a); vb = getScoreTotalReal(b);
      }
      return dir * (va - vb) || (getScoreTotalReal(b) - getScoreTotalReal(a));
    });

    return f;
  }, [clientesRisco, scoreMin, bucket, plano, cidade, bairro, periodo, dataMaxDataset, getScoreTotalReal, getBucket, sortField, sortDir, chamadosPorClienteMap]);

  const kpis = useMemo(() => {
    const totalRisco = filtered.length;
    const mrrRisco = filtered.reduce((acc, c) => acc + (c.valor_mensalidade || 0), 0);
    const ltvRisco = filtered.reduce((acc, c) => acc + (c.ltv_estimado || 0), 0);
    const scores = filtered.map((c) => getScoreTotalReal(c));
    const scoreMedio = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "—";
    const bloqueadosCobranca = filtered.filter(c => ["CA", "CM", "B"].includes(c.status_internet || "")).length;
    return { totalRisco, mrrRisco, ltvRisco, scoreMedio, bloqueadosCobranca };
  }, [filtered, getScoreTotalReal]);

  const hasActiveFilters = scoreMin > 0 || bucket !== "todos" || plano !== "todos" || cidade !== "todos" || bairro !== "todos" || periodo !== "todos";

  const clearFilters = () => {
    setScoreMin(0);
    setBucket("todos");
    setPlano("todos");
    setCidade("todos");
    setBairro("todos");
    setPeriodo("todos");
  };

  // Chamados for selected client
  const selectedClienteChamados = useMemo(() => {
    if (!selectedCliente) return [];
    return chamados.filter(c => {
      const cid = typeof c.id_cliente === 'string' ? parseInt(c.id_cliente, 10) : c.id_cliente;
      return cid === selectedCliente.cliente_id;
    });
  }, [selectedCliente, chamados]);

  // Events for selected client - ALL score pillars
  const clienteEvents = useMemo(() => {
    if (!selectedCliente) return [];
    const c = selectedCliente;
    const eventos: any[] = [];
    const now = new Date().toISOString();

    // Real events from churn_events (excluding synthetic ones we'll recreate)
    const realEvents = churnEvents
      .filter((e) => e.cliente_id === c.cliente_id)
      .filter((e) => e.tipo_evento !== "chamado_reincidente" && e.tipo_evento !== "nps_detrator")
      .slice(0, 10);
    eventos.push(...realEvents);

    // Synthetic: Financeiro (baseado em dias em atraso)
    const scoreFinanceiro = calcScoreFinanceiroConfiguravel(c.dias_atraso, config);
    if (scoreFinanceiro > 0) {
      eventos.push({
        id: "synth-financeiro", isp_id: c.isp_id, cliente_id: c.cliente_id,
        id_contrato: null, tipo_evento: "score_financeiro", peso_evento: 3,
        impacto_score: scoreFinanceiro,
        descricao: `${Math.round(c.dias_atraso ?? 0)} dias em atraso — impacto de +${scoreFinanceiro}pts`,
        dados_evento: { dias_atraso: c.dias_atraso }, data_evento: c.ultimo_pagamento_data || now, created_at: now,
      });
    }

    // Synthetic: Suporte (chamado reincidente)
    const ch30Real = chamadosPorClienteMap.d30.get(c.cliente_id)?.chamados_periodo ?? 0;
    const rawUltimoChamado = chamadosPorClienteMap.d30.get(c.cliente_id)?.ultimo_chamado ?? c.ultimo_atendimento_data ?? now;
    const ultimoChamadoData = typeof rawUltimoChamado === "string" ? rawUltimoChamado.replace(" ", "T") : now;
    if (ch30Real >= 2) {
      const impacto = ch30Real >= 3 ? config.chamados30dBase + (ch30Real - 2) * config.chamadoAdicional : config.chamados30dBase;
      eventos.push({
        id: "real-reincidente", isp_id: c.isp_id, cliente_id: c.cliente_id,
        id_contrato: null, tipo_evento: "chamado_reincidente", peso_evento: ch30Real >= 3 ? 3 : 2,
        impacto_score: impacto, descricao: `${ch30Real} chamados nos últimos 30 dias — impacto de +${impacto}pts`,
        dados_evento: { qtd_chamados_30d_real: ch30Real }, data_evento: ultimoChamadoData, created_at: ultimoChamadoData,
      });
    }

    // Synthetic: NPS Detrator
    const npsCliente = npsMap.get(c.cliente_id);
    if (npsCliente?.classificacao === "DETRATOR") {
      const npsData = npsCliente.data ?? now;
      eventos.push({
        id: "real-nps-detrator", isp_id: c.isp_id, cliente_id: c.cliente_id,
        id_contrato: null, tipo_evento: "nps_detrator", peso_evento: 4, impacto_score: config.npsDetrator,
        descricao: `NPS Detrator — nota ${npsCliente.nota}/10 — impacto de +${config.npsDetrator}pts`,
        dados_evento: { nota_nps: npsCliente.nota, classificacao: npsCliente.classificacao },
        data_evento: npsData, created_at: npsData,
      });
    }

    // Synthetic: Qualidade
    const qualidadeBase = 25;
    const scoreQualidade = Math.round(((c.score_qualidade ?? 0) / qualidadeBase) * config.qualidade);
    if (scoreQualidade > 0) {
      eventos.push({
        id: "synth-qualidade", isp_id: c.isp_id, cliente_id: c.cliente_id,
        id_contrato: null, tipo_evento: "score_qualidade", peso_evento: 2,
        impacto_score: scoreQualidade,
        descricao: `Indicadores de qualidade impactando +${scoreQualidade}pts no score`,
        dados_evento: { score_raw: c.score_qualidade }, data_evento: now, created_at: now,
      });
    }

    // Synthetic: Comportamental
    const scoreComportamental = Math.round(((c.score_comportamental ?? 0) / 20) * config.comportamental);
    if (scoreComportamental > 0) {
      eventos.push({
        id: "synth-comportamental", isp_id: c.isp_id, cliente_id: c.cliente_id,
        id_contrato: null, tipo_evento: "score_comportamental", peso_evento: 2,
        impacto_score: scoreComportamental,
        descricao: `Comportamento de uso impactando +${scoreComportamental}pts no score`,
        dados_evento: { score_raw: c.score_comportamental }, data_evento: now, created_at: now,
      });
    }

    // Sort by impact desc
    eventos.sort((a, b) => (b.impacto_score || 0) - (a.impacto_score || 0));
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
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Período</span>
                <Select value={periodo} onValueChange={setPeriodo}>
                  <SelectTrigger className="h-7 text-xs w-[110px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Tudo</SelectItem>
                    <SelectItem value="7">7 dias</SelectItem>
                    <SelectItem value="30">30 dias</SelectItem>
                    <SelectItem value="90">90 dias</SelectItem>
                    <SelectItem value="180">180 dias</SelectItem>
                    <SelectItem value="365">365 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>

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
                      <TableHead className="text-xs whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort("cliente_nome")}>
                        <span className="flex items-center">Cliente<SortIcon field="cliente_nome" /></span>
                      </TableHead>
                      <TableHead className="text-xs whitespace-nowrap text-center cursor-pointer select-none" onClick={() => toggleSort("score")}>
                        <span className="flex items-center justify-center">Churn Score<SortIcon field="score" /></span>
                      </TableHead>
                      <TableHead className="text-xs whitespace-nowrap text-center cursor-pointer select-none" onClick={() => toggleSort("dias_atraso")}>
                        <span className="flex items-center justify-center">Dias Atraso<SortIcon field="dias_atraso" /></span>
                      </TableHead>
                      <TableHead className="text-xs whitespace-nowrap text-center cursor-pointer select-none" onClick={() => toggleSort("chamados_90d")}>
                        <span className="flex items-center justify-center">Chamados<SortIcon field="chamados_90d" /></span>
                      </TableHead>
                      <TableHead className="text-xs whitespace-nowrap text-center cursor-pointer select-none" onClick={() => toggleSort("nps")}>
                        <span className="flex items-center justify-center">NPS<SortIcon field="nps" /></span>
                      </TableHead>
                      <TableHead className="text-xs whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort("internet")}>
                        <span className="flex items-center">Internet<SortIcon field="internet" /></span>
                      </TableHead>
                      <TableHead className="text-xs whitespace-nowrap text-right cursor-pointer select-none" onClick={() => toggleSort("valor_mensalidade")}>
                        <span className="flex items-center justify-end">Mensalidade<SortIcon field="valor_mensalidade" /></span>
                      </TableHead>
                      <TableHead className="text-xs whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort("motivo")}>
                        <span className="flex items-center">Motivo<SortIcon field="motivo" /></span>
                      </TableHead>
                      <TableHead className="text-xs whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort("crm")}>
                        <span className="flex items-center">Ação<SortIcon field="crm" /></span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-10 text-sm">
                          Nenhum cliente em risco com os filtros aplicados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((c) => {
                        const derivedBucket = getBucket(getScoreTotalReal(c));
                        const npsCliente = npsMap.get(c.cliente_id);
                        const wf = workflowMap.get(c.cliente_id);
                        const ch90 = chamadosPorClienteMap.d90.get(c.cliente_id)?.chamados_periodo ?? c.qtd_chamados_90d ?? 0;
                        const diasAtraso = c.dias_atraso ?? 0;
                        return (
                          <TableRow key={c.id || c.cliente_id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedCliente(c)}>
                            <TableCell className="text-xs font-medium max-w-[140px] truncate">{c.cliente_nome}</TableCell>
                            <TableCell className="text-center"><ScoreBadge score={getScoreTotalReal(c)} bucket={derivedBucket} /></TableCell>
                            <TableCell className="text-center">
                              {diasAtraso > 0 ? (
                                <Badge className={`border text-[10px] ${
                                  diasAtraso >= 30 ? "bg-red-100 text-red-800 border-red-300" :
                                  diasAtraso >= 15 ? "bg-orange-100 text-orange-800 border-orange-300" :
                                  diasAtraso >= 8 ? "bg-yellow-100 text-yellow-800 border-yellow-300" :
                                  "bg-muted text-muted-foreground"
                                }`}>{Math.round(diasAtraso)}d</Badge>
                              ) : <span className="text-xs text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-center">
                              {ch90 > 0 ? (
                                <Badge className={`border text-[10px] ${
                                  ch90 >= 5 ? "bg-red-100 text-red-800 border-red-300" :
                                  ch90 >= 3 ? "bg-orange-100 text-orange-800 border-orange-300" :
                                  "bg-muted text-muted-foreground"
                                }`}>{ch90}</Badge>
                              ) : <span className="text-xs text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-center"><NPSBadge classificacao={npsCliente?.classificacao} nota={npsCliente?.nota} /></TableCell>
                            <TableCell className="text-xs">{STATUS_INTERNET[c.status_internet || ""] || c.status_internet || "—"}</TableCell>
                            <TableCell className="text-right text-xs">{c.valor_mensalidade ? `R$ ${c.valor_mensalidade.toFixed(2)}` : "—"}</TableCell>
                            <TableCell className="text-xs max-w-[150px] truncate text-muted-foreground">{c.motivo_risco_principal || "—"}</TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-1">
                                {wf ? (
                                  <Badge variant="outline" className={`text-[10px] ${wf.status_workflow === "em_tratamento" ? "text-yellow-600 border-yellow-300" : wf.status_workflow === "resolvido" ? "text-green-600 border-green-300" : "text-destructive border-red-300"}`}>
                                    {wf.status_workflow === "em_tratamento" ? "Tratando" : wf.status_workflow === "resolvido" ? "Resolvido" : "Perdido"}
                                  </Badge>
                                ) : (
                                  <Badge className="bg-red-100 text-red-800 border-red-300 border text-[10px]">Tratar</Badge>
                                )}
                                <ActionMenu
                                  clientId={c.cliente_id}
                                  clientName={c.cliente_nome || `Cliente ${c.cliente_id}`}
                                  variant="risco"
                                  onSendToTreatment={() => handleStartTreatment(c)}
                                />
                              </div>
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
          chamadosCliente={selectedClienteChamados}
          npsData={npsMap.get(selectedCliente.cliente_id)}
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
