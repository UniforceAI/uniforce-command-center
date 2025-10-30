import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Chamado } from "@/types/chamado";
import { AlertTriangle, Lightbulb, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface InsightsPanelProps {
  chamados: Chamado[];
}

export function InsightsPanel({ chamados }: InsightsPanelProps) {
  // Clientes que reabriram em menos de 5 dias
  const reabertosRapido = chamados.filter(
    (c) => c["Dias desde Último Chamado"] < 5 && c["Qtd. Chamados"] > 1
  );

  // Clientes com mais de 3 chamados
  const muitosChamados = chamados.filter((c) => c["Qtd. Chamados"] > 3);

  // Chamados demorados
  const demorados = chamados.filter((c) => c.Classificação === "Lento");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-warning" />
          Insights Automáticos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Reabertos rapidamente */}
        {reabertosRapido.length > 0 && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-destructive mb-2">
                  Clientes com Reincidência Rápida
                </h4>
                <p className="text-sm text-muted-foreground mb-3">
                  {reabertosRapido.length} cliente(s) reabriram chamados em menos de 5 dias
                </p>
                <div className="flex flex-wrap gap-2">
                  {reabertosRapido.slice(0, 5).map((c, idx) => (
                    <Badge key={`reaberto-${c.Protocolo}-${idx}`} variant="outline" className="border-destructive/30">
                      ID {c["ID Cliente"]} - {c["Qtd. Chamados"]} chamados
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Muitos chamados */}
        {muitosChamados.length > 0 && (
          <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
            <div className="flex items-start gap-3">
              <TrendingUp className="h-5 w-5 text-warning mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-warning mb-2">
                  Clientes com Múltiplos Chamados
                </h4>
                <p className="text-sm text-muted-foreground mb-3">
                  {muitosChamados.length} cliente(s) com mais de 3 chamados no período
                </p>
                <div className="flex flex-wrap gap-2">
                  {muitosChamados.slice(0, 5).map((c, idx) => (
                    <Badge key={`muitos-${c.Protocolo}-${idx}`} variant="outline" className="border-warning/30">
                      ID {c["ID Cliente"]} - {c["Qtd. Chamados"]} chamados
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Chamados demorados */}
        {demorados.length > 0 && (
          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium mb-2">Resolução Demorada</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  {demorados.length} chamado(s) com tempo de resolução acima da média
                </p>
                <div className="flex flex-wrap gap-2">
                  {demorados.slice(0, 5).map((c, idx) => (
                    <Badge key={`demorado-${c.Protocolo}-${idx}`} variant="outline">
                      ID {c["ID Cliente"]} - {c["Tempo de Atendimento"]}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sem insights críticos */}
        {reabertosRapido.length === 0 && muitosChamados.length === 0 && demorados.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Lightbulb className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum insight crítico no momento</p>
            <p className="text-sm mt-1">Todos os indicadores estão dentro do esperado</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
