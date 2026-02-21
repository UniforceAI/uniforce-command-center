import { LucideIcon, HelpCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface KPICardNewProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: number;
  disponivel?: boolean;
  tooltip?: string;
  variant?: "default" | "success" | "warning" | "danger" | "info";
}

const variantStyles = {
  default: "border-l-primary",
  success: "border-l-success",
  warning: "border-l-warning",
  danger: "border-l-destructive",
  info: "border-l-primary",
};

export function KPICardNew({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  disponivel = true,
  tooltip,
  variant = "default",
}: KPICardNewProps) {
  const displayValue = disponivel ? value : "Indisponível";

  return (
    <Card className={cn("border-l-4", variantStyles[variant])}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              {!disponivel && tooltip && (
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-[200px] text-xs">{tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <p className={cn(
              "text-2xl font-bold",
              !disponivel && "text-muted-foreground text-lg"
            )}>
              {displayValue}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
            {trend !== undefined && disponivel && (
              <p className={cn(
                "text-xs font-medium",
                trend >= 0 ? "text-success" : "text-destructive"
              )}>
                {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}% vs período anterior
              </p>
            )}
          </div>
          {Icon && (
            <div className={cn(
              "p-2 rounded-lg",
              variant === "danger" ? "bg-destructive/10 text-destructive" :
              variant === "success" ? "bg-success/10 text-success" :
              variant === "warning" ? "bg-warning/10 text-warning" :
              variant === "info" ? "bg-primary/10 text-primary" :
              "bg-primary/10 text-primary"
            )}>
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
