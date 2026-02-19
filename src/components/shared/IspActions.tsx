import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveIsp } from "@/hooks/useActiveIsp";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, RefreshCcw } from "lucide-react";

interface IspActionsProps {
  className?: string;
}

/**
 * Componente padronizado exibido em todos os headers:
 * - Badge com nome do ISP
 * - Botão "Trocar Cliente" (apenas super admins)
 * - Botão "Sair"
 */
export function IspActions({ className }: IspActionsProps) {
  const navigate = useNavigate();
  const { signOut, isSuperAdmin, clearSelectedIsp } = useAuth();
  const { ispNome } = useActiveIsp();

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleTrocarCliente = () => {
    clearSelectedIsp();
    navigate("/selecionar-cliente");
  };

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <Badge variant="outline" className="text-xs font-medium px-2 py-0.5">
        {ispNome}
      </Badge>

      {isSuperAdmin && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleTrocarCliente}
          className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          Trocar Cliente
        </Button>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={handleLogout}
        className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <LogOut className="h-3.5 w-3.5" />
        Sair
      </Button>
    </div>
  );
}
