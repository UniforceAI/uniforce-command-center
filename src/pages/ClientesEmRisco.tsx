import { useState, useMemo, useCallback } from "react";
import { useChurnData, ChurnStatus } from "@/hooks/useChurnData";
import { useChamados } from "@/hooks/useChamados";
import { useActiveIsp } from "@/hooks/useActiveIsp";
import { useChurnScoreConfig, calcScoreSuporteConfiguravel } from "@/contexts/ChurnScoreConfigContext";
import { IspActions } from "@/components/shared/IspActions";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { KPICardNew } from "@/components/shared/KPICardNew";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertTriangle, Users, DollarSign, Target, Clock, AlertCircle, TrendingDown, ShieldAlert, ThumbsDown, ThumbsUp, Minus } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const BUCKET_COLORS: Record<string, string> = {
  Baixo: "bg-green-100 text-green-800 border-green-200",
  Médio: "bg-yellow-100 text-yellow-800 border-yellow-200",
  Alto: "bg-orange-100 text-orange-800 border-orange-200",
  Crítico: "bg-red-100 text-red-800 border-red-200",
};

const STATUS_INTERNET: Record<string, string> = {
  A: "Ativo",
  CA: "Bloq. Cob. Auto",
  CM: "Bloq. Cob. Manual",
  B: "Bloqueado",
  D: "Cancelado",
  FA: "Férias",
  S: "Suspenso",
};

const EVENTO_LABELS: Record<string, string> = {
  inadimplencia_iniciou: "🔴 Inadimplência iniciou",
  inadimplencia_agravou: "⬆️ Atraso agravou",
  inadimplencia_resolvida: "✅ Pagamento efetuado",
  bloqueio_automatico: "🔒 Bloqueio automático",
  chamado_critico: "🚨 Chamado crítico",
  chamado_reincidente: "📞 Chamado reincidente",
  nps_detrator: "👎 NPS detrator",
  cancelamento_real: "❌ Cancelamento confirmado",
  risco_aumentou: "⚠️ Risco aumentou",
  risco_reduziu: "📉 Risco reduziu",
  score_critico: "🔥 Score crítico atingido",
  suspensao_fidelidade: "📋 Suspensão de fidelidade",
};

const PRIORIDADE_COLORS: Record<string, string> = {
  P0: "bg-red-100 text-red-800 border-red-300",
  P1: "bg-orange-100 text-orange-800 border-orange-300",
  P2: "bg-yellow-100 text-yellow-800 border-yellow-300",
  P3: "bg-gray-100 text-gray-700 border-gray-200",
};

function getBucketLabel(c: ChurnStatus): string {
  return c.churn_risk_bucket || "Baixo";
}

function getPrioridade(c: ChurnStatus): string {
  const ltv = c.ltv_estimado ?? 0;
  const bucket = c.churn_risk_bucket;
  if (ltv >= 3000 && bucket === "Crítico") return "P0";
  if (ltv >= 3000 && bucket === "Alto") return "P1";
  if (bucket === "Crítico") return "P1";
  if (ltv >= 1500 && bucket === "Alto") return "P2";
  if (bucket === "Alto") return "P2";
  return "P3";
}

function ScoreBadge({ score, bucket }: { score?: number; bucket?: string }) {
  const cls = BUCKET_COLORS[bucket || ""] || "bg-gray-100 text-gray-700";
  return (
    <Badge className={`${cls} font-mono text-xs border`}>
      {score != null ? score : bucket || "—"}
    </Badge>
  );
}

function NPSBadge({ classificacao, nota }: { classificacao?: string; nota?: number }) {
  if (!classificacao && nota == null) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const c = (classificacao || "").toUpperCase();
  if (c === "DETRATOR") {
    return (
      <Badge className="bg-red-100 text-red-800 border-red-200 border text-[10px] gap-1">
        <ThumbsDown className="h-2.5 w-2.5" />
        {nota != null ? nota : "Detrator"}
      </Badge>
    );
  }
  if (c === "NEUTRO") {
    return (
      <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 border text-[10px] gap-1">
        <Minus className="h-2.5 w-2.5" />
        {nota != null ? nota : "Neutro"}
      </Badge>
    );
  }
  if (c === "PROMOTOR") {
    return (
      <Badge className="bg-green-100 text-green-800 border-green-200 border text-[10px] gap-1">
        <ThumbsUp className="h-2.5 w-2.5" />
        {nota != null ? nota : "Promotor"}
      </Badge>
    );
  }
  return <span className="text-xs text-muted-foreground">—</span>;
}

