import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Chamado } from "@/types/chamado";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Eye, ChevronDown, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  useReactTable,
  getCoreRowModel,
  getExpandedRowModel,
  ColumnDef,
  flexRender,
  ColumnResizeMode,
} from "@tanstack/react-table";

interface ClientesTableProps {
  chamados: Chamado[];
  onClienteClick: (chamado: Chamado) => void;
}

export function ClientesTable({ chamados, onClienteClick }: ClientesTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [columnResizeMode] = useState<ColumnResizeMode>('onChange');

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const formatTempo = (tempo: string) => {
    let totalHoras = 0;
    
    if (tempo.includes("h")) {
      totalHoras = parseFloat(tempo.split("h")[0]);
    } else if (tempo.includes("min")) {
      totalHoras = parseFloat(tempo.split("min")[0]) / 60;
    } else if (tempo.includes("dia")) {
      return tempo;
    } else {
      return tempo;
    }
    
    if (totalHoras >= 24) {
      const dias = Math.floor(totalHoras / 24);
      return `${dias} dia${dias > 1 ? 's' : ''}`;
    }
    
    return `${totalHoras.toFixed(1)}h`;
  };

  const parseChamadosAnteriores = (chamadosStr: string) => {
    try {
      if (!chamadosStr || chamadosStr === "-") return [];
      
      return chamadosStr.split(";").map(item => {
        const [protocolo, data] = item.split(" - ").map(s => s.trim());
        return { protocolo, data };
      }).filter(item => item.protocolo && item.data);
    } catch (e) {
      console.error("Erro ao parsear chamados anteriores:", e);
      return [];
    }
  };

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

  const columns: ColumnDef<Chamado>[] = [
    {
      id: 'expander',
      header: '',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => toggleRow(row.original._id || row.original.Protocolo)}
        >
          {expandedRows.has(row.original._id || row.original.Protocolo) ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      ),
      size: 50,
      enableResizing: false,
    },
    {
      accessorKey: 'ID Cliente',
      header: 'ID Cliente',
      cell: info => <span className="font-medium">{info.getValue() as string}</span>,
      size: 100,
    },
    {
      accessorKey: 'Qtd. Chamados',
      header: 'Qtd. Chamados',
      cell: info => <Badge variant="outline">{info.getValue() as number}</Badge>,
      size: 130,
    },
    {
      accessorKey: 'Motivo do Contato',
      header: 'Último Motivo',
      cell: info => <span className="truncate max-w-[200px] block">{info.getValue() as string}</span>,
      size: 200,
    },
    {
      accessorKey: 'Dias desde Último Chamado',
      header: 'Dias desde Último',
      cell: info => <Badge variant="secondary">{info.getValue() as number} dias</Badge>,
      size: 150,
    },
    {
      accessorKey: 'Tempo de Atendimento',
      header: 'Tempo de Atendimento',
      cell: info => formatTempo(info.getValue() as string),
      size: 170,
    },
    {
      accessorKey: 'Classificação',
      header: 'Classificação',
      cell: info => {
        const classificacao = info.getValue() as string;
        return <Badge className={getClassificacaoColor(classificacao)}>{classificacao}</Badge>;
      },
      size: 130,
    },
    {
      accessorKey: 'Insight',
      header: 'Insight',
      cell: info => <span className="truncate max-w-[300px] block text-sm">{info.getValue() as string}</span>,
      size: 300,
    },
    {
      id: 'actions',
      header: 'Ações',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onClienteClick(row.original)}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
      size: 80,
      enableResizing: false,
    },
  ];

  const table = useReactTable({
    data: chamados,
    columns,
    columnResizeMode,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  return (
    <div className="rounded-md border bg-card overflow-auto">
      <table className="w-full border-collapse">
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id} className="border-b">
              {headerGroup.headers.map(header => (
                <th
                  key={header.id}
                  className="h-12 px-4 text-left align-middle font-medium text-muted-foreground relative"
                  style={{
                    width: header.getSize(),
                  }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                  {header.column.getCanResize() && (
                    <div
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      className={cn(
                        "absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none bg-border hover:bg-primary/50 transition-colors",
                        header.column.getIsResizing() && "bg-primary"
                      )}
                    />
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map(row => {
            const chamado = row.original;
            const chamadosAnteriores = parseChamadosAnteriores(chamado["Chamados Anteriores"]);
            const isExpanded = expandedRows.has(chamado._id || chamado.Protocolo);
            
            console.log("Chamado:", chamado["ID Cliente"], "Expandido:", isExpanded, "Anteriores:", chamadosAnteriores.length);
            
            return (
              <>
                <tr key={row.id} className={cn("border-b transition-colors", getRowColor(chamado.Classificação))}>
                  {row.getVisibleCells().map(cell => (
                    <td
                      key={cell.id}
                      className="p-4 align-middle"
                      style={{
                        width: cell.column.getSize(),
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
                {isExpanded && (
                  <tr className="border-b bg-muted/30">
                    <td colSpan={columns.length} className="p-0">
                      <div className="p-4">
                        <h4 className="font-semibold text-sm mb-3">Chamados Anteriores:</h4>
                        {chamadosAnteriores.length > 0 ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground pb-2 border-b">
                              <div className="col-span-3">Protocolo</div>
                              <div className="col-span-2">Data</div>
                              <div className="col-span-3">Motivo</div>
                              <div className="col-span-2">Status</div>
                              <div className="col-span-2">Tempo</div>
                            </div>
                            {chamadosAnteriores.map((anterior, idx) => (
                              <div key={idx} className="grid grid-cols-12 gap-2 text-sm py-2 border-b last:border-b-0">
                                <div className="col-span-3 font-medium">{anterior.protocolo}</div>
                                <div className="col-span-2 text-muted-foreground">{anterior.data}</div>
                                <div className="col-span-3 truncate">{chamado["Motivo do Contato"]}</div>
                                <div className="col-span-2">
                                  <Badge variant="outline" className="text-xs">
                                    {chamado.Status}
                                  </Badge>
                                </div>
                                <div className="col-span-2 text-muted-foreground">
                                  {formatTempo(chamado["Tempo de Atendimento"])}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Nenhum chamado anterior encontrado.</p>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
