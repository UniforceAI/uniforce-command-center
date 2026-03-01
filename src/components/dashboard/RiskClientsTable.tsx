import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldAlert, ArrowRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { ActionMenu } from "@/components/shared/ActionMenu";
import { EmptyState } from "@/components/shared/EmptyState";
import type { ChurnStatus } from "@/hooks/useChurnData";
import type { RiskBucket } from "@/hooks/useRiskBucketConfig";

const BUCKET_COLORS: Record<string, string> = {
  "CRÍTICO": "bg-red-100 text-red-800 border-red-300",
  "ALERTA": "bg-orange-100 text-orange-800 border-orange-300",
  "OK": "bg-green-100 text-green-800 border-green-200",
};

const PRIORIDADE_COLORS: Record<string, string> = {
  "Em Churn": "bg-red-100 text-red-800 border-red-300",
  "Alta": "bg-orange-100 text-orange-800 border-orange-300",
  "Normal": "bg-yellow-100 text-yellow-800 border-yellow-300",
};

type SortKey = "score" | "dias_atraso" | "chamados" | "nps" | "prioridade" | "motivo";
type SortDir = "asc" | "desc";

const PRIORIDADE_ORDER: Record<string, number> = { "Em Churn": 0, "Alta": 1, "Normal": 2 };

interface RiskClientsTableProps {
  filaRisco: ChurnStatus[];
  totalRisco: number;
  getScoreTotalReal: (c: ChurnStatus) => number;
  getBucketVisao: (score: number) => RiskBucket;
  npsMap: Map<number, { nota?: number; classificacao?: string }>;
  getPrioridade: (c: ChurnStatus, bucket: RiskBucket) => string;
  chamadosPorClienteMap: { d90: Map<number, { chamados_periodo: number }> };
  getCidadeNome: (v: any) => string | null;
  onSelectCliente: (c: ChurnStatus) => void;
  onNavigate: () => void;
}

