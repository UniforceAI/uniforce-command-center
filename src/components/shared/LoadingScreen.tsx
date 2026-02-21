import { useState, useEffect } from "react";
import uniconIcon from "@/assets/uniforce-icon.png";

const PHRASES = [
  "Não automatizamos o óbvio, criamos inteligência que libera seu time para o estratégico, para o que é humano,",
  "…e transforma a qualidade e eficiência do seu provedor.",
];

export function LoadingScreen() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFadeIn(false);
      setTimeout(() => {
        setPhraseIndex((prev) => (prev + 1) % PHRASES.length);
        setFadeIn(true);
      }, 500);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => (p >= 95 ? 95 : p + Math.random() * 4 + 1));
    }, 250);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center px-6 py-12">
      {/* Icon with gradient glow */}
      <div className="relative mb-10">
        <div
          className="absolute inset-0 rounded-full blur-xl opacity-30"
          style={{
            background: "linear-gradient(135deg, hsl(213 81% 54%), hsl(126 91% 65%))",
            transform: "scale(3)",
            animation: "pulse-secondary 2.5s ease-in-out infinite",
          }}
        />
        <img
          src={uniconIcon}
          alt="Uniforce"
          className="h-14 w-14 relative z-10 animate-scale-in"
          style={{ filter: "drop-shadow(0 0 20px hsl(213 81% 54% / 0.4))" }}
        />
      </div>

      {/* Main tagline */}
      <h2
        className="text-xl md:text-2xl font-semibold text-center max-w-lg mb-3 animate-fade-in"
        style={{
          background: "linear-gradient(135deg, hsl(var(--foreground)) 0%, hsl(213 81% 54%) 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        Liberte seu time para o que importa.
      </h2>
      <p className="text-sm text-muted-foreground mb-8 animate-fade-in">
        Bem-vindo à era da inteligência.
      </p>

      {/* Progress bar */}
      <div className="w-56 mb-8">
        <div className="h-[2px] bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg, hsl(213 81% 54%), hsl(126 91% 65%))",
            }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground/50 mt-2 text-center tracking-widest uppercase">
          Carregando dados
        </p>
      </div>

      {/* Rotating phrase */}
      <p
        className={`text-base md:text-lg text-muted-foreground text-center max-w-md leading-relaxed font-light transition-all duration-500 ${
          fadeIn ? "opacity-70 translate-y-0" : "opacity-0 translate-y-2"
        }`}
      >
        {PHRASES[phraseIndex]}
      </p>

      <style>{`
        @keyframes pulse-secondary {
          0%, 100% { opacity: 0.2; transform: scale(3); }
          50% { opacity: 0.4; transform: scale(3.5); }
        }
      `}</style>
    </div>
  );
}
