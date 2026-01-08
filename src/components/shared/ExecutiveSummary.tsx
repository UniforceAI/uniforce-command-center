import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NAValue } from "./EmptyState";
import { AlertTriangle, TrendingDown, Users, Zap, ArrowRight, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

interface Driver {
  id: string;
  label: string;
  count: number;
  icon?: React.ReactNode;
  severity: "critical" | "high" | "medium" | "low";
}

interface ExecutiveSummaryProps {
  clientesEmRisco: number;
  mrrEmRisco: number;
  projecaoPerda30d?: number | null;
  drivers: Driver[];
  onVerFilaRisco?: () => void;
  onVerCobranca?: () => void;
  onAplicarPlaybook?: () => void;
  hasRiskScore?: boolean;
  hasNPS?: boolean;
}

const severityColors = {
  critical: "bg-destructive text-destructive-foreground",
  high: "bg-orange-500 text-white",
  medium: "bg-warning text-warning-foreground",
  low: "bg-muted text-muted-foreground",
};

export function ExecutiveSummary({
  clientesEmRisco,
  mrrEmRisco,
  projecaoPerda30d,
  drivers,
  onVerFilaRisco,
  onVerCobranca,
  onAplicarPlaybook,
  hasRiskScore = false,
  hasNPS = false,
}: ExecutiveSummaryProps) {
  const topDrivers = useMemo(() => {
    return drivers
      .filter((d) => d.count > 0)
      .sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        if (severityOrder[a.severity] !== severityOrder[b.severity]) {
          return severityOrder[a.severity] - severityOrder[b.severity];
        }
        return b.count - a.count;
      })
      .slice(0, 3);
  }, [drivers]);

  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Card className="border-l-4 border-l-destructive bg-gradient-to-r from-destructive/5 to-transparent">
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          {/* Insight Principal */}
          <div className="flex-1 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-destructive/10 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Resumo Executivo (Hoje)
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {hasRiskScore ? (
                    <>
                      Hoje você tem{" "}
                      <span className="font-semibold text-destructive">
                        {clientesEmRisco} clientes em risco
                      </span>{" "}
                      (impacto estimado{" "}
                      <span className="font-semibold text-destructive">
                        {formatCurrency(mrrEmRisco)}/mês
                      </span>
                      ).
                      {projecaoPerda30d !== null && projecaoPerda30d !== undefined && (
                        <>
                          {" "}
                          Se nada for feito, projeção de perda em 30 dias:{" "}
                          <span className="font-semibold text-destructive">
                            {formatCurrency(projecaoPerda30d)}
                          </span>
                          .
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      Você tem{" "}
                      <span className="font-semibold text-destructive">
                        {clientesEmRisco} clientes com sinais de alerta
                      </span>{" "}
                      (MRR associado:{" "}
                      <span className="font-semibold text-destructive">
                        {formatCurrency(mrrEmRisco)}/mês
                      </span>
                      ).
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Drivers Principais */}
            {topDrivers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-muted-foreground self-center mr-1">
                  Drivers principais:
                </span>
                {topDrivers.map((driver) => (
                  <Badge
                    key={driver.id}
                    className={cn("text-xs", severityColors[driver.severity])}
                  >
                    {driver.icon}
                    {driver.label}
                    <span className="ml-1 opacity-80">({driver.count})</span>
                  </Badge>
                ))}
              </div>
            )}

            {/* Aviso quando não tem Risk Score */}
            {!hasRiskScore && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
                <Zap className="h-3.5 w-3.5" />
                <span>
                  Risk Score em construção. Exibindo sinais disponíveis (inadimplência, alertas técnicos).
                </span>
              </div>
            )}
          </div>

          {/* KPIs Rápidos */}
          <div className="flex flex-wrap lg:flex-nowrap gap-4">
            <div className="text-center min-w-[100px]">
              <div className="flex items-center justify-center gap-1 text-2xl font-bold text-destructive">
                <Users className="h-5 w-5" />
                {hasRiskScore ? clientesEmRisco : <NAValue tooltip="Aguardando Risk Score" source="tabela risk_score" />}
              </div>
              <div className="text-xs text-muted-foreground">Clientes em Risco</div>
            </div>
            <div className="text-center min-w-[120px]">
              <div className="flex items-center justify-center gap-1 text-2xl font-bold text-destructive">
                <DollarSign className="h-5 w-5" />
                {formatCurrency(mrrEmRisco)}
              </div>
              <div className="text-xs text-muted-foreground">MRR em Risco</div>
            </div>
            {projecaoPerda30d !== null && projecaoPerda30d !== undefined && (
              <div className="text-center min-w-[120px]">
                <div className="flex items-center justify-center gap-1 text-2xl font-bold text-orange-500">
                  <TrendingDown className="h-5 w-5" />
                  {formatCurrency(projecaoPerda30d)}
                </div>
                <div className="text-xs text-muted-foreground">Projeção 30d</div>
              </div>
            )}
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex flex-wrap gap-3 mt-6 pt-4 border-t">
          {onVerFilaRisco && (
            <Button onClick={onVerFilaRisco} size="sm">
              Ver Fila de Risco
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {onVerCobranca && (
            <Button onClick={onVerCobranca} variant="outline" size="sm">
              Ver Cobrança
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {onAplicarPlaybook && (
            <Button onClick={onAplicarPlaybook} variant="secondary" size="sm">
              <Zap className="h-4 w-4 mr-1" />
              Aplicar Playbook
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
