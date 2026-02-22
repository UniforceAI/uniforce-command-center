import { useState } from "react";
import { Link } from "react-router-dom";
import { externalSupabase } from "@/integrations/supabase/external-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Mail } from "lucide-react";
import uniforceLogo from "@/assets/uniforce-logo.png";

export default function EsqueciSenha() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await externalSupabase.auth.resetPasswordForEmail(email, {
        redirectTo: "https://attendant-analytics.lovable.app/reset-senha",
      });

      if (error) {
        toast.error(error.message);
      } else {
        setSent(true);
        toast.success("Email de recuperação enviado!");
      }
    } catch (err: any) {
      toast.error("Erro inesperado: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{
        background:
          "linear-gradient(135deg, hsl(210 100% 6%) 0%, hsl(213 81% 20%) 100%)",
      }}
    >
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src={uniforceLogo} alt="Uniforce" className="h-12 mx-auto mb-2" />
          <CardDescription>
            {sent
              ? "Verifique sua caixa de entrada"
              : "Informe seu email para recuperar a senha"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="text-center space-y-4">
              <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="h-7 w-7 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                Enviamos um link de recuperação para <strong>{email}</strong>.
                <br />
                Verifique também a pasta de spam.
              </p>
              <Button variant="outline" className="w-full" asChild>
                <Link to="/auth">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar ao login
                </Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@provedor.com.br"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-[hsl(213,81%,54%)] to-[hsl(126,91%,65%)] hover:opacity-90 text-white font-semibold"
                disabled={loading}
              >
                {loading ? "Enviando..." : "Enviar link de recuperação"}
              </Button>

              <div className="text-center">
                <Link
                  to="/auth"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Voltar ao login
                </Link>
              </div>
            </form>
          )}

          <p className="text-xs text-muted-foreground text-center mt-6">
            © {new Date().getFullYear()} Uniforce
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
