import { HelpCircle, Filter, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FilterOption {
  value: string;
  label: string;
}

interface FilterConfig {
  id: string;
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  tooltip?: string;
}

interface GlobalFiltersProps {
  filters: FilterConfig[];
}

export function GlobalFilters({ filters }: GlobalFiltersProps) {
  const activeFilters = filters.filter(
    (f) => f.value !== "todos" && f.value !== "todas" && f.value !== ""
  );

  const clearAll = () => {
    filters.forEach((f) => {
      const defaultVal = f.options[0]?.value || "todos";
      f.onChange(defaultVal);
    });
  };

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm shadow-sm overflow-hidden">
      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap px-4 py-2.5">
        <div className="flex items-center gap-1.5 mr-1">
          <div className="flex items-center justify-center h-6 w-6 rounded-md bg-primary/10">
            <Filter className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-xs font-semibold text-foreground">Filtros</span>
        </div>

        {filters.map((filter) => (
          <div key={filter.id} className="flex items-center gap-1">
            {filter.disabled && filter.tooltip && (
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-[200px] text-xs">{filter.tooltip}</p>
                </TooltipContent>
              </Tooltip>
            )}
            <div className="relative">
              <span className="absolute -top-2 left-2 text-[8px] uppercase tracking-wider text-muted-foreground bg-card px-1 z-10 font-medium">
                {filter.label}
              </span>
              <Select
                value={filter.value}
                onValueChange={filter.onChange}
                disabled={filter.disabled}
              >
                <SelectTrigger
                  className={cn(
                    "h-8 text-xs min-w-[100px] max-w-[140px] rounded-lg border-border/80 bg-background transition-all",
                    filter.value !== "todos" && filter.value !== "todas"
                      ? "border-primary/40 bg-primary/5 text-primary font-medium"
                      : ""
                  )}
                >
                  <SelectValue placeholder={filter.label} />
                </SelectTrigger>
                <SelectContent>
                  {filter.options.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-xs">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}

        {/* Active filters count + clear */}
        {activeFilters.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="h-7 text-xs text-muted-foreground hover:text-destructive gap-1 ml-auto"
          >
            <X className="h-3 w-3" />
            Limpar ({activeFilters.length})
          </Button>
        )}
      </div>

      {/* Active filter chips */}
      {activeFilters.length > 0 && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-primary/5 border-t border-primary/10">
          <span className="text-[10px] text-muted-foreground">Aplicados:</span>
          {activeFilters.map((f) => {
            const selectedOption = f.options.find((o) => o.value === f.value);
            return (
              <Badge
                key={f.id}
                variant="secondary"
                className="text-[10px] py-0 px-2 gap-1 bg-primary/10 text-primary border-primary/20 cursor-pointer hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 transition-colors"
                onClick={() => {
                  const defaultVal = f.options[0]?.value || "todos";
                  f.onChange(defaultVal);
                }}
              >
                {f.label}: {selectedOption?.label || f.value}
                <X className="h-2.5 w-2.5" />
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
