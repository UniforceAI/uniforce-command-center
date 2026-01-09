import { memo, useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Search, ArrowUpDown } from "lucide-react";
import { RespostaNPS } from "@/types/nps";
import { generateInsight, generateAcaoSugerida } from "@/lib/mockDataNPS";
import { cn } from "@/lib/utils";

interface NPSTableProps {
  respostas: RespostaNPS[];
}

const tipoNPSLabels: Record<string, string> = {
  contrato: "Contrato",
  os: "Pós-O.S",
  atendimento: "Atendimento",
};

export const NPSTable = memo(({ respostas }: NPSTableProps) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const dataWithInsights = useMemo(() => 
    respostas.map(r => ({
      ...r,
      insight: generateInsight(r),
      acao_sugerida: generateAcaoSugerida(r),
    })),
    [respostas]
  );

  const columns: ColumnDef<RespostaNPS & { insight: string; acao_sugerida: string }>[] = [
    {
      accessorKey: "cliente_id",
      header: "ID Cliente",
      size: 90,
    },
    {
      accessorKey: "cliente_nome",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="h-8 p-0">
          Nome <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      size: 150,
    },
    {
      accessorKey: "tipo_nps",
      header: "Tipo NPS",
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs">
          {tipoNPSLabels[row.original.tipo_nps]}
        </Badge>
      ),
      size: 120,
    },
    {
      accessorKey: "nota",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="h-8 p-0">
          Nota <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className={cn(
          "font-bold",
          row.original.nota >= 9 && "text-success",
          row.original.nota >= 7 && row.original.nota <= 8 && "text-warning",
          row.original.nota <= 6 && "text-destructive"
        )}>
          {row.original.nota}
        </span>
      ),
      size: 70,
    },
    {
      accessorKey: "classificacao",
      header: "Classificação",
      cell: ({ row }) => (
        <Badge className={cn(
          "text-xs",
          row.original.classificacao === "Promotor" && "bg-success text-success-foreground",
          row.original.classificacao === "Neutro" && "bg-warning text-warning-foreground",
          row.original.classificacao === "Detrator" && "bg-destructive text-destructive-foreground"
        )}>
          {row.original.classificacao}
        </Badge>
      ),
      size: 100,
    },
    {
      accessorKey: "comentario",
      header: "Comentário",
      size: 180,
    },
    {
      accessorKey: "data_resposta",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="h-8 p-0">
          Data <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => new Date(row.original.data_resposta).toLocaleDateString("pt-BR"),
      size: 100,
    },
    {
      accessorKey: "insight",
      header: "Insight",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{row.original.insight}</span>
      ),
      size: 180,
    },
    {
      accessorKey: "acao_sugerida",
      header: "Ação Sugerida",
      cell: ({ row }) => (
        <span className="text-xs font-medium text-primary">{row.original.acao_sugerida}</span>
      ),
      size: 160,
    },
  ];

  const table = useReactTable({
    data: dataWithInsights,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  return (
    <Card className="p-4">
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou comentário..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} respostas
        </span>
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} style={{ width: header.getSize() }}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className={cn(
                  row.original.classificacao === "Detrator" && "bg-destructive/5",
                  row.original.classificacao === "Promotor" && "bg-success/5"
                )}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  Nenhuma resposta encontrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-muted-foreground">
          Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
});

NPSTable.displayName = "NPSTable";
