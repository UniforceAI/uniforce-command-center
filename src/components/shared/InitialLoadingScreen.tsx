import { useState, useEffect } from "react";
import uniconIcon from "@/assets/uniforce-icon.png";
import uniforceLogo from "@/assets/uniforce-logo.png";

const SCENES = [
  {
    text: "Liberte seu time para o que importa.",
    subtitle: "Bem-vindo à era da inteligência.",
    delay: 0,
  },
  {
    text: "Não automatizamos o óbvio, criamos inteligência que libera seu time para o estratégico,",
    subtitle: "para o que é humano.",
    delay: 4500,
  },
  {
    text: "…e transforma a qualidade e eficiência do seu provedor.",
    subtitle: "",
    delay: 9000,
  },
];

export function InitialLoadingScreen() {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(0);

  // Scene rotation
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    SCENES.forEach((scene, i) => {
      if (i === 0) return;
      timers.push(
        setTimeout(() => {
          setVisible(false);
          setTimeout(() => {
            setSceneIndex(i);
            setVisible(true);
          }, 800);
        }, scene.delay)
      );
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  // Progress bar
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 95) return 95;
        return p + Math.random() * 3 + 0.5;
      });
    }, 200);
    return () => clearInterval(interval);
  }, []);

  const scene = SCENES[sceneIndex];

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden">
      {/* Background with brand gradient */}
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
          animation: "float 8s ease-in-out infinite",
          top: "10%",
          left: "-10%",
        }}
      />
      <div
        className="absolute w-[400px] h-[400px] rounded-full opacity-15 blur-[100px]"
        style={{
          background: "linear-gradient(225deg, hsl(126 91% 65%), hsl(213 81% 54%))",
          animation: "float 10s ease-in-out infinite reverse",
          bottom: "5%",
          right: "-5%",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center px-8 max-w-3xl text-center">
        {/* Logo icon with glow */}
        <div className="relative mb-12">
          <div
            className="absolute inset-0 rounded-full blur-2xl opacity-40"
            style={{
              background: "linear-gradient(135deg, hsl(213 81% 54%), hsl(126 91% 65%))",
              transform: "scale(2.5)",
              animation: "pulse-glow 3s ease-in-out infinite",
            }}
          />
          <img
            src={uniconIcon}
            alt="Uniforce"
            className="h-20 w-20 relative z-10 animate-scale-in"
            style={{ filter: "drop-shadow(0 0 30px hsl(213 81% 54% / 0.5))" }}
          />
        </div>

        {/* Scene text — large, bold, cinematic */}
        <div
          className={`transition-all duration-700 ease-in-out ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <h1
            className="text-3xl md:text-5xl font-bold leading-tight mb-4"
            style={{
              background: "linear-gradient(135deg, hsl(0 0% 100%) 0%, hsl(213 81% 74%) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {scene.text}
          </h1>
          {scene.subtitle && (
            <p
              className="text-xl md:text-2xl font-light"
              style={{
                background: "linear-gradient(90deg, hsl(126 91% 65%) 0%, hsl(213 81% 74%) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {scene.subtitle}
            </p>
          )}
        </div>

        {/* Progress bar — subtle at the bottom */}
        <div className="mt-16 w-64">
          <div className="h-[2px] bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, hsl(213 81% 54%), hsl(126 91% 65%))",
              }}
            />
          </div>
          <p className="text-xs text-white/30 mt-3 tracking-widest uppercase">
            Preparando sua experiência
          </p>
        </div>

        {/* Logo signature at bottom */}
        <div className="mt-16 opacity-40">
          <img src={uniforceLogo} alt="Uniforce" className="h-6" style={{ filter: "brightness(2)" }} />
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -20px) scale(1.05); }
          66% { transform: translate(-20px, 20px) scale(0.95); }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.3; transform: scale(2.5); }
          50% { opacity: 0.5; transform: scale(3); }
        }
      `}</style>
    </div>
  );
}
