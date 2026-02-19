import { useState, useMemo } from "react";
import { useChurnData, ChurnStatus } from "@/hooks/useChurnData";
import { useChamados } from "@/hooks/useChamados";
import { IspActions } from "@/components/shared/IspActions";
import { KPICardNew } from "@/components/shared/KPICardNew";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertTriangle, Users, DollarSign, Target, Clock, AlertCircle, TrendingDown, ShieldAlert } from "lucide-react";
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

const ClientesEmRisco = () => {
  const { churnStatus, churnEvents, isLoading, error } = useChurnData();
  const { getChamadosPorCliente } = useChamados();

  // Mapa de chamados reais por cliente_id (30d e 90d) vindo da tabela chamados
  const chamadosPorClienteMap = useMemo(() => ({
    d30: getChamadosPorCliente(30),
    d90: getChamadosPorCliente(90),
  }), [getChamadosPorCliente]);

  const [scoreMin, setScoreMin] = useState(0);
  const [bucket, setBucket] = useState("todos");
  const [cidade, setCidade] = useState("todos");
  const [plano, setPlano] = useState("todos");
  const [selectedCliente, setSelectedCliente] = useState<ChurnStatus | null>(null);

  // Clientes em risco: usa status_churn direto
  const clientesRisco = useMemo(() =>
    churnStatus.filter((c) => c.status_churn === "risco"),
    [churnStatus]
  );

  const filterOptions = useMemo(() => {
    const cidades = new Set<string>();
    const planos = new Set<string>();
    clientesRisco.forEach((c) => {
      if (c.cliente_cidade) cidades.add(c.cliente_cidade);
      if (c.plano_nome) planos.add(c.plano_nome);
    });
    return { cidades: Array.from(cidades).sort(), planos: Array.from(planos).sort() };
  }, [clientesRisco]);

  const filtered = useMemo(() => {
    let f = [...clientesRisco];
    if (scoreMin > 0) f = f.filter((c) => (c.churn_risk_score || 0) >= scoreMin);
    if (bucket !== "todos") f = f.filter((c) => getBucketLabel(c) === bucket);
    if (cidade !== "todos") f = f.filter((c) => c.cliente_cidade === cidade);
    if (plano !== "todos") f = f.filter((c) => c.plano_nome === plano);
    return f.sort((a, b) => {
      const scoreA = a.churn_risk_score ?? 0;
      const scoreB = b.churn_risk_score ?? 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return (b.dias_atraso || 0) - (a.dias_atraso || 0);
    });
  }, [clientesRisco, scoreMin, bucket, cidade, plano]);

  const kpis = useMemo(() => {
    const totalRisco = filtered.length;
    const mrrRisco = filtered.reduce((acc, c) => acc + (c.valor_mensalidade || 0), 0);
    const ltvRisco = filtered.reduce((acc, c) => acc + (c.ltv_estimado || 0), 0);
    const scores = filtered.filter((c) => c.churn_risk_score != null).map((c) => c.churn_risk_score);
    const scoreMedio = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "—";
    const diasRisco = filtered.filter((c) => c.dias_atraso != null && c.dias_atraso > 0).map((c) => c.dias_atraso!);
    const diasMedio = diasRisco.length > 0 ? Math.round(diasRisco.reduce((a, b) => a + b, 0) / diasRisco.length) : 0;
    const bloqueadosCobranca = filtered.filter(c => ["CA", "CM", "B"].includes(c.status_internet || "")).length;
    return { totalRisco, mrrRisco, ltvRisco, scoreMedio, diasMedio, bloqueadosCobranca };
  }, [filtered]);

  // Eventos do cliente selecionado (churn_events)
  const clienteEvents = useMemo(() => {
    if (!selectedCliente) return [];
    return churnEvents
      .filter((e) => e.cliente_id === selectedCliente.cliente_id)
      .slice(0, 15);
  }, [selectedCliente, churnEvents]);

  // Score por componente normalizado 0-100%
  const scoreComponentes = useMemo(() => {
    if (!selectedCliente) return [];
    return [
      { nome: "Financeiro (0-30)", valor: selectedCliente.score_financeiro ?? 0, max: 30 },
      { nome: "Suporte (0-25)", valor: selectedCliente.score_suporte ?? 0, max: 25 },
      { nome: "Comportamental (0-20)", valor: selectedCliente.score_comportamental ?? 0, max: 20 },
      { nome: "Qualidade (0-25)", valor: selectedCliente.score_qualidade ?? 0, max: 25 },
      { nome: "NPS (0-20)", valor: selectedCliente.score_nps ?? 0, max: 20 },
    ]
      .map(c => ({ ...c, pct: Math.round((c.valor / c.max) * 100) }))
      .filter(c => c.max > 0);
  }, [selectedCliente]);

  if (isLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
        <p className="text-muted-foreground">Carregando clientes em risco...</p>
      </div>
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

              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Cidade</span>
                <Select value={cidade} onValueChange={setCidade}>
                  <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas</SelectItem>
                    {filterOptions.cidades.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Plano</span>
                <Select value={plano} onValueChange={setPlano}>
                  <SelectTrigger className="h-8 text-xs w-[150px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {filterOptions.planos.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
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
                    <TableHead className="text-xs whitespace-nowrap">Plano</TableHead>
                    <TableHead className="text-xs whitespace-nowrap">Cidade</TableHead>
                    <TableHead className="text-xs whitespace-nowrap">Internet</TableHead>
                    <TableHead className="text-xs whitespace-nowrap text-right">Mensalidade</TableHead>
                    <TableHead className="text-xs whitespace-nowrap text-right">LTV</TableHead>
                    <TableHead className="text-xs whitespace-nowrap">Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center text-muted-foreground py-10 text-sm">
                        {churnStatus.length === 0
                          ? "Nenhum dado carregado. Verifique a conexão com o banco de dados."
                          : "Nenhum cliente em risco com os filtros aplicados."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((c) => {
                      const derivedBucket = getBucketLabel(c);
                      const prioridade = getPrioridade(c);
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
                            <ScoreBadge score={c.churn_risk_score} bucket={derivedBucket} />
                          </TableCell>
                          <TableCell className="text-xs">{c.status_contrato || "—"}</TableCell>
                          <TableCell className="text-center text-xs">
                            {c.dias_atraso != null && c.dias_atraso > 0 ? (
                              <span className={c.dias_atraso > 30 ? "text-destructive font-medium" : "text-yellow-600"}>
                                {Math.round(c.dias_atraso)}d
                              </span>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-xs max-w-[110px] truncate">{c.plano_nome || "—"}</TableCell>
                          <TableCell className="text-xs max-w-[100px] truncate">{c.cliente_cidade || "—"}</TableCell>
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

          {selectedCliente && (
            <div className="mt-4 space-y-5">
              {/* Score/bucket + prioridade */}
              <div className="flex items-center gap-3 flex-wrap">
                <ScoreBadge score={selectedCliente.churn_risk_score} bucket={getBucketLabel(selectedCliente)} />
                <Badge className={`${PRIORIDADE_COLORS[getPrioridade(selectedCliente)]} border text-xs font-mono`}>
                  {getPrioridade(selectedCliente)}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {selectedCliente.status_contrato} — {selectedCliente.cliente_cidade}
                </span>
              </div>

              {/* Score por componente normalizado */}
              {scoreComponentes.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Análise de Risco por Componente</h4>
                  <ResponsiveContainer width="100%" height={scoreComponentes.length * 36 + 20}>
                    <BarChart data={scoreComponentes} layout="vertical" margin={{ left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
                      <YAxis type="category" dataKey="nome" tick={{ fontSize: 9 }} width={115} />
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

              {/* Histórico de eventos churn_events */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Histórico de Eventos {clienteEvents.length > 0 && `(${clienteEvents.length})`}
                </h4>
                {clienteEvents.length > 0 ? (
                  <div className="space-y-2">
                    {clienteEvents.map((e, idx) => (
                      <div key={idx} className="rounded-md border p-2 text-xs space-y-0.5">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{EVENTO_LABELS[e.tipo_evento] || e.tipo_evento}</span>
                          <span className="text-muted-foreground">
                            {e.data_evento ? new Date(e.data_evento).toLocaleDateString("pt-BR") : "—"}
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
                        {e.peso_evento >= 3 && (
                          <Badge variant="outline" className="text-[10px]">
                            Peso {e.peso_evento}/5
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
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ClientesEmRisco;
