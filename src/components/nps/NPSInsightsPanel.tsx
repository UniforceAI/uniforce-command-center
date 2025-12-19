import { memo, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, TrendingDown, RefreshCcw } from "lucide-react";
import { RespostaNPS } from "@/types/nps";

interface NPSInsightsPanelProps {
  respostas: RespostaNPS[];
}

export const NPSInsightsPanel = memo(({ respostas }: NPSInsightsPanelProps) => {
  const insights = useMemo(() => {
    // Detratores críticos (nota <= 3)
    const detratoresCriticos = respostas.filter(r => r.nota <= 3);
    
    // Calcular NPS por tipo para detectar quedas
    const npsInstalacao = calcularNPS(respostas.filter(r => r.tipo_nps === "pos_instalacao"));
    const npsOS = calcularNPS(respostas.filter(r => r.tipo_nps === "pos_os"));
    const npsAtendimento = calcularNPS(respostas.filter(r => r.tipo_nps === "pos_atendimento"));
    
    // Detectar tipo com pior NPS
    const tiposNPS = [
      { tipo: "Pós-Instalação", nps: npsInstalacao },
      { tipo: "Pós-O.S", nps: npsOS },
      { tipo: "Pós-Atendimento", nps: npsAtendimento },
    ].sort((a, b) => a.nps - b.nps);
    
    // Reincidência de detratores (mesmo cliente com mais de uma resposta detratora)
    const detratoresPorCliente = respostas
      .filter(r => r.classificacao === "Detrator")
      .reduce((acc, r) => {
        acc[r.cliente_id] = (acc[r.cliente_id] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);
    
    const reincidentes = Object.entries(detratoresPorCliente)
      .filter(([_, count]) => count > 1)
      .length;

    return {
      detratoresCriticos,
      piorTipo: tiposNPS[0],
      reincidentes,
    };
  }, [respostas]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Detratores Críticos */}
      <Card className="border-l-4 border-l-destructive">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            🔴 Detratores Críticos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-destructive mb-2">
            {insights.detratoresCriticos.length}
          </p>
          <p className="text-sm text-muted-foreground mb-3">
            Clientes com nota ≤ 3 que precisam de ação imediata
          </p>
          <div className="flex flex-wrap gap-1">
            {insights.detratoresCriticos.slice(0, 5).map((d) => (
              <Badge key={d.cliente_id} variant="destructive" className="text-xs">
                {d.cliente_nome.split(" ")[0]}
              </Badge>
            ))}
            {insights.detratoresCriticos.length > 5 && (
              <Badge variant="outline" className="text-xs">
                +{insights.detratoresCriticos.length - 5}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Queda de NPS por Tipo */}
      <Card className="border-l-4 border-l-warning">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-warning" />
            ⚠️ NPS mais baixo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-warning mb-2">
            {insights.piorTipo.tipo}
          </p>
          <p className="text-sm text-muted-foreground mb-3">
            NPS de <span className="font-bold">{insights.piorTipo.nps}</span> pontos - requer atenção
          </p>
          <Badge variant="outline" className="text-xs">
            Analisar processos de {insights.piorTipo.tipo.toLowerCase()}
          </Badge>
        </CardContent>
      </Card>

      {/* Reincidência de Detratores */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCcw className="h-5 w-5 text-primary" />
            🔁 Reincidência
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-primary mb-2">
            {insights.reincidentes}
          </p>
          <p className="text-sm text-muted-foreground mb-3">
            Clientes que deram nota baixa mais de uma vez
          </p>
          <Badge variant="outline" className="text-xs">
            Alto risco de churn
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
});

function calcularNPS(respostas: RespostaNPS[]): number {
  if (respostas.length === 0) return 0;
  const promotores = respostas.filter(r => r.classificacao === "Promotor").length;
  const detratores = respostas.filter(r => r.classificacao === "Detrator").length;
  return Math.round(((promotores - detratores) / respostas.length) * 100);
}

NPSInsightsPanel.displayName = "NPSInsightsPanel";
