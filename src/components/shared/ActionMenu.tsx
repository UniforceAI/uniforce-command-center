import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { User } from "lucide-react";

export type ActionType =
  | "call"
  | "whatsapp"
  | "pix_sent"
  | "payment_promise"
  | "task_created"
  | "manual_note"
  | "os_opened"
  | "copy_pix"
  | "copy_boleto"
  | "copy_pix_qrcode"
  | "send_treatment";

interface ActionMenuProps {
  clientId: number;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  variant?: "cobranca" | "risco" | "suporte" | "cancelamento" | "nps";
  onActionLogged?: (action: ActionType) => void;
  onSendToTreatment?: () => void;
  onOpenProfile?: () => void;
}

export function ActionMenu({ onOpenProfile }: ActionMenuProps) {
  return (
    <div className="flex items-center gap-0.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={onOpenProfile}
          >
            <User className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Ver perfil</TooltipContent>
      </Tooltip>
    </div>
  );
}

/**
 * Botões de ação rápida (sem menu dropdown) — DEPRECATED, use ActionMenu instead
 */
export function QuickActions() {
  return null;
}
