import React, { useState, useEffect, useMemo, memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Chamado } from "@/types/chamado";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, ChevronDown, ChevronRight, Search, X } from "lucide-react";
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
import { ActionMenu } from "@/components/shared/ActionMenu";

interface ClientesTableProps {
  chamados: Chamado[];
  onClienteClick: (chamado: Chamado) => void;
  churnMap?: Map<number, { score: number; bucket: string }>;
}

const formatTempo = (tempo: string | number | null) => {
  if (!tempo && tempo !== 0) return "—";
  if (typeof tempo === "string" && (tempo === "—" || tempo === "-" || tempo.trim() === "")) return "—";
  
  let totalHoras = 0;
  if (typeof tempo === "number") {
    totalHoras = tempo;
  } else if (typeof tempo === "string") {
    const abertoMatch = tempo.match(/Aberto há ([\d.]+)d/i);
    if (abertoMatch) { return `${parseFloat(abertoMatch[1]).toFixed(1)}d`; }
    const numeroFloat = parseFloat(tempo);
    if (!isNaN(numeroFloat) && !tempo.includes("d") && !tempo.includes("h") && !tempo.includes("min")) {
      totalHoras = numeroFloat;
    } else if (tempo.includes("d")) {
      const match = tempo.match(/([\d.]+)d/);
      if (match) totalHoras = parseFloat(match[1]) * 24;
    } else if (tempo.includes("h")) {
      const match = tempo.match(/([\d.]+)h/);
      if (match) totalHoras = parseFloat(match[1]);
    } else if (tempo.includes("min")) {
      const match = tempo.match(/([\d.]+)min/);
      if (match) totalHoras = parseFloat(match[1]) / 60;
    } else {
      return tempo;
    }
  }
  if (isNaN(totalHoras)) return "—";
  if (totalHoras === 0) return "0h";
  if (totalHoras >= 24) return `${(totalHoras / 24).toFixed(1)}d`;
  if (totalHoras < 1) return `${Math.round(totalHoras * 60)}min`;
  return `${totalHoras.toFixed(1)}h`;
};

const getClassificacaoColor = (classificacao: string) => {
  switch (classificacao) {
    case "Reincidente": return "bg-destructive/10 text-destructive border-destructive/20";
    case "Lento": return "bg-warning/10 text-warning border-warning/20";
    case "Rápido": return "bg-success/10 text-success border-success/20";
    default: return "bg-muted text-muted-foreground";
  }
};

const getRowColor = (classificacao: string) => {
  switch (classificacao) {
    case "Reincidente": return "bg-destructive/5 hover:bg-destructive/10";
    case "Lento": return "bg-warning/5 hover:bg-warning/10";
    case "Rápido": return "bg-success/5 hover:bg-success/10";
    default: return "hover:bg-muted/50";
  }
};

// Status badge colors per spec: Novo=green, Em Andamento=red, Fechado=orange
const getStatusBadge = (status: string) => {
  const map: Record<string, string> = {
    "Novo": "bg-green-100 text-green-800 border-green-300 border",
    "Aberto": "bg-green-100 text-green-800 border-green-300 border",
    "Em Andamento": "bg-red-100 text-red-800 border-red-300 border",
    "EN": "bg-red-100 text-red-800 border-red-300 border",
    "Resolvido": "bg-orange-100 text-orange-800 border-orange-300 border",
    "Fechado": "bg-orange-100 text-orange-800 border-orange-300 border",
  };
  return map[status] || "bg-muted text-muted-foreground border";
};

// Chamados badge: more=red, less=yellow
const getChamadosBadge = (qtd: number) => {
  if (qtd >= 8) return "bg-red-100 text-red-800 border-red-300 border text-sm font-bold px-3 py-1";
  if (qtd >= 5) return "bg-orange-100 text-orange-800 border-orange-300 border text-sm font-semibold px-2.5 py-0.5";
  if (qtd >= 3) return "bg-yellow-100 text-yellow-800 border-yellow-300 border text-xs font-medium px-2 py-0.5";
  return "bg-muted text-muted-foreground border text-xs px-2 py-0.5";
};

// Dias último chamado: more days=yellow (not recent), less days=red (recent/urgent)
const getDiasBadge = (dias: number | null) => {
  if (dias == null) return { cls: "bg-muted text-muted-foreground border text-xs", label: "—" };
  if (dias <= 2) return { cls: "bg-red-100 text-red-800 border-red-300 border text-xs font-bold", label: `${dias}d` };
  if (dias <= 5) return { cls: "bg-orange-100 text-orange-800 border-orange-300 border text-xs font-semibold", label: `${dias}d` };
  if (dias <= 10) return { cls: "bg-yellow-100 text-yellow-800 border-yellow-300 border text-xs", label: `${dias}d` };
  return { cls: "bg-green-100 text-green-800 border-green-200 border text-xs", label: `${dias}d` };
};

