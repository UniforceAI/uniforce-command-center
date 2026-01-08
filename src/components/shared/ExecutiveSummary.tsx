import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowRight, DollarSign, Users, Zap, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Driver {
  id: string;
  label: string;
  count: number;
  unit?: string; // "faturas", "clientes", etc.
  icon?: React.ReactNode;
  severity: "critical" | "high" | "medium" | "low";
  onClick?: () => void;
}

interface ExecutiveSummaryProps {
  clientesEmAlerta: number;
  mrrSobRisco: number;
  perdaEstimada30d?: number | null;
  drivers: Driver[];
  onVerFilaRisco?: () => void;
  onVerCobranca?: () => void;
  onAplicarPlaybook?: () => void;
  hasRiskScore?: boolean;
  alertLevel?: "normal" | "warning" | "critical";
}

const severityColors = {
  critical: "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20",
  high: "bg-orange-500/10 text-orange-600 border-orange-500/30 hover:bg-orange-500/20",
  medium: "bg-warning/10 text-warning border-warning/30 hover:bg-warning/20",
  low: "bg-muted text-muted-foreground border-border hover:bg-muted/80",
};

export function ExecutiveSummary({
  clientesEmAlerta,
  mrrSobRisco,
  perdaEstimada30d,
  drivers,
  onVerFilaRisco,
  onVerCobranca,
  onAplicarPlaybook,
  hasRiskScore = false,
  alertLevel = "normal",
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
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  // Determina cor de fundo baseado no nível de alerta real
  const bgClass = useMemo(() => {
    if (alertLevel === "critical") return "bg-destructive/5 border-destructive/20";
    if (alertLevel === "warning") return "bg-warning/5 border-warning/20";
    return "bg-card border-border";
  }, [alertLevel]);

  return (
    <Card className={cn("border", bgClass)}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Título e Insight */}
          <div className="flex-1 space-y-3">
            <h2 className="text-base font-semibold text-foreground">
              Hoje: {clientesEmAlerta} clientes em alerta{" "}
              <span className="text-muted-foreground font-normal">
                ({formatCurrency(mrrSobRisco)}/mês sob risco)
              </span>
            </h2>

            {/* Drivers Principais - Chips clicáveis */}
            {topDrivers.length > 0 && (
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs text-muted-foreground">
                  Drivers:
                </span>
                {topDrivers.map((driver) => (
                  <Badge
                    key={driver.id}
                    variant="outline"
                    className={cn(
                      "text-xs cursor-pointer transition-colors",
                      severityColors[driver.severity]
                    )}
                    onClick={driver.onClick}
                  >
                    {driver.icon}
                    <span>
                      {driver.label}: {driver.count} {driver.unit || ""}
                    </span>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* KPIs Compactos */}
          <div className="flex items-center gap-6 lg:gap-8">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 text-xl font-bold text-foreground">
                <Users className="h-4 w-4 text-muted-foreground" />
                {clientesEmAlerta}
              </div>
              <div className="text-xs text-muted-foreground">Em alerta</div>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 text-xl font-bold text-foreground">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                {formatCurrency(mrrSobRisco)}
              </div>
              <div className="text-xs text-muted-foreground">MRR sob risco</div>
            </div>
            
            {perdaEstimada30d !== null && perdaEstimada30d !== undefined && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-center cursor-help">
                    <div className="flex items-center justify-center gap-1.5 text-xl font-bold text-orange-500">
                      {formatCurrency(perdaEstimada30d)}
                      <HelpCircle className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <div className="text-xs text-muted-foreground">Perda estimada 30d</div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[200px]">
                  <p className="text-xs">
                    Estimativa baseada em inadimplência atual e histórico de churn. 
                    Considera ~30% do MRR sob risco como perda provável.
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Botões de Ação - Linha separada, mais compacta */}
        <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-border/50">
          {onVerFilaRisco && (
            <Button onClick={onVerFilaRisco} size="sm" variant="default">
              Ver Fila de Risco
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          )}
          {onVerCobranca && (
            <Button onClick={onVerCobranca} variant="outline" size="sm">
              Ver Cobrança
            </Button>
          )}
          {onAplicarPlaybook && (
            <Button onClick={onAplicarPlaybook} variant="ghost" size="sm">
              <Zap className="h-3.5 w-3.5 mr-1" />
              Playbook
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
