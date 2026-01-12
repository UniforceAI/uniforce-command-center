import { useState } from "react";
import { Card } from "@/components/ui/card";
import { LucideIcon, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  variant?: "default" | "warning" | "success" | "destructive";
  detalhes?: Array<{ id: string | number; label: string | null }>;
}

export function KPICard({ title, value, subtitle, icon: Icon, trend, variant = "default", detalhes }: KPICardProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const variantStyles = {
    default: "border-l-primary",
    warning: "border-l-warning",
    success: "border-l-success",
    destructive: "border-l-destructive",
  };

  const iconBgStyles = {
    default: "bg-primary/10 text-primary",
    warning: "bg-warning/10 text-warning",
    success: "bg-success/10 text-success",
    destructive: "bg-destructive/10 text-destructive",
  };

  const hasDetalhes = detalhes && detalhes.length > 0;

  return (
    <Card className={cn("border-l-4 hover:shadow-lg transition-shadow", variantStyles[variant])}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button className={cn("p-6 w-full text-left", hasDetalhes && "pb-4")}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">{title}</p>
                <h3 className="text-3xl font-bold mt-2">{value}</h3>
                {subtitle && (
                  <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className={cn("p-3 rounded-lg", iconBgStyles[variant])}>
                  <Icon className="h-6 w-6" />
                </div>
                {hasDetalhes && (
                  <div className="text-muted-foreground">
                    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                )}
              </div>
            </div>
          </button>
        </CollapsibleTrigger>
        {hasDetalhes && (
          <CollapsibleContent>
            <div className="px-6 pb-6 pt-2 border-t">
              <div className="space-y-2 mt-3">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Clientes:</p>
                <div className="flex flex-wrap gap-2">
                  {detalhes.slice(0, 10).map((item, idx) => (
                    <Badge key={`${item.id}-${idx}`} variant="outline" className="text-xs">
                      #{item.id} - {item.label || "—"}
                    </Badge>
                  ))}
                  {detalhes.length > 10 && (
                    <Badge variant="secondary" className="text-xs">
                      +{detalhes.length - 10} mais
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CollapsibleContent>
        )}
      </Collapsible>
    </Card>
  );
}