export const ClientesTable = memo(({ chamados, onClienteClick, churnMap }: ClientesTableProps) => {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [columnResizeMode] = useState<ColumnResizeMode>('onChange');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'Data de Abertura', desc: true }]);
  const [currentPage, setCurrentPage] = useState(1);
  const [nomeFilter, setNomeFilter] = useState("");
  const [motivoFilter, setMotivoFilter] = useState("todos");
  const ITEMS_PER_PAGE = 100;

  const motivosUnicos = useMemo(() => {
    const motivos = new Set<string>();
    chamados.forEach(c => { if (c["Motivo do Contato"]) motivos.add(c["Motivo do Contato"]); });
    return Array.from(motivos).sort();
  }, [chamados]);

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

  useEffect(() => { setCurrentPage(1); }, [nomeFilter, motivoFilter]);

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) newExpanded.delete(id); else newExpanded.add(id);
    setExpandedRows(newExpanded);
  };

  const columns: ColumnDef<Chamado>[] = [
    {
      id: 'expander',
      header: '',
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" onClick={() => toggleRow(row.original._id || row.original.Protocolo)}>
          {expandedRows.has(row.original._id || row.original.Protocolo) ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      ),
      size: 40,
      enableResizing: false,
      enableSorting: false,
    },
    {
      accessorKey: 'Solicitante',
      header: ({ column }) => (
        <Button variant="ghost" size="sm" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="hover:bg-transparent p-0 h-auto font-medium text-xs">
          Cliente
        </Button>
      ),
      cell: info => {
        const chamado = info.row.original;
        return (
          <div className="max-w-[160px]">
            <p className="truncate font-medium text-xs">{(info.getValue() as string) || "—"}</p>
            <p className="truncate text-[10px] text-muted-foreground">ID: {chamado["ID Cliente"]}</p>
          </div>
        );
      },
      size: 160,
    },
    {
      accessorKey: 'Motivo do Contato',
      header: ({ column }) => (
        <Button variant="ghost" size="sm" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="hover:bg-transparent p-0 h-auto font-medium text-xs">
          Último Motivo
        </Button>
      ),
      cell: info => <span className="truncate max-w-[140px] block text-xs">{(info.getValue() as string) || "—"}</span>,
      size: 150,
    },
    {
      accessorKey: 'Status',
      header: ({ column }) => (
        <Button variant="ghost" size="sm" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="hover:bg-transparent p-0 h-auto font-medium text-xs">
          Status
        </Button>
      ),
      cell: info => {
        const status = info.getValue() as string;
        return <Badge className={cn("text-xs", getStatusBadge(status))}>{status}</Badge>;
      },
      size: 110,
    },
    {
      id: 'qtd-chamados',
      accessorFn: row => row["Qtd. Chamados"],
      header: ({ column }) => (
        <Button variant="ghost" size="sm" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="hover:bg-transparent p-0 h-auto font-medium text-xs">
          Chamados
        </Button>
      ),
      cell: info => {
        const qtd = info.getValue() as number;
        return <Badge className={getChamadosBadge(qtd)}>{qtd}</Badge>;
      },
      size: 90,
    },
    {
      accessorKey: 'Dias ultimo chamado',
      header: ({ column }) => (
        <Button variant="ghost" size="sm" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="hover:bg-transparent p-0 h-auto font-medium text-xs">
          Dias Último
        </Button>
      ),
      cell: info => {
        const dias = info.getValue() as number | null;
        const badge = getDiasBadge(dias);
        return <Badge className={badge.cls}>{badge.label}</Badge>;
      },
      size: 100,
    },
    {
      accessorKey: 'Tempo de Atendimento',
      header: ({ column }) => (
        <Button variant="ghost" size="sm" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="hover:bg-transparent p-0 h-auto font-medium text-xs">
          Tempo
        </Button>
      ),
      cell: info => <span className="text-xs text-muted-foreground">{formatTempo(info.getValue() as string)}</span>,
      size: 80,
    },
    {
      accessorKey: 'Classificação',
      header: ({ column }) => (
        <Button variant="ghost" size="sm" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="hover:bg-transparent p-0 h-auto font-medium text-xs">
          Classificação
        </Button>
      ),
      cell: info => {
        const classificacao = info.getValue() as string;
        return <Badge className={cn("text-[10px]", getClassificacaoColor(classificacao))}>{classificacao}</Badge>;
      },
      size: 100,
    },
    {
      id: 'score-risco',
      header: 'Churn',
      cell: ({ row }) => {
        if (!churnMap) return <span className="text-[10px] text-muted-foreground">—</span>;
        const clienteId = typeof row.original["ID Cliente"] === 'string'
          ? parseInt(row.original["ID Cliente"], 10)
          : row.original["ID Cliente"];
        const info = churnMap.get(clienteId);
        if (!info) return <span className="text-[10px] text-muted-foreground">—</span>;
        const cls = info.bucket === "CRÍTICO" ? "bg-red-100 text-red-800 border-red-200"
          : info.bucket === "ALERTA" ? "bg-yellow-100 text-yellow-800 border-yellow-200"
          : "bg-green-100 text-green-800 border-green-200";
        return <Badge className={`${cls} border font-mono text-[10px]`}>{info.score}</Badge>;
      },
      size: 70,
      enableSorting: false,
    },
    {
      id: 'actions',
      header: 'Ações',
      cell: ({ row }) => {
        const chamado = row.original;
        const clienteId = typeof chamado["ID Cliente"] === 'string'
          ? parseInt(chamado["ID Cliente"], 10)
          : chamado["ID Cliente"];
        return (
          <div className="flex items-center gap-0.5">
            <ActionMenu
              clientId={clienteId}
              clientName={chamado.Solicitante || `Cliente ${clienteId}`}
              variant="suporte"
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => onClienteClick(chamado)}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Ver chamado</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        );
      },
      size: 100,
      enableResizing: false,
      enableSorting: false,
    },
  ];

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
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="rounded-md border bg-card">
      {/* Filters */}
      <div className="p-4 border-b bg-muted/30 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px] max-w-[300px]">
          <label className="text-sm font-medium mb-1 block">Buscar Cliente</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Nome ou ID..." value={nomeFilter} onChange={(e) => setNomeFilter(e.target.value)} className="pl-9 pr-8" />
            {nomeFilter && (
              <Button variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0" onClick={() => setNomeFilter("")}>
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        <div className="min-w-[200px]">
          <label className="text-sm font-medium mb-1 block">Filtrar por Motivo</label>
          <Select value={motivoFilter} onValueChange={setMotivoFilter}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os motivos</SelectItem>
              {motivosUnicos.map(motivo => (<SelectItem key={motivo} value={motivo}>{motivo}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm text-muted-foreground">{filteredChamados.length} de {chamados.length} clientes</div>
        {(nomeFilter || motivoFilter !== "todos") && (
          <Button variant="outline" size="sm" onClick={() => { setNomeFilter(""); setMotivoFilter("todos"); }}>
            Limpar filtros
          </Button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id} className="border-b">
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    className="h-10 px-3 text-left align-middle font-medium text-muted-foreground relative text-xs"
                    style={{ width: `${header.getSize()}px`, minWidth: `${header.getSize()}px` }}
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getCanResize() && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        onDoubleClick={() => header.column.resetSize()}
                        className={cn("table-resize-handle", header.column.getIsResizing() && "resizing")}
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
                        className="p-3 align-middle overflow-hidden"
                        style={{ width: `${cell.column.getSize()}px`, minWidth: `${cell.column.getSize()}px`, maxWidth: `${cell.column.getSize()}px` }}
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
                                <div className="col-span-1">Class.</div>
                              </div>
                              {chamadosAnteriores.map((anterior, idx) => (
                                <div key={idx} className="grid grid-cols-12 gap-2 text-sm py-2 border-b last:border-b-0">
                                  <div className="col-span-2 font-medium truncate text-xs">{anterior.Protocolo}</div>
                                  <div className="col-span-2 text-muted-foreground text-xs">{anterior["Data de Abertura"].split(" ")[0]}</div>
                                  <div className="col-span-3 truncate text-xs">{anterior["Motivo do Contato"]}</div>
                                  <div className="col-span-2"><Badge className={cn("text-[10px]", getStatusBadge(anterior.Status))}>{anterior.Status}</Badge></div>
                                  <div className="col-span-2 text-muted-foreground text-xs">{formatTempo(anterior["Tempo de Atendimento"])}</div>
                                  <div className="col-span-1"><Badge className={cn("text-[10px]", getClassificacaoColor(anterior.Classificação))}>{anterior.Classificação}</Badge></div>
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-4 border-t">
          <p className="text-sm text-muted-foreground">
            Mostrando {startIdx + 1}-{Math.min(endIdx, filteredChamados.length)} de {filteredChamados.length}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}>Anterior</Button>
            <span className="flex items-center px-3 text-sm">Página {currentPage} de {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>Próxima</Button>
          </div>
        </div>
      )}
    </div>
  );
});
