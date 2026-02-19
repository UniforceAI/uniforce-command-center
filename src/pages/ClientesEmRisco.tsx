import { useState, useMemo } from "react";
import { useChurnData, ChurnStatus } from "@/hooks/useChurnData";
import { IspActions } from "@/components/shared/IspActions";
import { KPICardNew } from "@/components/shared/KPICardNew";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertTriangle, Users, DollarSign, Target, Clock, AlertCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

const BUCKET_COLORS: Record<string, string> = {
  Baixo: "bg-green-100 text-green-800",
  Médio: "bg-yellow-100 text-yellow-800",
  Alto: "bg-orange-100 text-orange-800",
  Crítico: "bg-red-100 text-red-800",
};

function ScoreBadge({ score, bucket }: { score?: number; bucket?: string }) {
  const cls = BUCKET_COLORS[bucket || ""] || "bg-gray-100 text-gray-700";
  return (
    <Badge className={`${cls} font-mono text-xs`}>
      {score != null ? score : "—"}
    </Badge>
  );
}

const ClientesEmRisco = () => {
  const { churnStatus, churnEvents, isLoading, error } = useChurnData();

  const [scoreMin, setScoreMin] = useState(0);
  const [bucket, setBucket] = useState("todos");
  const [cidade, setCidade] = useState("todos");
  const [plano, setPlano] = useState("todos");
  const [selectedCliente, setSelectedCliente] = useState<ChurnStatus | null>(null);

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
    if (bucket !== "todos") f = f.filter((c) => c.churn_risk_bucket === bucket);
    if (cidade !== "todos") f = f.filter((c) => c.cliente_cidade === cidade);
    if (plano !== "todos") f = f.filter((c) => c.plano_nome === plano);
    return f.sort((a, b) => (b.churn_risk_score || 0) - (a.churn_risk_score || 0));
  }, [clientesRisco, scoreMin, bucket, cidade, plano]);

  const kpis = useMemo(() => {
    const totalRisco = filtered.length;
    const mrrRisco = filtered.reduce((acc, c) => acc + (c.valor_mensalidade || 0), 0);
    const ltvRisco = filtered.reduce((acc, c) => acc + (c.ltv_estimado || 0), 0);
    const scores = filtered.filter((c) => c.churn_risk_score != null).map((c) => c.churn_risk_score!);
    const scoreMedio = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "N/A";
    const diasRisco = filtered.filter((c) => c.dias_em_risco != null).map((c) => c.dias_em_risco!);
    const diasMedio = diasRisco.length > 0 ? Math.round(diasRisco.reduce((a, b) => a + b, 0) / diasRisco.length) : "N/A";
    return { totalRisco, mrrRisco, ltvRisco, scoreMedio, diasMedio };
  }, [filtered]);

  // Events para o cliente selecionado
  const clienteEvents = useMemo(() => {
    if (!selectedCliente) return [];
    return churnEvents
      .filter((e) => e.cliente_id === selectedCliente.cliente_id)
      .sort((a, b) => new Date(b.event_date || b.created_at || "").getTime() - new Date(a.event_date || a.created_at || "").getTime())
      .slice(0, 10);
  }, [selectedCliente, churnEvents]);

  // Score por componente do cliente selecionado
  const scoreComponentes = useMemo(() => {
    if (!selectedCliente) return [];
    const campos = [
      { nome: "Financeiro", valor: selectedCliente.score_financeiro },
      { nome: "Atendimento", valor: selectedCliente.score_atendimento },
      { nome: "NPS", valor: selectedCliente.score_nps },
      { nome: "Uso", valor: selectedCliente.score_uso },
    ].filter((c) => c.valor != null);
    return campos;
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
              <p className="text-muted-foreground text-sm mt-0.5">{clientesRisco.length.toLocaleString()} clientes com status de risco</p>
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
              {/* Score mínimo slider */}
              <div className="flex items-center gap-3 min-w-[200px]">
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Score Mínimo</span>
                  <span className="text-xs font-mono font-bold">{scoreMin}</span>
                </div>
                <div className="w-32">
                  <Slider min={0} max={100} step={5} value={[scoreMin]} onValueChange={(v) => setScoreMin(v[0])} />
                </div>
              </div>

              {/* Bucket */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Bucket</span>
                <Select value={bucket} onValueChange={setBucket}>
                  <SelectTrigger className="h-8 text-xs w-[110px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="Crítico">Crítico</SelectItem>
                    <SelectItem value="Alto">Alto</SelectItem>
                    <SelectItem value="Médio">Médio</SelectItem>
                    <SelectItem value="Baixo">Baixo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Cidade */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Cidade</span>
                <Select value={cidade} onValueChange={setCidade}>
                  <SelectTrigger className="h-8 text-xs w-[130px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas</SelectItem>
                    {filterOptions.cidades.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Plano */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Plano</span>
                <Select value={plano} onValueChange={setPlano}>
                  <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {filterOptions.planos.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="ml-auto text-xs text-muted-foreground">
                {filtered.length} clientes filtrados
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <KPICardNew title="Total em Risco" value={kpis.totalRisco.toLocaleString()} icon={AlertTriangle} variant="danger" />
          <KPICardNew title="MRR em Risco" value={`R$ ${kpis.mrrRisco.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`} icon={DollarSign} variant="warning" />
          <KPICardNew title="LTV em Risco" value={`R$ ${kpis.ltvRisco.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`} icon={DollarSign} variant="danger" />
          <KPICardNew title="Score Médio" value={kpis.scoreMedio} icon={Target} variant="info" />
          <KPICardNew title="Dias Médios em Risco" value={typeof kpis.diasMedio === "number" ? kpis.diasMedio : "N/A"} icon={Clock} variant="default" />
        </div>

        {/* Tabela */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Clientes em Risco — ordenados por score
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto max-h-[520px]">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead className="text-xs whitespace-nowrap">Cliente</TableHead>
                    <TableHead className="text-xs whitespace-nowrap text-center">Score</TableHead>
                    <TableHead className="text-xs whitespace-nowrap">Bucket</TableHead>
                    <TableHead className="text-xs whitespace-nowrap text-center">Dias Risco</TableHead>
                    <TableHead className="text-xs whitespace-nowrap">Plano</TableHead>
                    <TableHead className="text-xs whitespace-nowrap">Cidade</TableHead>
                    <TableHead className="text-xs whitespace-nowrap text-center">Cham. 30d</TableHead>
                    <TableHead className="text-xs whitespace-nowrap text-center">NPS</TableHead>
                    <TableHead className="text-xs whitespace-nowrap text-center">Dias Atraso</TableHead>
                    <TableHead className="text-xs whitespace-nowrap text-right">Mensalidade</TableHead>
                    <TableHead className="text-xs whitespace-nowrap text-right">LTV</TableHead>
                    <TableHead className="text-xs whitespace-nowrap">Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center text-muted-foreground py-10 text-sm">
                        {churnStatus.length === 0
                          ? "Nenhum dado carregado da tabela churn_status."
                          : "Nenhum cliente em risco com os filtros aplicados."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((c) => (
                      <TableRow
                        key={c.id || c.cliente_id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setSelectedCliente(c)}
                      >
                        <TableCell className="text-xs font-medium max-w-[140px] truncate">{c.cliente_nome || "—"}</TableCell>
                        <TableCell className="text-center">
                          <ScoreBadge score={c.churn_risk_score} bucket={c.churn_risk_bucket} />
                        </TableCell>
                        <TableCell className="text-xs">{c.churn_risk_bucket || "—"}</TableCell>
                        <TableCell className="text-center text-xs">{c.dias_em_risco ?? "—"}</TableCell>
                        <TableCell className="text-xs max-w-[100px] truncate">{c.plano_nome || "—"}</TableCell>
                        <TableCell className="text-xs max-w-[100px] truncate">{c.cliente_cidade || "—"}</TableCell>
                        <TableCell className="text-center text-xs">{c.qtd_chamados_30d ?? "—"}</TableCell>
                        <TableCell className="text-center text-xs">{c.nps_ultimo_score ?? "—"}</TableCell>
                        <TableCell className="text-center text-xs">{c.dias_atraso ?? "—"}</TableCell>
                        <TableCell className="text-right text-xs">
                          {c.valor_mensalidade != null ? `R$ ${c.valor_mensalidade.toFixed(2)}` : "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {c.ltv_estimado != null ? `R$ ${c.ltv_estimado.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}` : "—"}
                        </TableCell>
                        <TableCell className="text-xs max-w-[140px] truncate text-muted-foreground">{c.motivo_risco_principal || "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Drawer de detalhes */}
      <Sheet open={!!selectedCliente} onOpenChange={() => setSelectedCliente(null)}>
        <SheetContent side="right" className="w-[400px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-base">{selectedCliente?.cliente_nome}</SheetTitle>
          </SheetHeader>

          {selectedCliente && (
            <div className="mt-4 space-y-5">
              {/* Score geral */}
              <div className="flex items-center gap-3">
                <ScoreBadge score={selectedCliente.churn_risk_score} bucket={selectedCliente.churn_risk_bucket} />
                <span className="text-sm text-muted-foreground">{selectedCliente.churn_risk_bucket} — {selectedCliente.cliente_cidade}</span>
              </div>

              {/* Score por componente */}
              {scoreComponentes.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Score por Componente</h4>
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={scoreComponentes} layout="vertical" margin={{ left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="nome" tick={{ fontSize: 10 }} width={80} />
                      <Tooltip />
                      <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Resumo financeiro */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Resumo Financeiro</h4>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Mensalidade</span><span>R$ {(selectedCliente.valor_mensalidade || 0).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">LTV Estimado</span><span>{selectedCliente.ltv_estimado ? `R$ ${selectedCliente.ltv_estimado.toLocaleString("pt-BR")}` : "N/A"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Dias Atraso</span><span className={selectedCliente.dias_atraso ? "text-destructive" : ""}>{selectedCliente.dias_atraso ?? 0}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">NPS</span><span>{selectedCliente.nps_ultimo_score ?? "N/A"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Chamados 30d</span><span>{selectedCliente.qtd_chamados_30d ?? 0}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Plano</span><span>{selectedCliente.plano_nome}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Dias em Risco</span><span>{selectedCliente.dias_em_risco ?? "N/A"}</span></div>
                </div>
              </div>

              {/* Motivo */}
              {selectedCliente.motivo_risco_principal && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Motivo Principal</h4>
                  <p className="text-sm">{selectedCliente.motivo_risco_principal}</p>
                </div>
              )}

              {/* Últimos eventos */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Últimos Eventos de Churn {clienteEvents.length > 0 && `(${clienteEvents.length})`}
                </h4>
                {clienteEvents.length > 0 ? (
                  <div className="space-y-2">
                    {clienteEvents.map((e, idx) => (
                      <div key={idx} className="rounded-md border p-2 text-xs space-y-0.5">
                        <div className="flex justify-between">
                          <span className="font-medium">{e.event_type || "Evento"}</span>
                          <span className="text-muted-foreground">{e.event_date ? new Date(e.event_date).toLocaleDateString("pt-BR") : "—"}</span>
                        </div>
                        {e.score_before != null && e.score_after != null && (
                          <div className="text-muted-foreground">Score: {e.score_before} → {e.score_after}</div>
                        )}
                        {e.motivo && <div className="text-muted-foreground">{e.motivo}</div>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Nenhum evento registrado.</p>
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
