// components/shared/DataImportOverlay.tsx
// Overlay de tela inteira exibido durante a importação inicial de dados do ISP.
// Bloqueia o acesso às páginas de dados até que a primeira carga seja concluída.
// "Completo" = ≥ 40 min sem receber novo registro após o primeiro.

import { useState, useEffect } from "react";
import uniconIcon from "@/assets/uniforce-icon.png";

const MESSAGES = [
  {
    headline: "Seus dados estão chegando.",
    sub: "Estamos conectando ao seu ERP e trazendo tudo para a Uniforce.",
  },
  {
    headline: "Cada cliente, cada contrato.",
    sub: "Mapeando o histórico completo do seu provedor com cuidado.",
  },
  {
    headline: "Inteligência sendo calibrada.",
    sub: "Calculando churn score, risco e inadimplência para cada cliente.",
  },
  {
    headline: "Quase lá.",
    sub: "Quanto mais dados, mais precisa a inteligência. Vale a espera.",
  },
];

function erpDisplayName(instancia: string): string {
  const map: Record<string, string> = {
    ispbox: "ISPBox",
    ixc: "IXC Provedor",
    mk: "MK Solutions",
    uniforce: "Uniforce",
  };
  return map[instancia?.toLowerCase()] || instancia || "ERP";
}

interface Props {
  ispNome: string;
  instanciaIsp: string;
  totalRecords?: number;
}

export function DataImportOverlay({ ispNome, instanciaIsp, totalRecords = 0 }: Props) {
  const [msgIdx, setMsgIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  const [dots, setDots] = useState(1);

  // Rotaciona mensagens a cada 6s
  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setMsgIdx((i) => (i + 1) % MESSAGES.length);
        setVisible(true);
      }, 600);
    }, 6000);
    return () => clearInterval(id);
  }, []);

  // Animação de pontos "..."
  useEffect(() => {
    const id = setInterval(() => setDots((d) => (d % 3) + 1), 600);
    return () => clearInterval(id);
  }, []);

  const msg = MESSAGES[msgIdx];
  const erpName = erpDisplayName(instanciaIsp);

  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 25% 25%, hsl(213 81% 54% / 0.12) 0%, transparent 55%), radial-gradient(ellipse at 75% 75%, hsl(258 70% 60% / 0.10) 0%, transparent 55%), hsl(210 100% 5%)",
        }}
      />

      {/* Floating orbs */}
      <div
        className="absolute rounded-full opacity-15 blur-[100px] pointer-events-none"
        style={{
          width: 500,
          height: 500,
          background: "linear-gradient(135deg, hsl(213 81% 54%), hsl(258 70% 60%))",
          animation: "df-float 9s ease-in-out infinite",
          top: "-10%",
          left: "-5%",
        }}
      />
      <div
        className="absolute rounded-full opacity-10 blur-[80px] pointer-events-none"
        style={{
          width: 350,
          height: 350,
          background: "linear-gradient(225deg, hsl(258 70% 60%), hsl(213 81% 54%))",
          animation: "df-float 12s ease-in-out infinite reverse",
          bottom: "0%",
          right: "-5%",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center px-8 max-w-2xl text-center">
        {/* Icon */}
        <div className="relative mb-10">
          <div
            className="absolute inset-0 rounded-full blur-2xl opacity-35 pointer-events-none"
            style={{
              background: "linear-gradient(135deg, hsl(213 81% 54%), hsl(258 70% 60%))",
              transform: "scale(3)",
              animation: "df-pulse 3.5s ease-in-out infinite",
            }}
          />
          <img
            src={uniconIcon}
            alt="Uniforce"
            className="h-16 w-16 relative z-10"
            style={{ filter: "drop-shadow(0 0 24px hsl(213 81% 54% / 0.6))" }}
          />
        </div>

        {/* ISP + ERP badge */}
        <div
          className="mb-8 px-4 py-1.5 rounded-full text-xs font-medium tracking-wide"
          style={{
            background: "hsl(213 81% 54% / 0.12)",
            border: "1px solid hsl(213 81% 54% / 0.25)",
            color: "hsl(213 81% 74%)",
          }}
        >
          {ispNome} · {erpName}
        </div>

        {/* Rotating message */}
        <div className="h-28 flex flex-col items-center justify-center">
          <div
            className="transition-all duration-600 ease-in-out"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(12px)",
              transition: "opacity 0.6s ease, transform 0.6s ease",
            }}
          >
            <h2
              className="text-2xl md:text-3xl font-semibold leading-snug mb-3"
              style={{
                background:
                  "linear-gradient(135deg, hsl(0 0% 100%) 0%, hsl(213 81% 74%) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {msg.headline}
            </h2>
            <p className="text-sm md:text-base text-white/50 leading-relaxed max-w-md">
              {msg.sub}
            </p>
          </div>
        </div>

        {/* Record count (only show after first records arrive) */}
        {totalRecords > 0 && (
          <div className="mt-2 mb-6 text-xs text-white/35">
            {totalRecords.toLocaleString("pt-BR")} registros importados até agora
          </div>
        )}

        {/* Animated dots loader */}
        <div className="mt-8 flex items-center gap-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-full"
              style={{
                width: 7,
                height: 7,
                background:
                  i <= dots
                    ? "hsl(213 81% 54%)"
                    : "hsl(213 81% 54% / 0.2)",
                transition: "background 0.3s ease",
              }}
            />
          ))}
        </div>

        <p className="mt-5 text-xs text-white/25 tracking-widest uppercase">
          Importação em andamento — aguarde
        </p>
      </div>

      <style>{`
        @keyframes df-float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          40% { transform: translate(25px, -18px) scale(1.04); }
          70% { transform: translate(-15px, 15px) scale(0.97); }
        }
        @keyframes df-pulse {
          0%, 100% { opacity: 0.25; transform: scale(3); }
          50% { opacity: 0.45; transform: scale(3.4); }
        }
      `}</style>
    </div>
  );
}
