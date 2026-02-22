import { useState, useEffect } from "react";
import uniconIcon from "@/assets/uniforce-icon.png";
import uniforceLogo from "@/assets/uniforce-logo.png";

const SCENES = [
  {
    text: "Não automatizamos o óbvio,",
    emphasis: null,
  },
  {
    text: "Criamos inteligência que libera seu time para o estratégico,",
    emphasis: "para o que é humano!",
  },
  {
    text: "…e transforma a qualidade e eficiência",
    emphasis: "do seu provedor.",
  },
];

export function InitialLoadingScreen() {
  const [sceneIndex, setSceneIndex] = useState(-1); // -1 = chamada
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Chamada → Scene 0 at 3s
    timers.push(setTimeout(() => {
      setVisible(false);
      setTimeout(() => { setSceneIndex(0); setVisible(true); }, 700);
    }, 3000));

    // Scene 0 → Scene 1 at 6.5s
    timers.push(setTimeout(() => {
      setVisible(false);
      setTimeout(() => { setSceneIndex(1); setVisible(true); }, 700);
    }, 6500));

    // Scene 1 → Scene 2 at 10s
    timers.push(setTimeout(() => {
      setVisible(false);
      setTimeout(() => { setSceneIndex(2); setVisible(true); }, 700);
    }, 10000));

    return () => timers.forEach(clearTimeout);
  }, []);

  // Progress bar
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => (p >= 95 ? 95 : p + Math.random() * 3 + 0.5));
    }, 250);
    return () => clearInterval(interval);
  }, []);

  const isChamada = sceneIndex === -1;
  const scene = sceneIndex >= 0 ? SCENES[sceneIndex] : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden">
      {/* Background */}
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

        {/* Narrative — same sizing, poetic flow */}
        <div className="h-36 flex items-center justify-center">
          <div
            className={`transition-all duration-700 ease-in-out ${
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            {isChamada ? (
              <>
                <h1
                  className="text-2xl md:text-4xl font-semibold leading-tight mb-3"
                  style={{
                    background: "linear-gradient(135deg, hsl(0 0% 100%) 0%, hsl(213 81% 74%) 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  Liberte seu time para o que importa.
                </h1>
                <p
                  className="text-lg md:text-xl font-light"
                  style={{
                    background: "linear-gradient(90deg, hsl(126 91% 65%) 0%, hsl(213 81% 74%) 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  Bem-vindo à era da inteligência.
                </p>
              </>
            ) : scene ? (
              <p
                className="text-2xl md:text-4xl leading-relaxed font-light"
                style={{
                  background: "linear-gradient(135deg, hsl(0 0% 100% / 0.85) 0%, hsl(213 81% 74%) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {scene.text}
                {scene.emphasis && (
                  <span
                    className="font-semibold"
                    style={{
                      background: "linear-gradient(90deg, hsl(213 81% 54%), hsl(126 91% 65%))",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    {" "}{scene.emphasis}
                  </span>
                )}
              </p>
            ) : null}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-12 w-64">
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

        {/* Logo signature */}
        <div className="mt-14 opacity-40">
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
