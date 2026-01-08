import { Card } from "@/components/ui/card";
import { LucideIcon, TrendingUp, TrendingDown, Minus, HelpCircle, Construction } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RiskKPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  variant?: "default" | "success" | "warning" | "danger" | "info";
  delta?: {
    value: number;
    label?: string;
    inverted?: boolean;
  };
  /** 
   * Status da métrica:
   * - "available": dado disponível (padrão)
   * - "unavailable": dado não existe ainda, mostrar "Em implantação"
   * - "loading": carregando
   */
  status?: "available" | "unavailable" | "loading";
  tooltip?: string;
  source?: string;
  onClick?: () => void;
}

export function RiskKPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = "default",
  delta,
  status = "available",
  tooltip,
  source,
  onClick,
}: RiskKPICardProps) {
  const isAvailable = status === "available";
  const isUnavailable = status === "unavailable";

  const variantStyles = {
    default: "border-l-muted-foreground/30",
    success: "border-l-success",
    warning: "border-l-warning",
    danger: "border-l-destructive",
    info: "border-l-primary",
  };

  const iconBgStyles = {
    default: "bg-muted text-muted-foreground",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    danger: "bg-destructive/10 text-destructive",
    info: "bg-primary/10 text-primary",
  };

  const getDeltaColor = () => {
    if (!delta) return "";
    const isPositive = delta.value > 0;
    const isGood = delta.inverted ? !isPositive : isPositive;
    
    if (delta.value === 0) return "text-muted-foreground";
    return isGood ? "text-success" : "text-destructive";
  };

  const getDeltaIcon = () => {
    if (!delta) return null;
    if (delta.value > 0) return <TrendingUp className="h-3 w-3" />;
    if (delta.value < 0) return <TrendingDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  const formatDelta = () => {
    if (!delta) return "";
    const sign = delta.value > 0 ? "+" : "";
    return `${sign}${delta.value}%`;
  };

  const content = (
    <Card
      className={cn(
        "border-l-4 transition-all",
        isAvailable ? variantStyles[variant] : "border-l-muted-foreground/20",
        onClick && isAvailable && "cursor-pointer hover:shadow-md hover:bg-accent/50",
        isUnavailable && "opacity-70"
      )}
      onClick={isAvailable ? onClick : undefined}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* Título */}
            <p className="text-xs font-medium text-muted-foreground">
              {title}
            </p>
            
            {/* Valor */}
            <div className="mt-1">
              {isUnavailable ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 cursor-help">
                      <Construction className="h-4 w-4 text-muted-foreground/50" />
                      <span className="text-sm font-medium text-muted-foreground">
                        Em implantação
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="font-medium text-xs">Aguardando dados</p>
                    {tooltip && <p className="text-xs opacity-80">{tooltip}</p>}
                    {source && <p className="text-xs opacity-60 mt-1">Fonte: {source}</p>}
                  </TooltipContent>
                </Tooltip>
              ) : status === "loading" ? (
                <div className="h-7 w-16 bg-muted animate-pulse rounded" />
              ) : (
                <h3 className="text-xl font-bold">{value}</h3>
              )}
            </div>

            {/* Delta */}
            {isAvailable && delta && (
              <div className={cn("flex items-center gap-1 mt-1 text-xs", getDeltaColor())}>
                {getDeltaIcon()}
                <span>{formatDelta()}</span>
                {delta.label && (
                  <span className="text-muted-foreground">{delta.label}</span>
                )}
              </div>
            )}

            {/* Subtitle */}
            {isAvailable && subtitle && !delta && (
              <p className="text-xs text-muted-foreground mt-1">
                {subtitle}
              </p>
            )}
          </div>

          {/* Ícone */}
          {Icon && (
            <div className={cn(
              "p-2 rounded-lg flex-shrink-0",
              isAvailable ? iconBgStyles[variant] : "bg-muted/50 text-muted-foreground/50"
            )}>
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>
      </div>
    </Card>
  );

  // Wrap com tooltip se tiver onClick
  if (onClick && isAvailable) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent>Clique para ver detalhes</TooltipContent>
      </Tooltip>
    );
  }

  return content;
}
