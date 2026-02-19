import { useNavigate } from "react-router-dom";
import { useAuth, IspOption } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Wifi, LogOut, ArrowRight } from "lucide-react";

const ISP_ICONS: Record<string, typeof Building2> = {
  "agy-telecom": Wifi,
  "d-kiros": Building2,
};

export default function SelecionarCliente() {
  const navigate = useNavigate();
  const { profile, availableIsps, selectIsp, signOut } = useAuth();

  const handleSelect = (isp: IspOption) => {
    selectIsp(isp);
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Uniforce Ops</h1>
            <p className="text-sm text-muted-foreground">
              Olá, {profile?.full_name || "Admin"}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground">
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-3xl w-full space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold text-foreground">
              Selecione um cliente
            </h2>
            <p className="text-muted-foreground text-lg">
              Escolha o provedor que deseja gerenciar
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {availableIsps.map((isp) => {
              const Icon = ISP_ICONS[isp.isp_id] || Building2;

              return (
                <Card
                  key={isp.isp_id}
                  className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-primary/50 hover:-translate-y-1"
                  onClick={() => handleSelect(isp)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg">{isp.isp_nome}</CardTitle>
                        <CardDescription className="text-xs font-mono">
                          {isp.isp_id}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        {isp.description || "Provedor de internet"}
                      </p>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
