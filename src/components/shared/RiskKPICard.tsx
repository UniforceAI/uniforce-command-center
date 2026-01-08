import { Card } from "@/components/ui/card";
import { LucideIcon, TrendingUp, TrendingDown, Minus, HelpCircle } from "lucide-react";
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
    label?: string; // Ex: "vs últimos 30d"
    inverted?: boolean; // Se true, negativo é bom (ex: menos churn)
  };
  disponivel?: boolean;
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
  disponivel = true,
  tooltip,
  source,
  onClick,
}: RiskKPICardProps) {
  const variantStyles = {
    default: "border-l-border",
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
        "border-l-4 hover:shadow-md transition-all",
        variantStyles[variant],
        onClick && "cursor-pointer hover:bg-accent/50",
        !disponivel && "opacity-60"
      )}
      onClick={onClick}
    >
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <p className="text-xs font-medium text-muted-foreground truncate">
                {title}
              </p>
              {!disponivel && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-medium">Dado não disponível</p>
                    {tooltip && <p className="text-xs opacity-80">{tooltip}</p>}
                    {source && <p className="text-xs opacity-60 mt-1">Fonte: {source}</p>}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            
            <div className="mt-1">
              {disponivel ? (
                <h3 className="text-2xl font-bold truncate">{value}</h3>
              ) : (
                <h3 className="text-2xl font-bold text-muted-foreground">N/A</h3>
              )}
            </div>

            {/* Delta */}
            {disponivel && delta && (
              <div className={cn("flex items-center gap-1 mt-1 text-xs", getDeltaColor())}>
                {getDeltaIcon()}
                <span>{formatDelta()}</span>
                {delta.label && (
                  <span className="text-muted-foreground">{delta.label}</span>
                )}
              </div>
            )}

            {/* Subtitle */}
            {disponivel && subtitle && !delta && (
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {subtitle}
              </p>
            )}
          </div>

          {Icon && (
            <div className={cn("p-2 rounded-lg flex-shrink-0", iconBgStyles[variant])}>
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
      </div>
    </Card>
  );

  // Wrap in tooltip if has onClick
  if (onClick) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent>Clique para ver detalhes</TooltipContent>
      </Tooltip>
    );
  }

  return content;
}
