import { HelpCircle } from "lucide-react";
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
  return (
    <div className="flex flex-wrap items-center gap-2 py-2 px-3 bg-muted/30 border-b">
      <span className="text-xs text-muted-foreground mr-1">Filtros:</span>
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
          <Select
            value={filter.value}
            onValueChange={filter.onChange}
            disabled={filter.disabled}
          >
            <SelectTrigger className="h-7 text-xs min-w-[90px] max-w-[120px] bg-background">
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
      ))}
    </div>
  );
}
