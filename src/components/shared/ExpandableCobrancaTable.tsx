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
            <TableHead className="w-[40px]"></TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Plano</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-center">Cobranças</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Método</TableHead>
            <TableHead>Dias Atraso</TableHead>
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
                    isExpanded && "bg-muted/30"
                  )}
                  onClick={() => hasMultiple && toggleRow(cliente.cliente_id)}
                >
                  <TableCell className="p-2">
                    {hasMultiple ? (
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    ) : (
                      <div className="w-6" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {cliente.cliente_nome}
                  </TableCell>
                  <TableCell>{mainCobranca.plano}</TableCell>
                  <TableCell><StatusBadge status={mainCobranca.status} /></TableCell>
                  <TableCell className="text-center">
                    <span className={cn(
                      "font-medium",
                      hasMultiple && "text-orange-600"
                    )}>
                      {cliente.cobrancas.length}
                    </span>
                  </TableCell>
                  <TableCell>{mainCobranca.vencimento}</TableCell>
                  <TableCell>
                    <span className={cn(hasMultiple && "font-semibold text-red-600")}>
                      R$ {cliente.totalValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </TableCell>
                  <TableCell>{mainCobranca.metodo}</TableCell>
                  <TableCell>
                    {cliente.maiorAtraso > 0 ? `${cliente.maiorAtraso} dias` : "-"}
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

                {/* Sublinhas expandidas (outras cobranças) */}
                {isExpanded && hasMultiple && cliente.cobrancas.slice(1).map((cobranca, idx) => (
                  <TableRow
                    key={`${cliente.cliente_id}-sub-${idx}`}
                    className="bg-muted/20"
                  >
                    <TableCell className="p-2">
                      <div className="w-6 border-l-2 border-muted-foreground/30 h-full ml-3" />
                    </TableCell>
                    <TableCell className="text-muted-foreground pl-6">↳ Cobrança {idx + 2}</TableCell>
                    <TableCell>{cobranca.plano}</TableCell>
                    <TableCell><StatusBadge status={cobranca.status} /></TableCell>
                    <TableCell></TableCell>
                    <TableCell>{cobranca.vencimento}</TableCell>
                    <TableCell>R$ {cobranca.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell>{cobranca.metodo}</TableCell>
                    <TableCell>{cobranca.dias_atraso > 0 ? `${cobranca.dias_atraso} dias` : "-"}</TableCell>
                    <TableCell></TableCell>
                    {actions && <TableCell></TableCell>}
                  </TableRow>
                ))}
              </>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export type { ClienteAgrupado, Cobranca };
