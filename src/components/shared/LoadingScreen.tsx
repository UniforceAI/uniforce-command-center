import { useState, useEffect } from "react";
import uniconIcon from "@/assets/uniforce-icon.png";

const PHRASES = [
  "Não automatizamos o óbvio, criamos inteligência que libera seu time para o estratégico, para o que é humano,",
  "…e transforma a qualidade e eficiência do seu provedor.",
];

export function LoadingScreen() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFadeIn(false);
      setTimeout(() => {
        setPhraseIndex((prev) => (prev + 1) % PHRASES.length);
        setFadeIn(true);
      }, 600);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-6">
      {/* Icon with pulse */}
      <div className="relative mb-8">
        <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: "2s" }} />
        <img
          src={uniconIcon}
          alt="Uniforce"
          className="h-16 w-16 relative z-10 animate-scale-in"
        />
      </div>

      {/* Tagline */}
      <p className="text-sm font-medium text-foreground/80 tracking-wide mb-6 text-center max-w-md animate-fade-in">
        Liberte seu time para o que importa. Bem-vindo à era da inteligência.
      </p>

      {/* Progress bar */}
      <div className="w-48 h-0.5 bg-muted rounded-full overflow-hidden mb-8">
        <div className="h-full bg-primary/60 rounded-full animate-[loading_2s_ease-in-out_infinite]" />
      </div>

      {/* Rotating phrase */}
      <p
        className={`text-xs text-muted-foreground text-center max-w-sm leading-relaxed transition-opacity duration-500 ${
          fadeIn ? "opacity-100" : "opacity-0"
        }`}
      >
        {PHRASES[phraseIndex]}
      </p>

      <style>{`
        @keyframes loading {
          0% { width: 0%; }
          50% { width: 100%; }
          100% { width: 0%; }
        }
      `}</style>
    </div>
  );
}
