import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, ChevronDown, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Cobranca {
  cliente_id: number;
  cliente_nome: string;
  plano: string;
  status: string;
  vencimento: string;
  vencimentoDate: Date | null;
  valor: number;
  metodo: string;
  dias_atraso: number;
  celular: string;
  email?: string;
}

interface ClienteAgrupado {
  cliente_id: number;
  cliente_nome: string;
  celular: string;
  email?: string;
  cobrancas: Cobranca[];
  totalValor: number;
  maiorAtraso: number;
}

interface ExpandableCobrancaTableProps {
  data: ClienteAgrupado[];
  actions?: {
    label: string;
    onClick: (item: ClienteAgrupado) => void;
  }[];
  emptyMessage?: string;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    "Vencido": "bg-red-100 text-red-700 border-red-200",
    "Em aberto": "bg-yellow-100 text-yellow-700 border-yellow-200",
    "Recuperado": "bg-green-100 text-green-700 border-green-200",
    "Em negociação": "bg-blue-100 text-blue-700 border-blue-200",
    "A Vencer": "bg-orange-100 text-orange-700 border-orange-200",
  };

  return (
    <Badge variant="outline" className={styles[status] || "bg-gray-100 text-gray-700 border-gray-200"}>
      {status}
    </Badge>
  );
}

export function ExpandableCobrancaTable({
  data,
  actions,
  emptyMessage = "Nenhum dado encontrado",
}: ExpandableCobrancaTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const toggleRow = (clienteId: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(clienteId)) {
        next.delete(clienteId);
      } else {
        next.add(clienteId);
      }
      return next;
    });
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]"></TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Plano</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Método</TableHead>
            <TableHead>Atraso</TableHead>
            <TableHead>Celular</TableHead>
            {actions && <TableHead className="w-[80px]">Ações</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((cliente, clienteIdx) => {
            const isExpanded = expandedRows.has(cliente.cliente_id);
            const hasMultiple = cliente.cobrancas.length > 1;
            // Ordenar cobranças por data (mais antiga primeiro = mais atrasada)
            const sortedCobrancas = [...cliente.cobrancas].sort((a, b) => {
              if (!a.vencimentoDate && !b.vencimentoDate) return 0;
              if (!a.vencimentoDate) return 1;
              if (!b.vencimentoDate) return -1;
              return a.vencimentoDate.getTime() - b.vencimentoDate.getTime();
            });
            const mainCobranca = sortedCobrancas[0];
            const rowBgClass = clienteIdx % 2 === 0 ? "bg-background" : "bg-muted/20";

            return (
              <>
                {/* Linha principal do cliente */}
                <TableRow
                  key={cliente.cliente_id}
                  className={cn(
                    rowBgClass,
                    hasMultiple && "cursor-pointer",
                    isExpanded && "bg-primary/10 border-l-4 border-l-primary"
                  )}
                  onClick={() => hasMultiple && toggleRow(cliente.cliente_id)}
                >
                  <TableCell className="p-2 text-center">
                    {hasMultiple && (
                      <div className="flex items-center justify-center">
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 text-primary transition-transform" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform" />
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span>{cliente.cliente_nome}</span>
                      {hasMultiple && (
                        <Badge className="text-xs font-semibold bg-orange-500 text-white hover:bg-orange-600">
                          {cliente.cobrancas.length}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{mainCobranca.plano}</TableCell>
                  <TableCell><StatusBadge status={mainCobranca.status} /></TableCell>
                  <TableCell>{mainCobranca.vencimento}</TableCell>
                  <TableCell>
                    <span className={cn("font-semibold", hasMultiple ? "text-red-600" : "")}>
                      {hasMultiple 
                        ? `R$ ${cliente.totalValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                        : `R$ ${mainCobranca.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                      }
                    </span>
                  </TableCell>
                  <TableCell>{mainCobranca.metodo}</TableCell>
                  <TableCell>
                    <Badge variant="destructive" className="font-medium">
                      {hasMultiple ? `${cliente.maiorAtraso} dias` : `${mainCobranca.dias_atraso} dias`}
                    </Badge>
                  </TableCell>
                  <TableCell>{cliente.celular}</TableCell>
                  {actions && (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {actions.map((action, i) => (
                            <DropdownMenuItem
                              key={i}
                              onClick={(e) => {
                                e.stopPropagation();
                                action.onClick(cliente);
                              }}
                            >
                              {action.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>

                {/* Painel expandido com cobranças detalhadas */}
                {isExpanded && hasMultiple && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={actions ? 10 : 9} className="p-0 border-0">
                      <div className={cn(
                        "mx-4 my-2 rounded-lg border-2 border-primary/30 overflow-hidden",
                        clienteIdx % 2 === 0 ? "bg-primary/5" : "bg-primary/10"
                      )}>
                        <div className="bg-primary/20 px-4 py-2 border-b border-primary/20">
                          <span className="text-sm font-semibold text-primary">
                            {cliente.cobrancas.length} cobranças de {cliente.cliente_nome}
                          </span>
                          <span className="text-sm text-muted-foreground ml-2">
                            (Total: R$ {cliente.totalValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })})
                          </span>
                        </div>
                        <div className="divide-y divide-border/50">
                          {sortedCobrancas.map((cobranca, idx) => (
                            <div 
                              key={idx} 
                              className="grid grid-cols-5 gap-4 px-4 py-3 items-center hover:bg-primary/5 transition-colors"
                            >
                              <div className="flex flex-col">
                                <span className="text-xs text-muted-foreground uppercase tracking-wide">Vencimento</span>
                                <span className="font-medium">{cobranca.vencimento}</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs text-muted-foreground uppercase tracking-wide">Valor</span>
                                <span className="font-bold text-red-600">
                                  R$ {cobranca.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs text-muted-foreground uppercase tracking-wide">Atraso</span>
                                <Badge variant="destructive" className="w-fit">
                                  {cobranca.dias_atraso} dias
                                </Badge>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs text-muted-foreground uppercase tracking-wide">Status</span>
                                <StatusBadge status={cobranca.status} />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs text-muted-foreground uppercase tracking-wide">Plano</span>
                                <span className="text-sm">{cobranca.plano}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export type { ClienteAgrupado, Cobranca };