const ClientesEmRisco = () => {
  const { churnStatus, churnEvents, isLoading, error } = useChurnData();
  const { getChamadosPorCliente } = useChamados();
  const { ispId } = useActiveIsp();
  const { config } = useChurnScoreConfig();

  // Mapa de chamados reais por cliente_id (30d e 90d)
  const chamadosPorClienteMap = useMemo(() => ({
    d30: getChamadosPorCliente(30),
    d90: getChamadosPorCliente(90),
  }), [getChamadosPorCliente]);

  // Mapa NPS: usa id_cliente string do nps_check para match via telefone/cpf
  // MAS churn_status já tem nps_ultimo_score e nps_classificacao — usamos esses primeiro
  // e complementamos com nps_check pelo campo id_cliente (string UUID) via user_id
  const npsMap = useMemo(() => {
    const m = new Map<number, { nota: number; classificacao: string; data: string | null }>();
    churnStatus.forEach((c) => {
      if (c.nps_ultimo_score != null && c.nps_classificacao) {
        m.set(c.cliente_id, {
          nota: c.nps_ultimo_score,
          classificacao: c.nps_classificacao.toUpperCase(),
          data: (c as any).nps_data ?? null,
        });
      }
    });
    return m;
  }, [churnStatus]);

  const [scoreMin, setScoreMin] = useState(0);
  const [bucket, setBucket] = useState("todos");
  const [selectedCliente, setSelectedCliente] = useState<ChurnStatus | null>(null);

  // Clientes em risco: usa status_churn direto
  const clientesRisco = useMemo(() =>
    churnStatus.filter((c) => c.status_churn === "risco"),
    [churnStatus]
  );

  const filterOptions = useMemo(() => {
    const planos = new Set<string>();
    const cidades = new Set<string>();
    clientesRisco.forEach((c) => {
      if (c.plano_nome) planos.add(c.plano_nome);
      if (c.cliente_cidade) cidades.add(c.cliente_cidade);
    });
    return { planos: Array.from(planos).sort(), cidades: Array.from(cidades).sort() };
  }, [clientesRisco]);

  // Score suporte calculado com config do usuário
  const getScoreSuporteReal = useCallback((cliente: ChurnStatus): number => {
    const ch30 = chamadosPorClienteMap.d30.get(cliente.cliente_id)?.chamados_periodo ?? 0;
    const ch90 = chamadosPorClienteMap.d90.get(cliente.cliente_id)?.chamados_periodo ?? 0;
    return calcScoreSuporteConfiguravel(ch30, ch90, config);
  }, [chamadosPorClienteMap, config]);

  // Score NPS calculado com config do usuário: se detrator, soma npsDetrator pts
  const getScoreNPSReal = useCallback((cliente: ChurnStatus): number => {
    const nps = npsMap.get(cliente.cliente_id);
    if (nps?.classificacao === "DETRATOR") return config.npsDetrator;
    return cliente.score_nps ?? 0;
  }, [npsMap, config]);

  // Score total recalculado
  const getScoreTotalReal = useCallback((cliente: ChurnStatus): number => {
    const suporteReal = getScoreSuporteReal(cliente);
    const npsReal = getScoreNPSReal(cliente);
    // Financeiro: escala pelo config.faturaAtrasada (max original = 30 no banco)
    const financeiro = Math.round(((cliente.score_financeiro ?? 0) / 30) * config.faturaAtrasada);
    const qualidadeBase = 25;
    const qualidade = Math.round(((cliente.score_qualidade ?? 0) / qualidadeBase) * config.qualidade);
    const comportamental = Math.round(((cliente.score_comportamental ?? 0) / 20) * config.comportamental);
    return Math.max(0, Math.min(500, financeiro + suporteReal + comportamental + qualidade + npsReal));
  }, [getScoreSuporteReal, getScoreNPSReal, config]);

  const filtered = useMemo(() => {
    let f = [...clientesRisco];
    if (scoreMin > 0) f = f.filter((c) => getScoreTotalReal(c) >= scoreMin);
    if (bucket !== "todos") f = f.filter((c) => getBucketLabel(c) === bucket);
    return f.sort((a, b) => {
      const scoreA = getScoreTotalReal(a);
      const scoreB = getScoreTotalReal(b);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return (b.dias_atraso || 0) - (a.dias_atraso || 0);
    });
  }, [clientesRisco, scoreMin, bucket, getScoreTotalReal]);

  const kpis = useMemo(() => {
    const totalRisco = filtered.length;
    const mrrRisco = filtered.reduce((acc, c) => acc + (c.valor_mensalidade || 0), 0);
    const ltvRisco = filtered.reduce((acc, c) => acc + (c.ltv_estimado || 0), 0);
    const scores = filtered.map((c) => getScoreTotalReal(c));
    const scoreMedio = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "—";
    const diasRisco = filtered.filter((c) => c.dias_atraso != null && c.dias_atraso > 0).map((c) => c.dias_atraso!);
    const diasMedio = diasRisco.length > 0 ? Math.round(diasRisco.reduce((a, b) => a + b, 0) / diasRisco.length) : 0;
    const bloqueadosCobranca = filtered.filter(c => ["CA", "CM", "B"].includes(c.status_internet || "")).length;
    return { totalRisco, mrrRisco, ltvRisco, scoreMedio, diasMedio, bloqueadosCobranca };
  }, [filtered, getScoreTotalReal]);

  // Eventos do cliente selecionado com NPS Detrator inserido se aplicável
  const clienteEvents = useMemo(() => {
    if (!selectedCliente) return [];
    const eventos = churnEvents
      .filter((e) => e.cliente_id === selectedCliente.cliente_id)
      .filter((e) => e.tipo_evento !== "chamado_reincidente")
      .filter((e) => e.tipo_evento !== "nps_detrator") // removemos o estático para inserir o real
      .slice(0, 15);

    // Evento de chamado reincidente REAL — usa data do último atendimento do cliente
    const ch30Real = chamadosPorClienteMap.d30.get(selectedCliente.cliente_id)?.chamados_periodo ?? 0;
    const rawUltimoChamado = chamadosPorClienteMap.d30.get(selectedCliente.cliente_id)?.ultimo_chamado
      ?? selectedCliente.ultimo_atendimento_data
      ?? new Date().toISOString();
    // Normaliza formato "YYYY-MM-DD HH:mm:ss" para ISO (substitui espaço por T)
    const ultimoChamadoData = typeof rawUltimoChamado === "string"
      ? rawUltimoChamado.replace(" ", "T")
      : new Date().toISOString();
    if (ch30Real >= 2) {
      const impacto = ch30Real >= 3
        ? config.chamados30dBase + (ch30Real - 2) * config.chamadoAdicional
        : config.chamados30dBase;
      eventos.unshift({
        id: "real-reincidente",
        isp_id: selectedCliente.isp_id,
        cliente_id: selectedCliente.cliente_id,
        id_contrato: null,
        tipo_evento: "chamado_reincidente",
        peso_evento: ch30Real >= 3 ? 3 : 2,
        impacto_score: impacto,
        descricao: `${ch30Real} chamados nos últimos 30 dias — impacto de +${impacto}pts no score`,
        dados_evento: { qtd_chamados_30d_real: ch30Real },
        data_evento: ultimoChamadoData,
        created_at: ultimoChamadoData,
      });
    }

    // Evento NPS Detrator REAL — usa nps_data do churn_status como data real da pesquisa
    const npsCliente = npsMap.get(selectedCliente.cliente_id);
    if (npsCliente?.classificacao === "DETRATOR") {
      const npsData = npsCliente.data ?? new Date().toISOString();
      eventos.unshift({
        id: "real-nps-detrator",
        isp_id: selectedCliente.isp_id,
        cliente_id: selectedCliente.cliente_id,
        id_contrato: null,
        tipo_evento: "nps_detrator",
        peso_evento: 4,
        impacto_score: config.npsDetrator,
        descricao: `NPS Detrator — nota ${npsCliente.nota}/10 — impacto de +${config.npsDetrator}pts no score`,
        dados_evento: { nota_nps: npsCliente.nota, classificacao: npsCliente.classificacao },
        data_evento: npsData,
        created_at: npsData,
      });
    }

    return eventos;
  }, [selectedCliente, churnEvents, chamadosPorClienteMap, npsMap, config]);

  // Score por componente para o gráfico do drawer
  const scoreComponentes = useMemo(() => {
    if (!selectedCliente) return [];
    const suporteReal = getScoreSuporteReal(selectedCliente);
    const npsReal = getScoreNPSReal(selectedCliente);
    const qualidadeBase = 25;
    const qualidade = Math.round(((selectedCliente.score_qualidade ?? 0) / qualidadeBase) * config.qualidade);
    const comportamental = Math.round(((selectedCliente.score_comportamental ?? 0) / 20) * config.comportamental);
    return [
      { nome: `Financeiro (0-${config.faturaAtrasada})`, valor: Math.round(((selectedCliente.score_financeiro ?? 0) / 30) * config.faturaAtrasada), max: config.faturaAtrasada },
      { nome: `Suporte (0-${config.chamados30dBase})`, valor: suporteReal, max: config.chamados30dBase + config.chamadoAdicional * 4 },
      { nome: `Comportamental (0-${config.comportamental})`, valor: comportamental, max: config.comportamental },
      { nome: `Qualidade (0-${config.qualidade})`, valor: qualidade, max: config.qualidade },
      { nome: `NPS (0-${config.npsDetrator})`, valor: npsReal, max: config.npsDetrator },
    ]
      .map(c => ({ ...c, pct: c.max > 0 ? Math.round((c.valor / c.max) * 100) : 0 }))
      .filter(c => c.max > 0);
  }, [selectedCliente, getScoreSuporteReal, getScoreNPSReal, config]);

  if (isLoading) return (
    <div className="min-h-screen bg-background">
      <LoadingScreen />
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Clientes em Risco
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                {clientesRisco.length.toLocaleString()} clientes com sinais de risco identificados
              </p>
            </div>
            <IspActions />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6 space-y-6">
        {error && (
          <div className="flex items-center gap-2 text-destructive bg-destructive/10 rounded-lg p-4">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Erro ao carregar dados: {error}</span>
          </div>
        )}

        {/* Filtros rápidos */}
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3 min-w-[200px]">
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Score Mín.</span>
                  <span className="text-xs font-mono font-bold">{scoreMin}</span>
                </div>
                <div className="w-32">
                  <Slider min={0} max={100} step={5} value={[scoreMin]} onValueChange={(v) => setScoreMin(v[0])} />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Bucket Risco</span>
                <Select value={bucket} onValueChange={setBucket}>
                  <SelectTrigger className="h-8 text-xs w-[120px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="Crítico">🔴 Crítico</SelectItem>
                    <SelectItem value="Alto">🟠 Alto</SelectItem>
                    <SelectItem value="Médio">🟡 Médio</SelectItem>
                    <SelectItem value="Baixo">🟢 Baixo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="ml-auto text-xs text-muted-foreground">
                {filtered.length.toLocaleString()} clientes filtrados · clique numa linha para ver detalhes
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <KPICardNew title="Total em Risco" value={kpis.totalRisco.toLocaleString()} icon={AlertTriangle} variant="danger" />
          <KPICardNew title="MRR em Risco" value={`R$ ${kpis.mrrRisco.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`} icon={DollarSign} variant="warning" />
          <KPICardNew title="LTV em Risco" value={`R$ ${kpis.ltvRisco.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`} icon={TrendingDown} variant="danger" />
          <KPICardNew title="Score Médio" value={kpis.scoreMedio} icon={Target} variant="info" />
          <KPICardNew title="Dias Médios Atraso" value={kpis.diasMedio > 0 ? `${kpis.diasMedio}d` : "—"} icon={Clock} variant="default" />
          <KPICardNew title="Bloqueados p/ Cob." value={kpis.bloqueadosCobranca.toLocaleString()} icon={ShieldAlert} variant="warning" />
        </div>

        {/* Tabela */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Clientes em Risco — ordenados por criticidade
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto max-h-[520px]">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead className="text-xs whitespace-nowrap">Prioridade</TableHead>
                    <TableHead className="text-xs whitespace-nowrap">Cliente</TableHead>
                    <TableHead className="text-xs whitespace-nowrap text-center">Score/Bucket</TableHead>
                    <TableHead className="text-xs whitespace-nowrap">Status</TableHead>
                    <TableHead className="text-xs whitespace-nowrap text-center">Dias Atraso</TableHead>
                    <TableHead className="text-xs whitespace-nowrap text-center">Nota NPS</TableHead>
                    <TableHead className="text-xs whitespace-nowrap">Internet</TableHead>
                    <TableHead className="text-xs whitespace-nowrap text-right">Mensalidade</TableHead>
                    <TableHead className="text-xs whitespace-nowrap text-right">LTV</TableHead>
                    <TableHead className="text-xs whitespace-nowrap">Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-10 text-sm">
                        {churnStatus.length === 0
                          ? "Nenhum dado carregado. Verifique a conexão com o banco de dados."
                          : "Nenhum cliente em risco com os filtros aplicados."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((c) => {
                      const derivedBucket = getBucketLabel(c);
                      const prioridade = getPrioridade(c);
                      const npsCliente = npsMap.get(c.cliente_id);
                      return (
                        <TableRow
                          key={c.id || c.cliente_id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => setSelectedCliente(c)}
                        >
                          <TableCell>
                            <Badge className={`${PRIORIDADE_COLORS[prioridade]} border font-mono text-xs`}>{prioridade}</Badge>
                          </TableCell>
                          <TableCell className="text-xs font-medium max-w-[140px] truncate">{c.cliente_nome}</TableCell>
                          <TableCell className="text-center">
                            <ScoreBadge score={getScoreTotalReal(c)} bucket={derivedBucket} />
                          </TableCell>
                          <TableCell className="text-xs">{c.status_contrato || "—"}</TableCell>
                          <TableCell className="text-center text-xs">
                            {c.dias_atraso != null && c.dias_atraso > 0 ? (
                              <span className={c.dias_atraso > 30 ? "text-destructive font-medium" : "text-yellow-600"}>
                                {Math.round(c.dias_atraso)}d
                              </span>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-center">
                            <NPSBadge classificacao={npsCliente?.classificacao} nota={npsCliente?.nota} />
                          </TableCell>
                          <TableCell className="text-xs">{STATUS_INTERNET[c.status_internet || ""] || c.status_internet || "—"}</TableCell>
                          <TableCell className="text-right text-xs">
                            {c.valor_mensalidade ? `R$ ${c.valor_mensalidade.toFixed(2)}` : "—"}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {c.ltv_estimado ? `R$ ${c.ltv_estimado.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}` : "—"}
                          </TableCell>
                          <TableCell className="text-xs max-w-[150px] truncate text-muted-foreground">
                            {c.motivo_risco_principal || "—"}
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
      </main>

      {/* Drawer de detalhes */}
      <Sheet open={!!selectedCliente} onOpenChange={() => setSelectedCliente(null)}>
        <SheetContent side="right" className="w-[440px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-base">{selectedCliente?.cliente_nome}</SheetTitle>
          </SheetHeader>

          {selectedCliente && (() => {
            const npsCliente = npsMap.get(selectedCliente.cliente_id);
            return (
              <div className="mt-4 space-y-5">
                {/* Score/bucket + prioridade + NPS */}
                <div className="flex items-center gap-3 flex-wrap">
                  <ScoreBadge score={getScoreTotalReal(selectedCliente)} bucket={getBucketLabel(selectedCliente)} />
                  <Badge className={`${PRIORIDADE_COLORS[getPrioridade(selectedCliente)]} border text-xs font-mono`}>
                    {getPrioridade(selectedCliente)}
                  </Badge>
                  {npsCliente && (
                    <NPSBadge classificacao={npsCliente.classificacao} nota={npsCliente.nota} />
                  )}
                  <span className="text-sm text-muted-foreground">
                    {selectedCliente.status_contrato}
                  </span>
                </div>

                {/* NPS Detrator alerta */}
                {npsCliente?.classificacao === "Detrator" && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                    <ThumbsDown className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                    <div className="text-xs">
                      <p className="font-semibold text-destructive">NPS Detrator — Risco Elevado</p>
                      <p className="text-muted-foreground mt-0.5">
                        Nota {npsCliente.nota}/10 · Adicionou +{config.npsDetrator}pts ao score de churn
                      </p>
                    </div>
                  </div>
                )}

                {/* Score por componente normalizado */}
                {scoreComponentes.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Análise de Risco por Componente</h4>
                    <ResponsiveContainer width="100%" height={scoreComponentes.length * 36 + 20}>
                      <BarChart data={scoreComponentes} layout="vertical" margin={{ left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
                        <YAxis type="category" dataKey="nome" tick={{ fontSize: 9 }} width={130} />
                        <Tooltip formatter={(v: any, _n, props) => [`${props.payload.valor} de ${props.payload.max} pts (${v}%)`, "Score"]} />
                        <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
                          {scoreComponentes.map((entry, idx) => (
                            <Cell key={idx} fill={entry.pct >= 60 ? "#ef4444" : entry.pct >= 30 ? "#f97316" : "#eab308"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Resumo financeiro completo */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Resumo Financeiro & Operacional</h4>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Mensalidade</span><span>R$ {(selectedCliente.valor_mensalidade || 0).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">LTV Estimado</span><span>{selectedCliente.ltv_estimado ? `R$ ${selectedCliente.ltv_estimado.toLocaleString("pt-BR")}` : "—"}</span></div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Dias em Atraso</span>
                      <span className={(selectedCliente.dias_atraso || 0) > 30 ? "text-destructive font-bold" : (selectedCliente.dias_atraso || 0) > 0 ? "text-orange-500 font-medium" : ""}>
                        {selectedCliente.dias_atraso ? `${Math.round(selectedCliente.dias_atraso)}d` : "Em dia"}
                      </span>
                    </div>
                    {selectedCliente.faixa_atraso && (
                      <div className="flex justify-between"><span className="text-muted-foreground">Faixa Atraso</span><span>{selectedCliente.faixa_atraso}</span></div>
                    )}
                    <div className="flex justify-between"><span className="text-muted-foreground">Plano</span><span className="text-right max-w-[200px] truncate">{selectedCliente.plano_nome || "—"}</span></div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cidade</span>
                      <span>{selectedCliente.cliente_cidade || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status Internet</span>
                      <span>{STATUS_INTERNET[selectedCliente.status_internet || ""] || selectedCliente.status_internet || "—"}</span>
                    </div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Status Contrato</span><span>{selectedCliente.status_contrato || "—"}</span></div>
                    {selectedCliente.desbloqueio_confianca && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Desbloqueio Confiança</span>
                        <Badge variant="outline" className="text-xs">{selectedCliente.desbloqueio_confianca}</Badge>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Chamados 30d / 90d</span>
                      <span>
                        {chamadosPorClienteMap.d30.get(selectedCliente.cliente_id)?.chamados_periodo ?? 0}
                        {" / "}
                        {chamadosPorClienteMap.d90.get(selectedCliente.cliente_id)?.chamados_periodo ?? 0}
                      </span>
                    </div>
                    {selectedCliente.ultimo_atendimento_data && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Último Atendimento</span>
                        <span>{new Date(selectedCliente.ultimo_atendimento_data).toLocaleDateString("pt-BR")}</span>
                      </div>
                    )}
                    {selectedCliente.tempo_cliente_meses != null && (
                      <div className="flex justify-between"><span className="text-muted-foreground">Tempo como Cliente</span><span>{selectedCliente.tempo_cliente_meses} meses</span></div>
                    )}
                  </div>
                </div>

                {/* Roadmap to Churn — Histórico de eventos */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Roadmap to Churn {clienteEvents.length > 0 && `(${clienteEvents.length})`}
                  </h4>
                  {clienteEvents.length > 0 ? (
                    <div className="space-y-2">
                      {clienteEvents.map((e, idx) => (
                        <div key={idx} className={`rounded-md border p-2 text-xs space-y-0.5 ${e.tipo_evento === "nps_detrator" ? "border-destructive/30 bg-destructive/5" : ""}`}>
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{EVENTO_LABELS[e.tipo_evento] || e.tipo_evento}</span>
                            <span className="text-muted-foreground">
                              {e.data_evento ? new Date(e.data_evento.replace(" ", "T")).toLocaleDateString("pt-BR") : "—"}
                            </span>
                          </div>
                          {e.descricao && (
                            <div className="text-muted-foreground">{e.descricao}</div>
                          )}
                          {e.dados_evento && Object.keys(e.dados_evento).length > 0 && (
                            <div className="text-muted-foreground truncate">
                              {Object.entries(e.dados_evento)
                                .map(([k, v]) => `${k}: ${v}`)
                                .join(" · ")}
                            </div>
                          )}
                          {e.impacto_score > 0 && (
                            <Badge variant="outline" className="text-[10px]">
                              +{e.impacto_score}pts
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Nenhum evento encontrado nos últimos 90 dias.</p>
                  )}
                </div>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ClientesEmRisco;
