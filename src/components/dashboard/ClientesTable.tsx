import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Chamado } from "@/types/chamado";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Eye, ChevronDown, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useReactTable,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  SortingState,
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
  const [sorting, setSorting] = useState<SortingState>([]);

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  // Adicionar classe ao body durante resize para melhorar UX
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (document.querySelector('.resizing')) {
        document.body.classList.add('resizing-cursor-active');
      }
    };

    const handleMouseUp = () => {
      document.body.classList.remove('resizing-cursor-active');
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.classList.remove('resizing-cursor-active');
    };
  }, []);

  const formatTempo = (tempo: string) => {
    if (!tempo || tempo === "—" || tempo === "-") {
      return "—";
    }
    
    let totalHoras = 0;
    
    if (tempo.includes("d")) {
      // Converter dias para horas para poder calcular
      const dias = parseFloat(tempo.split("d")[0]);
      totalHoras = dias * 24;
    } else if (tempo.includes("h")) {
      totalHoras = parseFloat(tempo.split("h")[0]);
    } else if (tempo.includes("min")) {
      totalHoras = parseFloat(tempo.split("min")[0]) / 60;
    } else {
      return tempo;
    }
    
    // Se for 0, mostrar como tal
    if (totalHoras === 0) {
      return "0h";
    }
    
    // Se for >= 24 horas (1 dia ou mais), mostrar em dias
    if (totalHoras >= 24) {
      const dias = (totalHoras / 24).toFixed(1);
      return `${dias}d`;
    }
    
    // Se for menos de 1 hora, mostrar em minutos
    if (totalHoras < 1) {
      const minutos = Math.round(totalHoras * 60);
      return `${minutos}min`;
    }
    
    // Mostrar em horas com 1 casa decimal
    return `${totalHoras.toFixed(1)}h`;
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
      enableSorting: false,
    },
    {
      accessorKey: 'ID Cliente',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="hover:bg-transparent p-0 h-auto font-medium"
          >
            ID Cliente
          </Button>
        );
      },
      cell: info => <span className="font-medium">{info.getValue() as string}</span>,
      size: 100,
    },
    {
      accessorKey: 'Data de Abertura',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="hover:bg-transparent p-0 h-auto font-medium"
          >
            Data Abertura
          </Button>
        );
      },
      cell: info => {
        const dataCompleta = info.getValue() as string;
        const [datePart] = dataCompleta.split(" ");
        return <span className="text-sm text-muted-foreground">{datePart}</span>;
      },
      size: 120,
      sortingFn: (rowA, rowB) => {
        const parseData = (dataStr: string) => {
          const [datePart] = dataStr.split(" ");
          const [dia, mes, ano] = datePart.split("/");
          return new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia)).getTime();
        };
        return parseData(rowA.original["Data de Abertura"]) - parseData(rowB.original["Data de Abertura"]);
      },
    },
    {
      id: 'qtd-chamados',
      accessorFn: row => row["Qtd. Chamados"],
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="hover:bg-transparent p-0 h-auto font-medium"
          >
            Qtd. Chamados
          </Button>
        );
      },
      cell: info => <Badge variant="outline">{info.getValue() as number}</Badge>,
      size: 130,
    },
    {
      accessorKey: 'Motivo do Contato',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="hover:bg-transparent p-0 h-auto font-medium"
          >
            Último Motivo
          </Button>
        );
      },
      cell: info => <span className="truncate max-w-[200px] block">{info.getValue() as string}</span>,
      size: 200,
    },
    {
      accessorKey: 'Dias desde Último Chamado',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="hover:bg-transparent p-0 h-auto font-medium"
          >
            Dias desde Último
          </Button>
        );
      },
      cell: info => <Badge variant="secondary">{info.getValue() as number} dias</Badge>,
      size: 150,
    },
    {
      accessorKey: 'Status',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="hover:bg-transparent p-0 h-auto font-medium"
          >
            Status
          </Button>
        );
      },
      cell: info => {
        const status = info.getValue() as string;
        const statusColors: Record<string, string> = {
          "Novo": "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
          "Em Andamento": "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
          "Resolvido": "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
          "Fechado": "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20",
        };
        return (
          <Badge className={cn("text-xs", statusColors[status] || "")}>
            {status}
          </Badge>
        );
      },
      size: 130,
    },
    {
      accessorKey: 'Tempo de Atendimento',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="hover:bg-transparent p-0 h-auto font-medium"
          >
            Tempo de Atendimento
          </Button>
        );
      },
      cell: info => formatTempo(info.getValue() as string),
      size: 170,
    },
    {
      accessorKey: 'Classificação',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="hover:bg-transparent p-0 h-auto font-medium"
          >
            Classificação
          </Button>
        );
      },
      cell: info => {
        const classificacao = info.getValue() as string;
        return <Badge className={getClassificacaoColor(classificacao)}>{classificacao}</Badge>;
      },
      size: 130,
    },
    {
      accessorKey: 'Insight',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="hover:bg-transparent p-0 h-auto font-medium"
          >
            Insight
          </Button>
        );
      },
      cell: info => {
        const insight = info.getValue() as string;
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="truncate max-w-[300px] block text-sm cursor-help">
                  {insight}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-md">
                <p className="text-sm">{insight}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
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
      enableSorting: false,
    },
  ];

  const table = useReactTable({
    data: chamados,
    columns,
    columnResizeMode,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="rounded-md border bg-card overflow-x-auto">
      <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id} className="border-b">
              {headerGroup.headers.map(header => (
                <th
                  key={header.id}
                  className="h-12 px-4 text-left align-middle font-medium text-muted-foreground relative"
                  style={{
                    width: `${header.getSize()}px`,
                    minWidth: `${header.getSize()}px`,
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
                      onDoubleClick={() => header.column.resetSize()}
                      className={cn(
                        "table-resize-handle",
                        header.column.getIsResizing() && "resizing"
                      )}
                      title="Arraste para redimensionar, duplo clique para resetar"
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
            const chamadosAnteriores = chamado._chamadosAnteriores || [];
            const isExpanded = expandedRows.has(chamado._id || chamado.Protocolo);
            
            return (
              <>
                <tr key={row.id} className={cn("border-b transition-colors", getRowColor(chamado.Classificação))}>
                  {row.getVisibleCells().map(cell => (
                    <td
                      key={cell.id}
                      className="p-4 align-middle overflow-hidden"
                      style={{
                        width: `${cell.column.getSize()}px`,
                        minWidth: `${cell.column.getSize()}px`,
                        maxWidth: `${cell.column.getSize()}px`,
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
                        <h4 className="font-semibold text-sm mb-3">Chamados Anteriores ({chamadosAnteriores.length}):</h4>
                        {chamadosAnteriores.length > 0 ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground pb-2 border-b">
                              <div className="col-span-2">Protocolo</div>
                              <div className="col-span-2">Data</div>
                              <div className="col-span-3">Motivo</div>
                              <div className="col-span-2">Status</div>
                              <div className="col-span-2">Tempo</div>
                              <div className="col-span-1">Classificação</div>
                            </div>
                            {chamadosAnteriores.map((anterior, idx) => (
                              <div key={idx} className="grid grid-cols-12 gap-2 text-sm py-2 border-b last:border-b-0">
                                <div className="col-span-2 font-medium truncate">{anterior.Protocolo}</div>
                                <div className="col-span-2 text-muted-foreground text-xs">
                                  {anterior["Data de Abertura"].split(" ")[0]}
                                </div>
                                <div className="col-span-3 truncate">{anterior["Motivo do Contato"]}</div>
                                <div className="col-span-2">
                                  <Badge variant="outline" className="text-xs">
                                    {anterior.Status}
                                  </Badge>
                                </div>
                                <div className="col-span-2 text-muted-foreground">
                                  {formatTempo(anterior["Tempo de Atendimento"])}
                                </div>
                                <div className="col-span-1">
                                  <Badge className={cn("text-xs", getClassificacaoColor(anterior.Classificação))}>
                                    {anterior.Classificação}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Este é o único chamado do cliente.</p>
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
