import { useState, useMemo, useCallback } from "react";
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
import { MoreHorizontal, ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
  sortable?: boolean;
  sortValue?: (item: T) => string | number;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (item: T) => void;
  actions?: {
    label: string;
    onClick: (item: T) => void;
  }[];
  emptyMessage?: string;
  maxRows?: number;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  onRowClick,
  actions,
  emptyMessage = "Nenhum dado encontrado",
  maxRows,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = useCallback((key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }, [sortKey]);

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return data;
    const dir = sortDir === "desc" ? -1 : 1;
    return [...data].sort((a, b) => {
      const va = col.sortValue ? col.sortValue(a) : a[sortKey];
      const vb = col.sortValue ? col.sortValue(b) : b[sortKey];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "string" && typeof vb === "string") return dir * va.localeCompare(vb);
      return dir * ((va as number) - (vb as number));
    });
  }, [data, sortKey, sortDir, columns]);

  const displayData = maxRows ? sortedData.slice(0, maxRows) : sortedData;

  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sortKey !== colKey) return <ArrowUpDown className="h-3 w-3 ml-1 text-muted-foreground/50" />;
    return sortDir === "desc" ? <ChevronDown className="h-3 w-3 ml-1 text-primary" /> : <ChevronUp className="h-3 w-3 ml-1 text-primary" />;
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
            {columns.map((col) => {
              const isSortable = col.sortable !== false;
              return (
                <TableHead
                  key={col.key}
                  className={cn(col.className, isSortable && "cursor-pointer select-none hover:bg-muted/50")}
                  onClick={isSortable ? () => toggleSort(col.key) : undefined}
                >
                  {isSortable ? (
                    <span className="flex items-center">
                      {col.label}
                      <SortIcon colKey={col.key} />
                    </span>
                  ) : (
                    col.label
                  )}
                </TableHead>
              );
            })}
            {actions && <TableHead className="w-[80px]">Ações</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayData.map((item, idx) => (
            <TableRow
              key={idx}
              className={cn(onRowClick && "cursor-pointer hover:bg-muted/50")}
              onClick={() => onRowClick?.(item)}
            >
              {columns.map((col) => (
                <TableCell key={col.key} className={col.className}>
                  {col.render ? col.render(item) : item[col.key] ?? "-"}
                </TableCell>
              ))}
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
                          onClick={(e) => {
                            e.stopPropagation();
                            action.onClick(item);
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
          ))}
        </TableBody>
      </Table>
      {maxRows && data.length > maxRows && (
        <div className="p-2 text-center text-sm text-muted-foreground border-t">
          Mostrando {maxRows} de {data.length} registros
        </div>
      )}
    </div>
  );
}

// Badge helpers
export function RiskBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    "Crítico": "bg-red-100 text-red-700 border-red-200",
    "Alto": "bg-orange-100 text-orange-700 border-orange-200",
    "Médio": "bg-yellow-100 text-yellow-700 border-yellow-200",
    "Baixo": "bg-green-100 text-green-700 border-green-200",
  };

  return (
    <Badge variant="outline" className={styles[level] || ""}>
      {level}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    "Vencido": "bg-red-100 text-red-700 border-red-200",
    "Em aberto": "bg-yellow-100 text-yellow-700 border-yellow-200",
    "Recuperado": "bg-green-100 text-green-700 border-green-200",
    "Em negociação": "bg-blue-100 text-blue-700 border-blue-200",
  };

  return (
    <Badge variant="outline" className={styles[status] || ""}>
      {status}
    </Badge>
  );
}