export function RiskClientsTable({
  filaRisco,
  totalRisco,
  getScoreTotalReal,
  getBucketVisao,
  npsMap,
  getPrioridade,
  chamadosPorClienteMap,
  getCidadeNome,
  onSelectCliente,
  onNavigate,
}: RiskClientsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "desc"
      ? <ArrowDown className="h-3 w-3 ml-1 text-primary" />
      : <ArrowUp className="h-3 w-3 ml-1 text-primary" />;
  };

  const sortedRisco = useMemo(() => {
    const items = filaRisco.map(c => {
      const score = getScoreTotalReal(c);
      const bucket = getBucketVisao(score);
      const prioridade = getPrioridade(c, bucket);
      const ch = chamadosPorClienteMap.d90.get(c.cliente_id)?.chamados_periodo ?? c.qtd_chamados_90d ?? 0;
      const npsCliente = npsMap.get(c.cliente_id);
      const npsVal = npsCliente?.nota ?? -1;
      return { c, score, bucket, prioridade, ch, npsVal, npsCliente };
    });

    items.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "score": cmp = a.score - b.score; break;
        case "dias_atraso": cmp = (a.c.dias_atraso ?? 0) - (b.c.dias_atraso ?? 0); break;
        case "chamados": cmp = a.ch - b.ch; break;
        case "nps": cmp = a.npsVal - b.npsVal; break;
        case "prioridade": cmp = (PRIORIDADE_ORDER[a.prioridade] ?? 9) - (PRIORIDADE_ORDER[b.prioridade] ?? 9); break;
        case "motivo": cmp = (a.c.motivo_risco_principal ?? "").localeCompare(b.c.motivo_risco_principal ?? ""); break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });

    return items;
  }, [filaRisco, sortKey, sortDir, getScoreTotalReal, getBucketVisao, getPrioridade, chamadosPorClienteMap, npsMap]);

  const getDiasAtrasoBadge = (dias: number | null | undefined) => {
    if (dias == null || dias <= 0) return <span className="text-xs text-muted-foreground">—</span>;
    const d = Math.round(dias);
    if (d >= 30) return <Badge className="bg-red-100 text-red-800 border-red-300 border text-[10px]">{d}d</Badge>;
    if (d >= 15) return <Badge className="bg-orange-100 text-orange-800 border-orange-300 border text-[10px]">{d}d</Badge>;
    if (d >= 8) return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 border text-[10px]">{d}d</Badge>;
    return <span className="text-xs">{d}d</span>;
  };

  const getChamadosBadge = (ch: number) => {
    if (ch <= 0) return <span className="text-xs text-muted-foreground">—</span>;
    if (ch >= 5) return <Badge className="bg-red-100 text-red-800 border-red-300 border text-[10px]">{ch}</Badge>;
    if (ch >= 3) return <Badge className="bg-orange-100 text-orange-800 border-orange-300 border text-[10px]">{ch}</Badge>;
    return <span className="text-xs">{ch}</span>;
  };

  return (
    <section>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              <CardTitle className="text-base">Clientes em Risco</CardTitle>
              <Badge variant="destructive" className="text-xs">{filaRisco.length}</Badge>
            </div>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onNavigate}>
              Ver todos ({totalRisco})
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filaRisco.length > 0 ? (
            <div className="overflow-auto max-h-[450px]">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead className="text-xs whitespace-nowrap">Cliente</TableHead>
                    <TableHead className="text-xs whitespace-nowrap text-center cursor-pointer select-none" onClick={() => toggleSort("score")}>
                      <span className="inline-flex items-center">Churn Score <SortIcon col="score" /></span>
                    </TableHead>
                    <TableHead className="text-xs whitespace-nowrap text-center cursor-pointer select-none" onClick={() => toggleSort("dias_atraso")}>
                      <span className="inline-flex items-center">Dias Atraso <SortIcon col="dias_atraso" /></span>
                    </TableHead>
                    <TableHead className="text-xs whitespace-nowrap text-center cursor-pointer select-none" onClick={() => toggleSort("chamados")}>
                      <span className="inline-flex items-center">Chamados <SortIcon col="chamados" /></span>
                    </TableHead>
                    <TableHead className="text-xs whitespace-nowrap text-center cursor-pointer select-none" onClick={() => toggleSort("nps")}>
                      <span className="inline-flex items-center">NPS <SortIcon col="nps" /></span>
                    </TableHead>
                    <TableHead className="text-xs whitespace-nowrap text-center cursor-pointer select-none" onClick={() => toggleSort("prioridade")}>
                      <span className="inline-flex items-center">Prioridade <SortIcon col="prioridade" /></span>
                    </TableHead>
                    <TableHead className="text-xs whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort("motivo")}>
                      <span className="inline-flex items-center">Motivo <SortIcon col="motivo" /></span>
                    </TableHead>
                    <TableHead className="text-xs whitespace-nowrap text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRisco.map(({ c, score, bucket, prioridade, ch, npsCliente }) => (
                    <TableRow key={c.id || c.cliente_id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelectCliente(c)}>
                      <TableCell className="text-xs font-medium max-w-[160px]">
                        <div>
                          <p className="truncate font-medium">{c.cliente_nome || `Cliente ${c.cliente_id}`}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {c.cliente_bairro ? `${c.cliente_bairro}, ${getCidadeNome(c.cliente_cidade) || ""}` : getCidadeNome(c.cliente_cidade) || ""}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={`${BUCKET_COLORS[bucket] || "bg-muted"} border font-mono text-xs`}>{score}</Badge>
                      </TableCell>
                      <TableCell className="text-center">{getDiasAtrasoBadge(c.dias_atraso)}</TableCell>
                      <TableCell className="text-center">{getChamadosBadge(ch)}</TableCell>
                      <TableCell className="text-center">
                        {npsCliente ? (
                          <Badge className={`border text-[10px] ${
                            npsCliente.classificacao === "DETRATOR" ? "bg-red-100 text-red-800 border-red-200" :
                            npsCliente.classificacao === "NEUTRO" ? "bg-yellow-100 text-yellow-800 border-yellow-200" :
                            npsCliente.classificacao === "PROMOTOR" ? "bg-green-100 text-green-800 border-green-200" : "bg-muted"
                          }`}>{npsCliente.nota ?? npsCliente.classificacao}</Badge>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={`${PRIORIDADE_COLORS[prioridade] || "bg-muted"} border text-[10px]`}>{prioridade}</Badge>
                      </TableCell>
                      <TableCell className="text-xs max-w-[150px] truncate text-muted-foreground">
                        {c.motivo_risco_principal || (c.dias_atraso && c.dias_atraso > 0 ? "Atraso financeiro" : "Risco identificado")}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <ActionMenu
                          clientId={c.cliente_id}
                          clientName={c.cliente_nome || `Cliente ${c.cliente_id}`}
                          clientPhone={c.ultimo_atendimento_data ? undefined : undefined}
                          variant="risco"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="p-6">
              <EmptyState title="Nenhum cliente em risco alto" description="Não há clientes com sinais de alerta no momento." variant="card" />
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
