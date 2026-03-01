import { memo, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertCircle, TrendingDown, RefreshCcw, X, Users,
  DollarSign, Zap, ArrowRight, HelpCircle,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RespostaNPS } from "@/types/nps";
import { cn } from "@/lib/utils";

interface NPSInsightsPanelProps {
  respostas: RespostaNPS[];
}

const severityColors = {
  critical: "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20",
  high: "bg-orange-500/10 text-orange-600 border-orange-500/30 hover:bg-orange-500/20",
  medium: "bg-warning/10 text-warning border-warning/30 hover:bg-warning/20",
  low: "bg-muted text-muted-foreground border-border hover:bg-muted/80",
};

export const NPSInsightsPanel = memo(({ respostas }: NPSInsightsPanelProps) => {
  const [dismissed, setDismissed] = useState(false);

  const insights = useMemo(() => {
    const detratoresCriticos = respostas.filter((r) => r.nota <= 3);
    const detratores = respostas.filter((r) => r.classificacao === "Detrator");
    const promotores = respostas.filter((r) => r.classificacao === "Promotor");

    const npsContrato = calcularNPS(respostas.filter((r) => r.tipo_nps === "contrato"));
    const npsOS = calcularNPS(respostas.filter((r) => r.tipo_nps === "os"));

    const tiposNPS = [
      { tipo: "Contrato", nps: npsContrato },
      { tipo: "Pós-O.S", nps: npsOS },
    ].sort((a, b) => a.nps - b.nps);

    const detratoresPorCliente = detratores.reduce((acc, r) => {
      acc[r.cliente_id] = (acc[r.cliente_id] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const reincidentes = Object.values(detratoresPorCliente).filter((c) => c > 1).length;

    // Build drivers like ExecutiveSummary
    const drivers = [
      {
        id: "detratores_criticos",
        label: "Detratores críticos",
        count: detratoresCriticos.length,
        severity: detratoresCriticos.length > 5 ? "critical" as const : "high" as const,
        icon: <AlertCircle className="h-3 w-3 mr-1" />,
      },
      {
        id: "reincidentes",
        label: "Reincidentes",
        count: reincidentes,
        severity: reincidentes > 3 ? "high" as const : "medium" as const,
        icon: <RefreshCcw className="h-3 w-3 mr-1" />,
      },
      {
        id: "pior_tipo",
        label: `Pior: ${tiposNPS[0]?.tipo}`,
        count: tiposNPS[0]?.nps || 0,
        unit: "pts",
        severity: (tiposNPS[0]?.nps || 0) < 0 ? "critical" as const : "medium" as const,
        icon: <TrendingDown className="h-3 w-3 mr-1" />,
      },
    ].filter((d) => d.count !== 0);

    const npsGeral = calcularNPS(respostas);
    const alertLevel = npsGeral < 0 ? "critical" : npsGeral < 30 ? "warning" : "normal";

    return { detratores: detratores.length, promotores: promotores.length, npsGeral, drivers, alertLevel };
  }, [respostas]);

  if (dismissed || respostas.length === 0) return null;

  const bgClass =
    insights.alertLevel === "critical" ? "bg-destructive/5 border-destructive/20" :
    insights.alertLevel === "warning" ? "bg-warning/5 border-warning/20" :
    "bg-card border-border";

  return (
    <Card className={cn("border relative", bgClass)}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-2 h-6 w-6 text-muted-foreground hover:text-foreground z-10"
      >
        <X className="h-3.5 w-3.5" />
      </Button>

      <CardContent className="p-3 sm:p-4 pr-10">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex-1 space-y-2">
            <h2 className="text-sm font-semibold text-foreground">
              NPS Geral: {insights.npsGeral} pontos{" "}
              <span className="text-muted-foreground font-normal">
                ({insights.detratores} detratores · {insights.promotores} promotores)
              </span>
            </h2>

            {insights.drivers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-xs text-muted-foreground">Drivers:</span>
                {insights.drivers.map((driver) => (
                  <Badge
                    key={driver.id}
                    variant="outline"
                    className={cn("text-xs cursor-pointer transition-colors py-0.5 px-2", severityColors[driver.severity])}
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

          <div className="flex items-center gap-4 lg:gap-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-lg font-bold text-foreground">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                {respostas.length}
              </div>
              <div className="text-[10px] text-muted-foreground">Respostas</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-lg font-bold text-foreground">
                <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                {insights.npsGeral}
              </div>
              <div className="text-[10px] text-muted-foreground">NPS Score</div>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-center cursor-help">
                  <div className="flex items-center justify-center gap-1 text-lg font-bold text-orange-500">
                    {insights.detratores}
                    <HelpCircle className="h-2.5 w-2.5 text-muted-foreground" />
                  </div>
                  <div className="text-[10px] text-muted-foreground">Detratores</div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs">Clientes com nota ≤ 6. Alto risco de churn.</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

function calcularNPS(respostas: RespostaNPS[]): number {
  if (respostas.length === 0) return 0;
  const promotores = respostas.filter((r) => r.classificacao === "Promotor").length;
  const detratores = respostas.filter((r) => r.classificacao === "Detrator").length;
  return Math.round(((promotores - detratores) / respostas.length) * 100);
}

NPSInsightsPanel.displayName = "NPSInsightsPanel";
