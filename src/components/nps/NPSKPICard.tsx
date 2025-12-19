import { Card } from "@/components/ui/card";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface NPSKPICardProps {
  title: string;
  value: number;
  trend?: number;
  icon: LucideIcon;
}

function getNPSStatus(value: number): { label: string; variant: string } {
  if (value >= 75) return { label: "Excelente", variant: "success" };
  if (value >= 50) return { label: "Bom", variant: "default" };
  if (value >= 0) return { label: "Alerta", variant: "warning" };
  return { label: "Crítico", variant: "destructive" };
}

export function NPSKPICard({ title, value, trend, icon: Icon }: NPSKPICardProps) {
  const status = getNPSStatus(value);
  
  const variantClasses = {
    success: "border-l-4 border-l-success bg-success/5",
    default: "border-l-4 border-l-primary bg-primary/5",
    warning: "border-l-4 border-l-warning bg-warning/5",
    destructive: "border-l-4 border-l-destructive bg-destructive/5",
  };

  const iconBgClasses = {
    success: "bg-success/10 text-success",
    default: "bg-primary/10 text-primary",
    warning: "bg-warning/10 text-warning",
    destructive: "bg-destructive/10 text-destructive",
  };

  return (
    <Card className={cn("p-4", variantClasses[status.variant as keyof typeof variantClasses])}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{value}</span>
            {trend !== undefined && (
              <span className={cn(
                "flex items-center text-sm font-medium",
                trend >= 0 ? "text-success" : "text-destructive"
              )}>
                {trend >= 0 ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                {Math.abs(trend)}%
              </span>
            )}
          </div>
          <span className={cn(
            "text-xs font-semibold px-2 py-1 rounded-full",
            status.variant === "success" && "bg-success/20 text-success",
            status.variant === "default" && "bg-primary/20 text-primary",
            status.variant === "warning" && "bg-warning/20 text-warning",
            status.variant === "destructive" && "bg-destructive/20 text-destructive"
          )}>
            {status.label}
          </span>
        </div>
        <div className={cn("p-3 rounded-lg", iconBgClasses[status.variant as keyof typeof iconBgClasses])}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </Card>
  );
}
