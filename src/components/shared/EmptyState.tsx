import { AlertCircle, Database, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface EmptyStateProps {
  title?: string;
  description?: string;
  source?: string; // Ex: "tabela nps-check", "campo risk_score"
  icon?: React.ReactNode;
  className?: string;
  variant?: "inline" | "card" | "compact";
}

/**
 * Componente padronizado para estados vazios/N/A
 * Usado quando dados não estão disponíveis
 */
export function EmptyState({
  title = "Dados indisponíveis",
  description,
  source,
  icon,
  className,
  variant = "card",
}: EmptyStateProps) {
  if (variant === "compact") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("text-muted-foreground cursor-help inline-flex items-center gap-1", className)}>
            N/A
            <HelpCircle className="h-3 w-3" />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{title}</p>
          {description && <p className="text-xs opacity-80">{description}</p>}
          {source && <p className="text-xs opacity-60 mt-1">Fonte: {source}</p>}
        </TooltipContent>
      </Tooltip>
    );
  }

  if (variant === "inline") {
    return (
      <div className={cn("flex items-center gap-2 text-muted-foreground", className)}>
        {icon || <AlertCircle className="h-4 w-4" />}
        <span className="text-sm">
          {title}
          {source && <span className="opacity-60"> • {source}</span>}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center justify-center py-8 px-4 text-center", className)}>
      <div className="p-3 bg-muted/50 rounded-full mb-4">
        {icon || <Database className="h-8 w-8 text-muted-foreground" />}
      </div>
      <h3 className="text-lg font-medium text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-md">{description}</p>
      )}
      {source && (
        <p className="text-xs text-muted-foreground/60 mt-2">
          Aguardando dados da {source}
        </p>
      )}
    </div>
  );
}

/**
 * Valor N/A inline com tooltip
 */
export function NAValue({
  tooltip,
  source,
  className,
}: {
  tooltip?: string;
  source?: string;
  className?: string;
}) {
  return (
    <EmptyState
      variant="compact"
      title={tooltip || "Dado não disponível"}
      source={source}
      className={className}
    />
  );
}
