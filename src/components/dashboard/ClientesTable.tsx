import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Chamado } from "@/types/chamado";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

interface ClientesTableProps {
  chamados: Chamado[];
  onClienteClick: (chamado: Chamado) => void;
}

export function ClientesTable({ chamados, onClienteClick }: ClientesTableProps) {
  const getClassificacaoColor = (classificacao: string) => {
    switch (classificacao) {
      case "Reincidente":
        return "bg-destructive/10 text-destructive border-destructive/20";
      case "Lento":
        return "bg-warning/10 text-warning border-warning/20";
      case "Rápido":
        return "bg-success/10 text-success border-success/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getRowColor = (classificacao: string) => {
    switch (classificacao) {
      case "Reincidente":
        return "bg-destructive/5 hover:bg-destructive/10";
      case "Lento":
        return "bg-warning/5 hover:bg-warning/10";
      case "Rápido":
        return "bg-success/5 hover:bg-success/10";
      default:
        return "hover:bg-muted/50";
    }
  };

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID Cliente</TableHead>
            <TableHead>Qtd. Chamados</TableHead>
            <TableHead>Último Motivo</TableHead>
            <TableHead>Tempo de Atendimento</TableHead>
            <TableHead>Classificação</TableHead>
            <TableHead>Insight</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {chamados.map((chamado) => (
            <TableRow 
              key={chamado._id || chamado.Protocolo} 
              className={cn("transition-colors", getRowColor(chamado.Classificação))}
            >
              <TableCell className="font-medium">{chamado["ID Cliente"]}</TableCell>
              <TableCell>
                <Badge variant="outline">{chamado["Qtd. Chamados"]}</Badge>
              </TableCell>
              <TableCell className="max-w-[200px] truncate">
                {chamado["Motivo do Contato"]}
              </TableCell>
              <TableCell>{chamado["Tempo de Atendimento"]}</TableCell>
              <TableCell>
                <Badge className={getClassificacaoColor(chamado.Classificação)}>
                  {chamado.Classificação}
                </Badge>
              </TableCell>
              <TableCell className="max-w-[300px] truncate text-sm">
                {chamado.Insight}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onClienteClick(chamado)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
