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
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
            <TableHead>Cliente</TableHead>
            <TableHead>Plano</TableHead>
            <TableHead>Status</TableHead>
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
            const mainCobranca = cliente.cobrancas[0];

            return (
              <TableRow key={cliente.cliente_id}>
                <TableCell className="font-medium">
                  {cliente.cliente_nome}
                </TableCell>
                <TableCell>{mainCobranca.plano}</TableCell>
                <TableCell><StatusBadge status={mainCobranca.status} /></TableCell>
                <TableCell>{mainCobranca.vencimento}</TableCell>
                <TableCell>
                  <span className="font-semibold">
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
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {actions.map((action, i) => (
                          <DropdownMenuItem
                            key={i}
                            onClick={() => action.onClick(cliente)}
                          >
                            {action.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export type { ClienteAgrupado, Cobranca };
