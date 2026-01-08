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
            <TableHead className="w-[50px]"></TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Plano</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead>Valor Total</TableHead>
            <TableHead>Método</TableHead>
            <TableHead>Maior Atraso</TableHead>
            <TableHead>Celular</TableHead>
            {actions && <TableHead className="w-[80px]">Ações</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((cliente) => {
            const isExpanded = expandedRows.has(cliente.cliente_id);
            const hasMultiple = cliente.cobrancas.length > 1;
            const mainCobranca = cliente.cobrancas[0];

            return (
              <>
                {/* Linha principal do cliente */}
                <TableRow
                  key={cliente.cliente_id}
                  className={cn(
                    hasMultiple && "cursor-pointer hover:bg-muted/50",
                    isExpanded && "bg-primary/5 border-l-2 border-l-primary"
                  )}
                  onClick={() => hasMultiple && toggleRow(cliente.cliente_id)}
                >
                  <TableCell className="p-2">
                    {hasMultiple ? (
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-primary" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    ) : (
                      <div className="w-7" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {cliente.cliente_nome}
                      {hasMultiple && (
                        <Badge variant="secondary" className="text-xs font-normal bg-orange-100 text-orange-700 border-orange-200">
                          {cliente.cobrancas.length} cobranças
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{mainCobranca.plano}</TableCell>
                  <TableCell><StatusBadge status={mainCobranca.status} /></TableCell>
                  <TableCell>{mainCobranca.vencimento}</TableCell>
                  <TableCell>
                    <span className={cn("font-semibold", hasMultiple && "text-red-600")}>
                      R$ {cliente.totalValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </TableCell>
                  <TableCell>{mainCobranca.metodo}</TableCell>
                  <TableCell>
                    <Badge variant="destructive" className="font-medium">
                      {cliente.maiorAtraso} dias
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

                {/* Sublinhas expandidas - detalhes de cada cobrança */}
                {isExpanded && hasMultiple && (
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={actions ? 10 : 9} className="p-0">
                      <div className="px-6 py-3 ml-8 border-l-2 border-primary/30">
                        <p className="text-xs text-muted-foreground mb-2 font-medium">
                          Detalhamento das {cliente.cobrancas.length} cobranças:
                        </p>
                        <div className="space-y-2">
                          {cliente.cobrancas.map((cobranca, idx) => (
                            <div 
                              key={idx} 
                              className="flex items-center gap-4 text-sm bg-background rounded-md px-3 py-2 border"
                            >
                              <span className="text-muted-foreground font-medium w-6">#{idx + 1}</span>
                              <StatusBadge status={cobranca.status} />
                              <span className="text-muted-foreground">Venc:</span>
                              <span className="font-medium">{cobranca.vencimento}</span>
                              <span className="text-muted-foreground">Valor:</span>
                              <span className="font-semibold text-red-600">
                                R$ {cobranca.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </span>
                              <span className="text-muted-foreground">Atraso:</span>
                              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                {cobranca.dias_atraso} dias
                              </Badge>
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
