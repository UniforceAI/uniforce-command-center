import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { externalSupabase } from "@/integrations/supabase/external-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle } from "lucide-react";
import uniforceLogo from "@/assets/uniforce-logo.png";

export default function ResetSenha() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [hasRecoveryToken, setHasRecoveryToken] = useState(false);

  useEffect(() => {
    // Check if we arrived via a recovery link (hash contains type=recovery)
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setHasRecoveryToken(true);
    }

    // Listen for PASSWORD_RECOVERY event
    const { data: { subscription } } = externalSupabase.auth.onAuthStateChange(
      (event) => {
        if (event === "PASSWORD_RECOVERY") {
          setHasRecoveryToken(true);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }

    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await externalSupabase.auth.updateUser({
        password,
      });

      if (error) {
        toast.error(error.message);
      } else {
        setSuccess(true);
        toast.success("Senha alterada com sucesso!");
        setTimeout(() => navigate("/auth"), 3000);
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
            {success ? "Senha alterada!" : "Defina sua nova senha"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="text-center space-y-4">
              <div className="mx-auto w-14 h-14 rounded-full bg-accent/20 flex items-center justify-center">
                <CheckCircle className="h-7 w-7 text-accent-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Sua senha foi alterada com sucesso.
                <br />
                Redirecionando para o login...
              </p>
            </div>
          ) : !hasRecoveryToken ? (
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                Link de recuperação inválido ou expirado.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate("/esqueci-senha")}
              >
                Solicitar novo link
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nova senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Repita a senha"
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-[hsl(213,81%,54%)] to-[hsl(126,91%,65%)] hover:opacity-90 text-white font-semibold"
                disabled={loading}
              >
                {loading ? "Salvando..." : "Redefinir senha"}
              </Button>
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
