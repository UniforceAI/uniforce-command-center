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
  success: "border-l-green-500",
  warning: "border-l-yellow-500",
  danger: "border-l-red-500",
  info: "border-l-blue-500",
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
                trend >= 0 ? "text-green-600" : "text-red-600"
              )}>
                {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}% vs período anterior
              </p>
            )}
          </div>
          {Icon && (
            <div className={cn(
              "p-2 rounded-lg",
              variant === "danger" ? "bg-red-100 text-red-600" :
              variant === "success" ? "bg-green-100 text-green-600" :
              variant === "warning" ? "bg-yellow-100 text-yellow-600" :
              variant === "info" ? "bg-blue-100 text-blue-600" :
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
