import { useState, useEffect, useCallback } from "react";
import { externalSupabase } from "@/integrations/supabase/external-client";
import uniconIcon from "@/assets/uniforce-icon.png";

interface EmailVerificationPendingProps {
  email: string;
  onSignOut: () => void;
}

export function EmailVerificationPending({ email, onSignOut }: EmailVerificationPendingProps) {
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleResend = useCallback(async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    try {
      await externalSupabase.auth.resend({ type: "signup", email });
      setResent(true);
      setCooldown(60);
    } catch {
      // silently fail — user can retry
    } finally {
      setResending(false);
    }
  }, [email, cooldown, resending]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden">
      {/* Dark background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 30% 20%, hsl(213 81% 54% / 0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, hsl(126 91% 65% / 0.1) 0%, transparent 50%), hsl(210 100% 6%)",
        }}
      />

      {/* Animated gradient orbs */}
      <div
        className="absolute w-[600px] h-[600px] rounded-full opacity-20 blur-[120px]"
        style={{
          background: "linear-gradient(135deg, hsl(213 81% 54%), hsl(126 91% 65%))",
          animation: "float-auth 8s ease-in-out infinite",
          top: "10%",
          left: "-10%",
        }}
      />
      <div
        className="absolute w-[400px] h-[400px] rounded-full opacity-15 blur-[100px]"
        style={{
          background: "linear-gradient(225deg, hsl(126 91% 65%), hsl(213 81% 54%))",
          animation: "float-auth 10s ease-in-out infinite reverse",
          bottom: "5%",
          right: "-5%",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center px-8 max-w-md text-center">
        {/* Logo with glow */}
        <div className="relative mb-10">
          <div
            className="absolute inset-0 rounded-full blur-2xl opacity-40"
            style={{
              background: "linear-gradient(135deg, hsl(213 81% 54%), hsl(126 91% 65%))",
              transform: "scale(2.5)",
              animation: "pulse-auth 3s ease-in-out infinite",
            }}
          />
          <img
            src={uniconIcon}
            alt="Uniforce"
            className="h-16 w-16 relative z-10"
            style={{ filter: "drop-shadow(0 0 30px hsl(213 81% 54% / 0.5))" }}
          />
        </div>

        <h2
          className="text-xl font-semibold mb-2"
          style={{
            background: "linear-gradient(135deg, hsl(0 0% 100%) 0%, hsl(213 81% 74%) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Confirme seu e-mail
        </h2>

        <p className="text-white/50 text-sm mb-2">
          Enviamos um link de confirmacao para:
        </p>
        <p className="text-white/80 text-sm font-medium mb-6">
          {email}
        </p>
        <p className="text-white/40 text-xs mb-8 leading-relaxed">
          Abra seu e-mail e clique no link para ativar sua conta.
          Verifique tambem a pasta de spam.
        </p>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={handleResend}
            disabled={cooldown > 0 || resending}
            className="px-5 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
            style={{
              background: "linear-gradient(135deg, hsl(213 81% 54%), hsl(126 91% 65%))",
              color: "white",
              boxShadow: "0 4px 15px hsl(213 81% 54% / 0.3)",
            }}
          >
            {resending
              ? "Enviando..."
              : cooldown > 0
              ? `Reenviar em ${cooldown}s`
              : resent
              ? "Reenviar e-mail"
              : "Reenviar e-mail de confirmacao"}
          </button>

          <button
            onClick={onSignOut}
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-white/50 hover:text-white/80 transition-colors"
          >
            Voltar ao login
          </button>
        </div>
      </div>

      <style>{`
        @keyframes float-auth {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -20px) scale(1.05); }
          66% { transform: translate(-20px, 20px) scale(0.95); }
        }
        @keyframes pulse-auth {
          0%, 100% { opacity: 0.3; transform: scale(2.5); }
          50% { opacity: 0.5; transform: scale(3); }
        }
      `}</style>
    </div>
  );
}
