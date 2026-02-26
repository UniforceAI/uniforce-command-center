import React, { useState, useEffect, useMemo, memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Chamado } from "@/types/chamado";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, ChevronDown, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Search, X } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  churnMap?: Map<number, { score: number; bucket: string }>;
}

// Funções utilitárias fora do componente
const formatTempo = (tempo: string | number | null) => {
  if (!tempo && tempo !== 0) {
    return "—";
  }
  
  // Se vier como string vazia, "-" ou "—"
  if (typeof tempo === "string" && (tempo === "—" || tempo === "-" || tempo.trim() === "")) {
    return "—";
  }
  
  let totalHoras = 0;
  
  // Se for número, já é a quantidade de horas
  if (typeof tempo === "number") {
    totalHoras = tempo;
  } 
  // Se for string, verificar o formato
  else if (typeof tempo === "string") {
    // Formato "Aberto há X.Xd" - extrair os dias
    const abertoMatch = tempo.match(/Aberto há ([\d.]+)d/i);
    if (abertoMatch) {
      const dias = parseFloat(abertoMatch[1]);
      if (!isNaN(dias)) {
        return `${dias.toFixed(1)}d`;
      }
    }
    
    // Se for um número em formato string (ex: "9.3", "0", "1.5")
    const numeroFloat = parseFloat(tempo);
    if (!isNaN(numeroFloat) && !tempo.includes("d") && !tempo.includes("h") && !tempo.includes("min")) {
      totalHoras = numeroFloat;
    }
    // Formatos com sufixos simples
    else if (tempo.includes("d")) {
      // Extrair número antes de "d"
      const match = tempo.match(/([\d.]+)d/);
      if (match) {
        totalHoras = parseFloat(match[1]) * 24;
      }
    } else if (tempo.includes("h")) {
      const match = tempo.match(/([\d.]+)h/);
      if (match) {
        totalHoras = parseFloat(match[1]);
      }
    } else if (tempo.includes("min")) {
      const match = tempo.match(/([\d.]+)min/);
      if (match) {
        totalHoras = parseFloat(match[1]) / 60;
      }
    } else {
      // Formato não reconhecido, retornar como está
      return tempo;
    }
  }
  
  // Verificar se conseguimos um número válido
  if (isNaN(totalHoras)) {
    return "—";
  }
  
  // Formatação da saída
  if (totalHoras === 0) {
    return "0h";
  }
  
  if (totalHoras >= 24) {
    const dias = (totalHoras / 24).toFixed(1);
    return `${dias}d`;
  }
  
  if (totalHoras < 1) {
    const minutos = Math.round(totalHoras * 60);
    return `${minutos}min`;
  }
  
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

export const ClientesTable = memo(({ chamados, onClienteClick, churnMap }: ClientesTableProps) => {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [columnResizeMode] = useState<ColumnResizeMode>('onChange');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'Data de Abertura', desc: true }]);
  const [currentPage, setCurrentPage] = useState(1);
  const [nomeFilter, setNomeFilter] = useState("");
  const [motivoFilter, setMotivoFilter] = useState("todos");
  const ITEMS_PER_PAGE = 100;

  // Extrair motivos únicos dos chamados
  const motivosUnicos = useMemo(() => {
    const motivos = new Set<string>();
    chamados.forEach(c => {
      if (c["Motivo do Contato"]) {
        motivos.add(c["Motivo do Contato"]);
      }
    });
    return Array.from(motivos).sort();
  }, [chamados]);

  // Filtrar chamados por nome e motivo
  const filteredChamados = useMemo(() => {
    let filtered = [...chamados];
    
    if (nomeFilter.trim()) {
      const searchLower = nomeFilter.toLowerCase().trim();
      filtered = filtered.filter(c => 
        c.Solicitante?.toLowerCase().includes(searchLower) ||
        String(c["ID Cliente"]).includes(searchLower)
      );
    }
    
    if (motivoFilter !== "todos") {
      filtered = filtered.filter(c => c["Motivo do Contato"] === motivoFilter);
    }
    
    return filtered;
  }, [chamados, nomeFilter, motivoFilter]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [nomeFilter, motivoFilter]);

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
      accessorKey: 'Solicitante',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="hover:bg-transparent p-0 h-auto font-medium"
          >
            Nome Completo
          </Button>
        );
      },
      cell: info => <span className="truncate max-w-[180px] block">{(info.getValue() as string) || "—"}</span>,
      size: 180,
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
        const dataCompleta = (info.getValue() as string) || "";
        if (!dataCompleta) return <span className="text-sm text-muted-foreground">—</span>;
        const [datePart] = dataCompleta.split(" ");
        // Converter para DD/MM/AA
        let formatted = datePart;
        if (datePart.includes("-")) {
          // Formato YYYY-MM-DD
          const [ano, mes, dia] = datePart.split("-");
          formatted = `${dia}/${mes}/${ano?.slice(-2) || ""}`;
        } else if (datePart.includes("/") && datePart.length === 10) {
          // Formato DD/MM/YYYY - converter para DD/MM/AA
          const [dia, mes, ano] = datePart.split("/");
          formatted = `${dia}/${mes}/${ano?.slice(-2) || ""}`;
        }
        return <span className="text-sm text-muted-foreground">{formatted}</span>;
      },
      size: 120,
      sortingFn: (rowA, rowB) => {
        const parseData = (dataStr: string | null) => {
          if (!dataStr) return 0;
          try {
            const [datePart] = dataStr.split(" ");
            // Suportar YYYY-MM-DD e DD/MM/YYYY
            if (datePart.includes("-")) {
              const [ano, mes, dia] = datePart.split("-");
              return new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia)).getTime();
            } else {
              const [dia, mes, ano] = datePart.split("/");
              return new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia)).getTime();
            }
          } catch {
            return 0;
          }
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
      cell: info => <span className="truncate max-w-[200px] block">{(info.getValue() as string) || "—"}</span>,
      size: 200,
    },
    {
      accessorKey: 'Dias ultimo chamado',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="hover:bg-transparent p-0 h-auto font-medium"
          >
            Dias ultimo chamado
          </Button>
        );
      },
      cell: info => <Badge variant="secondary">{info.getValue() as number ?? "—"} dias</Badge>,
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
      id: 'score-risco',
      header: 'Churn Score',
      cell: ({ row }) => {
        if (!churnMap) return <span className="text-xs text-muted-foreground">—</span>;
        const clienteId = typeof row.original["ID Cliente"] === 'string' 
          ? parseInt(row.original["ID Cliente"], 10) 
          : row.original["ID Cliente"];
        const info = churnMap.get(clienteId);
        if (!info) return <span className="text-xs text-muted-foreground">—</span>;
        const cls = info.bucket === "CRÍTICO" ? "bg-red-100 text-red-800 border-red-200"
          : info.bucket === "ALERTA" ? "bg-yellow-100 text-yellow-800 border-yellow-200"
          : "bg-green-100 text-green-800 border-green-200";
        return (
          <Badge className={`${cls} border font-mono text-[10px]`}>
            {info.score} · {info.bucket}
          </Badge>
        );
      },
      size: 120,
      enableSorting: false,
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

  // Paginação com useMemo - usar filteredChamados
  const { totalPages, startIdx, endIdx, paginatedChamados } = useMemo(() => {
    const totalPages = Math.ceil(filteredChamados.length / ITEMS_PER_PAGE);
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIdx = startIdx + ITEMS_PER_PAGE;
    const paginatedChamados = filteredChamados.slice(startIdx, endIdx);
    return { totalPages, startIdx, endIdx, paginatedChamados };
  }, [filteredChamados, currentPage, ITEMS_PER_PAGE]);

  const table = useReactTable({
    data: paginatedChamados,
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
    <div className="rounded-md border bg-card">
      {/* Filtros de Clientes Críticos */}
      <div className="p-4 border-b bg-muted/30 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px] max-w-[300px]">
          <label className="text-sm font-medium mb-1 block">Buscar Cliente</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Nome ou ID do cliente..."
              value={nomeFilter}
              onChange={(e) => setNomeFilter(e.target.value)}
              className="pl-9 pr-8"
            />
            {nomeFilter && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                onClick={() => setNomeFilter("")}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        
        <div className="min-w-[200px]">
          <label className="text-sm font-medium mb-1 block">Filtrar por Motivo</label>
          <Select value={motivoFilter} onValueChange={setMotivoFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Todos os motivos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os motivos</SelectItem>
              {motivosUnicos.map(motivo => (
                <SelectItem key={motivo} value={motivo}>{motivo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="text-sm text-muted-foreground">
          {filteredChamados.length} de {chamados.length} clientes
        </div>

        {(nomeFilter || motivoFilter !== "todos") && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setNomeFilter("");
              setMotivoFilter("todos");
            }}
          >
            Limpar filtros
          </Button>
        )}
      </div>
      
      <div className="overflow-x-auto">
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
                <React.Fragment key={row.id}>
                  <tr className={cn("border-b transition-colors", getRowColor(chamado.Classificação))}>
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
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-4 border-t">
          <p className="text-sm text-muted-foreground">
            Mostrando {startIdx + 1}-{Math.min(endIdx, filteredChamados.length)} de {filteredChamados.length}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Anterior
            </Button>
            <span className="flex items-center px-3 text-sm">
              Página {currentPage} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
               Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});
