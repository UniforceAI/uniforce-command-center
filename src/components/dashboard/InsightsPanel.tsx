import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Chamado } from "@/types/chamado";
import { AlertTriangle, Lightbulb, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface InsightsPanelProps {
  chamados: Chamado[];
}

export function InsightsPanel({ chamados }: InsightsPanelProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<Record<string, number>>({
    reabertos: 1,
    muitos: 1,
    demorados: 1
  });
  
  const ITEMS_PER_PAGE = 10;

  // Clientes que reabriram em menos de 5 dias
  const reabertosRapido = chamados.filter(
    (c) => c["Dias desde Último Chamado"] < 5 && c["Qtd. Chamados"] > 1
  );

  // Clientes com mais de 3 chamados
  const muitosChamados = chamados.filter((c) => c["Qtd. Chamados"] > 3);

  // Chamados demorados
  const demorados = chamados.filter((c) => c.Classificação === "Lento");

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
    setCurrentPage(prev => ({ ...prev, [section]: 1 }));
  };

  const renderPaginatedTable = (data: Chamado[], section: string) => {
    const page = currentPage[section] || 1;
    const startIdx = (page - 1) * ITEMS_PER_PAGE;
    const endIdx = startIdx + ITEMS_PER_PAGE;
    const paginatedData = data.slice(startIdx, endIdx);
    const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE);

    return (
      <div className="mt-4 space-y-4">
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID Cliente</TableHead>
                <TableHead>Data Abertura</TableHead>
                <TableHead>Qtd. Chamados</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tempo</TableHead>
                <TableHead>Classificação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.map((c) => (
                <TableRow key={c.Protocolo}>
                  <TableCell className="font-medium">{c["ID Cliente"]}</TableCell>
                  <TableCell>{c["Data de Abertura"].split(" ")[0]}</TableCell>
                  <TableCell>{c["Qtd. Chamados"]}</TableCell>
                  <TableCell className="max-w-xs truncate">{c["Motivo do Contato"]}</TableCell>
                  <TableCell>
                    <Badge variant={
                      c.Status === "Novo" ? "default" :
                      c.Status === "Em Andamento" ? "secondary" :
                      c.Status === "Resolvido" ? "outline" :
                      "outline"
                    }>
                      {c.Status}
                    </Badge>
                  </TableCell>
                  <TableCell>{c["Tempo de Atendimento"]}</TableCell>
                  <TableCell>
                    <Badge variant={
                      c.Classificação === "Rápido" ? "outline" :
                      c.Classificação === "Lento" ? "destructive" :
                      c.Classificação === "Reincidente" ? "destructive" :
                      "secondary"
                    }>
                      {c.Classificação}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-2">
            <p className="text-sm text-muted-foreground">
              Mostrando {startIdx + 1}-{Math.min(endIdx, data.length)} de {data.length}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => ({ ...prev, [section]: Math.max(1, page - 1) }))}
                disabled={page === 1}
              >
                Anterior
              </Button>
              <span className="flex items-center px-3 text-sm">
                Página {page} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => ({ ...prev, [section]: Math.min(totalPages, page + 1) }))}
                disabled={page === totalPages}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

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
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-destructive">
                    Clientes com Reincidência Rápida
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSection('reabertos')}
                    className="h-8"
                  >
                    {expandedSection === 'reabertos' ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {reabertosRapido.length} cliente(s) reabriram chamados em menos de 5 dias
                </p>
                {expandedSection !== 'reabertos' && (
                  <div className="flex flex-wrap gap-2">
                    {reabertosRapido.slice(0, 5).map((c, idx) => (
                      <Badge 
                        key={`reaberto-${c.Protocolo}-${idx}`} 
                        variant="outline" 
                        className="border-destructive/30 cursor-pointer hover:bg-destructive/20"
                        onClick={() => toggleSection('reabertos')}
                      >
                        ID {c["ID Cliente"]} - {c["Qtd. Chamados"]} chamados
                      </Badge>
                    ))}
                    {reabertosRapido.length > 5 && (
                      <Badge 
                        variant="outline" 
                        className="border-destructive/30 cursor-pointer hover:bg-destructive/20"
                        onClick={() => toggleSection('reabertos')}
                      >
                        +{reabertosRapido.length - 5} mais
                      </Badge>
                    )}
                  </div>
                )}
                {expandedSection === 'reabertos' && renderPaginatedTable(reabertosRapido, 'reabertos')}
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
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-warning">
                    Clientes com Múltiplos Chamados
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSection('muitos')}
                    className="h-8"
                  >
                    {expandedSection === 'muitos' ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {muitosChamados.length} cliente(s) com mais de 3 chamados no período
                </p>
                {expandedSection !== 'muitos' && (
                  <div className="flex flex-wrap gap-2">
                    {muitosChamados.slice(0, 5).map((c, idx) => (
                      <Badge 
                        key={`muitos-${c.Protocolo}-${idx}`} 
                        variant="outline" 
                        className="border-warning/30 cursor-pointer hover:bg-warning/20"
                        onClick={() => toggleSection('muitos')}
                      >
                        ID {c["ID Cliente"]} - {c["Qtd. Chamados"]} chamados
                      </Badge>
                    ))}
                    {muitosChamados.length > 5 && (
                      <Badge 
                        variant="outline" 
                        className="border-warning/30 cursor-pointer hover:bg-warning/20"
                        onClick={() => toggleSection('muitos')}
                      >
                        +{muitosChamados.length - 5} mais
                      </Badge>
                    )}
                  </div>
                )}
                {expandedSection === 'muitos' && renderPaginatedTable(muitosChamados, 'muitos')}
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
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">Resolução Demorada</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSection('demorados')}
                    className="h-8"
                  >
                    {expandedSection === 'demorados' ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {demorados.length} chamado(s) com tempo de resolução acima da média
                </p>
                {expandedSection !== 'demorados' && (
                  <div className="flex flex-wrap gap-2">
                    {demorados.slice(0, 5).map((c, idx) => (
                      <Badge 
                        key={`demorado-${c.Protocolo}-${idx}`} 
                        variant="outline"
                        className="cursor-pointer hover:bg-muted"
                        onClick={() => toggleSection('demorados')}
                      >
                        ID {c["ID Cliente"]} - {c["Tempo de Atendimento"]}
                      </Badge>
                    ))}
                    {demorados.length > 5 && (
                      <Badge 
                        variant="outline"
                        className="cursor-pointer hover:bg-muted"
                        onClick={() => toggleSection('demorados')}
                      >
                        +{demorados.length - 5} mais
                      </Badge>
                    )}
                  </div>
                )}
                {expandedSection === 'demorados' && renderPaginatedTable(demorados, 'demorados')}
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
