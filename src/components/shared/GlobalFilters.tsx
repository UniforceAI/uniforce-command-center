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
    <div className="flex flex-wrap gap-4 p-4 bg-card rounded-lg border">
      {filters.map((filter) => (
        <div key={filter.id} className="flex flex-col gap-1.5 min-w-[150px]">
          <div className="flex items-center gap-1">
            <label className="text-sm font-medium text-muted-foreground">
              {filter.label}
            </label>
            {filter.disabled && filter.tooltip && (
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-[200px] text-xs">{filter.tooltip}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <Select
            value={filter.value}
            onValueChange={filter.onChange}
            disabled={filter.disabled}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {filter.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
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
