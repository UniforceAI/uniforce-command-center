// src/components/perfil/tabs/ContasTab.tsx
// Aba "Contas" — redireciona para a página de gestão de contas de acesso

import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, ArrowRight, Shield, UserCog } from "lucide-react";

export function ContasTab() {
  const navigate = useNavigate();

  return (
    <div className="space-y-4 max-w-lg">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Contas de Acesso
          </CardTitle>
          <CardDescription>
            Gerencie os usuários com acesso à plataforma Uniforce para o seu provedor.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
              <UserCog className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Criar e editar usuários</p>
                <p className="text-xs text-muted-foreground">Adicione novos colaboradores e edite seus dados de acesso.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
              <Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Gerenciar permissões</p>
                <p className="text-xs text-muted-foreground">Defina roles de admin, suporte ou usuário para cada colaborador.</p>
              </div>
            </div>
          </div>

          <Button
            className="w-full gap-2"
            onClick={() => navigate("/configuracoes/contas")}
          >
            <Users className="h-4 w-4" />
            Gerenciar Contas de Acesso
            <ArrowRight className="h-4 w-4 ml-auto" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
