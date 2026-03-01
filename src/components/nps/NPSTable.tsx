import { memo, useState, useMemo, useCallback } from "react";
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
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft, ChevronRight, Search, ArrowUpDown, ChevronUp, ChevronDown,
  FileText,
} from "lucide-react";
import { RespostaNPS } from "@/types/nps";
import { ActionMenu } from "@/components/shared/ActionMenu";
import { useCrmWorkflow } from "@/hooks/useCrmWorkflow";
import { cn } from "@/lib/utils";

interface NPSTableProps {
  respostas: RespostaNPS[];
}

const tipoNPSLabels: Record<string, string> = {
  contrato: "Contrato",
  os: "Pós-O.S",
};

export const NPSTable = memo(({ respostas }: NPSTableProps) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const { addToWorkflow } = useCrmWorkflow();

  const SortHeader = useCallback(({ column, label }: { column: any; label: string }) => {
    const sorted = column.getIsSorted();
    return (
      <Button variant="ghost" onClick={() => column.toggleSorting(sorted === "asc")} className="h-8 p-0 text-xs">
        {label}
        {sorted === "asc" ? <ChevronUp className="ml-1 h-3 w-3" /> :
         sorted === "desc" ? <ChevronDown className="ml-1 h-3 w-3" /> :
         <ArrowUpDown className="ml-1 h-3 w-3 opacity-30" />}
      </Button>
    );
  }, []);

  const columns: ColumnDef<RespostaNPS>[] = useMemo(() => [
    {
      accessorKey: "cliente_nome",
      header: ({ column }) => <SortHeader column={column} label="Nome" />,
      size: 150,
    },
    {
      accessorKey: "tipo_nps",
      header: ({ column }) => <SortHeader column={column} label="Tipo NPS" />,
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs">
          {tipoNPSLabels[row.original.tipo_nps] || row.original.tipo_nps}
        </Badge>
      ),
      size: 100,
    },
    {
      accessorKey: "nota",
      header: ({ column }) => <SortHeader column={column} label="Nota" />,
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
      size: 60,
    },
    {
      accessorKey: "classificacao",
      header: ({ column }) => <SortHeader column={column} label="Classificação" />,
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
      header: ({ column }) => <SortHeader column={column} label="Comentário" />,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground max-w-[180px] truncate block">
          {row.original.comentario || "—"}
        </span>
      ),
      size: 180,
    },
    {
      accessorKey: "data_resposta",
      header: ({ column }) => <SortHeader column={column} label="Data" />,
      cell: ({ row }) => (
        <span className="text-xs">
          {new Date(row.original.data_resposta).toLocaleDateString("pt-BR")}
        </span>
      ),
      size: 90,
    },
    {
      id: "acoes",
      header: "Ações",
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <ActionMenu
            clientId={row.original.cliente_id}
            clientName={row.original.cliente_nome}
            clientPhone={(row.original as any).celular}
            variant="nps"
            onSendToTreatment={() => addToWorkflow(row.original.cliente_id)}
          />
        </div>
      ),
      size: 80,
    },
  ], [SortHeader, addToWorkflow]);

  const table = useReactTable({
    data: respostas,
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
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Respostas NPS — {table.getFilteredRowModel().rows.length} registros
          </CardTitle>
        </div>
      </CardHeader>
      <div className="px-4 pb-2">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou comentário..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="overflow-auto max-h-[480px]">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
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
                  "hover:bg-muted/50 transition-colors",
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

      <div className="flex items-center justify-between p-4">
        <div className="text-sm text-muted-foreground">
          Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
});

NPSTable.displayName = "NPSTable";
