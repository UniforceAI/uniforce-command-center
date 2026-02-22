import { useState, useEffect } from "react";
import uniconIcon from "@/assets/uniforce-icon.png";

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

export function LoadingScreen() {
  const [sceneIndex, setSceneIndex] = useState(-1); // -1 = chamada
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Start with chamada, then rotate through scenes
    const timers: ReturnType<typeof setTimeout>[] = [];

    // After 3s, fade to scene 0
    timers.push(
      setTimeout(() => {
        setVisible(false);
        setTimeout(() => { setSceneIndex(0); setVisible(true); }, 600);
      }, 3000)
    );

    // Scene 1 at 6.5s
    timers.push(
      setTimeout(() => {
        setVisible(false);
        setTimeout(() => { setSceneIndex(1); setVisible(true); }, 600);
      }, 6500)
    );

    // Scene 2 at 10s
    timers.push(
      setTimeout(() => {
        setVisible(false);
        setTimeout(() => { setSceneIndex(2); setVisible(true); }, 600);
      }, 10000)
    );

    // Loop back to chamada at 13.5s
    timers.push(
      setTimeout(() => {
        setVisible(false);
        setTimeout(() => { setSceneIndex(-1); setVisible(true); }, 600);
      }, 13500)
    );

    // Restart cycle
    const cycle = setInterval(() => {
      let step = 0;
      const inner: ReturnType<typeof setTimeout>[] = [];

      inner.push(setTimeout(() => {
        setVisible(false);
        setTimeout(() => { setSceneIndex(0); setVisible(true); }, 600);
      }, 3000));

      inner.push(setTimeout(() => {
        setVisible(false);
        setTimeout(() => { setSceneIndex(1); setVisible(true); }, 600);
      }, 6500));

      inner.push(setTimeout(() => {
        setVisible(false);
        setTimeout(() => { setSceneIndex(2); setVisible(true); }, 600);
      }, 10000));

      inner.push(setTimeout(() => {
        setVisible(false);
        setTimeout(() => { setSceneIndex(-1); setVisible(true); }, 600);
      }, 13500));
    }, 17000);

    return () => {
      timers.forEach(clearTimeout);
      clearInterval(cycle);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => (p >= 95 ? 95 : p + Math.random() * 3 + 0.5));
    }, 300);
    return () => clearInterval(interval);
  }, []);

  const isChamada = sceneIndex === -1;
  const scene = sceneIndex >= 0 ? SCENES[sceneIndex] : null;

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center px-6 py-12">
      {/* Icon with gradient glow */}
      <div className="relative mb-10">
        <div
          className="absolute inset-0 rounded-full blur-xl opacity-30"
          style={{
            background: "linear-gradient(135deg, hsl(213 81% 54%), hsl(126 91% 65%))",
            transform: "scale(3)",
            animation: "pulse-loading 2.5s ease-in-out infinite",
          }}
        />
        <img
          src={uniconIcon}
          alt="Uniforce"
          className="h-14 w-14 relative z-10 animate-scale-in"
          style={{ filter: "drop-shadow(0 0 20px hsl(213 81% 54% / 0.4))" }}
        />
      </div>

      {/* Narrative content area — fixed height to prevent layout shift */}
      <div className="h-28 flex items-center justify-center mb-6">
        <div
          className={`text-center max-w-lg transition-all duration-500 ease-in-out ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
          }`}
        >
          {isChamada ? (
            <>
              <h2
                className="text-xl md:text-2xl font-semibold mb-2"
                style={{
                  background: "linear-gradient(135deg, hsl(var(--foreground)) 0%, hsl(213 81% 54%) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Liberte seu time para o que importa.
              </h2>
              <p className="text-sm text-muted-foreground">
                Bem-vindo à era da inteligência.
              </p>
            </>
          ) : scene ? (
            <p
              className="text-lg md:text-xl leading-relaxed font-light"
              style={{
                background: "linear-gradient(135deg, hsl(var(--foreground) / 0.85) 0%, hsl(213 81% 54%) 100%)",
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
      <div className="w-56 mb-4">
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

      <style>{`
        @keyframes pulse-loading {
          0%, 100% { opacity: 0.2; transform: scale(3); }
          50% { opacity: 0.4; transform: scale(3.5); }
        }
      `}</style>
    </div>
  );
}
