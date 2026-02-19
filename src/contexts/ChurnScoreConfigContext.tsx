import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface ChurnScoreConfig {
  // Chamados 30 dias: pontos para 2+ chamados
  chamados30dBase: number;        // padrão: 25 (2 chamados = 25pts)
  chamadoAdicional: number;       // padrão: 5 (por chamado acima de 2: 3°=5, 4°=10...)
  // NPS Detrator
  npsDetrator: number;            // padrão: 30
  // Qualidade
  qualidade: number;              // padrão: 20
  // Comportamental
  comportamental: number;         // padrão: 20
}

export const CHURN_SCORE_DEFAULTS: ChurnScoreConfig = {
  chamados30dBase: 25,
  chamadoAdicional: 5,
  npsDetrator: 30,
  qualidade: 20,
  comportamental: 20,
};

interface ChurnScoreConfigContextType {
  config: ChurnScoreConfig;
  setConfig: (cfg: ChurnScoreConfig) => void;
  resetToDefaults: () => void;
}

const STORAGE_KEY = "churn_score_config_v1";

const ChurnScoreConfigContext = createContext<ChurnScoreConfigContextType>({
  config: CHURN_SCORE_DEFAULTS,
  setConfig: () => {},
  resetToDefaults: () => {},
});

export function ChurnScoreConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<ChurnScoreConfig>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return { ...CHURN_SCORE_DEFAULTS, ...JSON.parse(raw) };
      }
    } catch {}
    return CHURN_SCORE_DEFAULTS;
  });

  const setConfig = (cfg: ChurnScoreConfig) => {
    setConfigState(cfg);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  };

  const resetToDefaults = () => {
    setConfigState(CHURN_SCORE_DEFAULTS);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <ChurnScoreConfigContext.Provider value={{ config, setConfig, resetToDefaults }}>
      {children}
    </ChurnScoreConfigContext.Provider>
  );
}

export function useChurnScoreConfig() {
  return useContext(ChurnScoreConfigContext);
}

/**
 * Calcula o score de suporte baseado nos chamados reais e nas configurações do usuário.
 * 2 chamados = chamados30dBase pts
 * Cada chamado acima de 2 = chamadoAdicional pts extras
 * 1 chamado 30d = 8pts (fixo, menor que o threshold de 2)
 * Chamados 90d = fallback menor
 */
export function calcScoreSuporteConfiguravel(
  ch30: number,
  ch90: number,
  config: ChurnScoreConfig
): number {
  const { chamados30dBase, chamadoAdicional } = config;
  let score = 0;
  if (ch30 >= 2) {
    score = chamados30dBase + (ch30 - 2) * chamadoAdicional;
  } else if (ch30 === 1) {
    score = Math.round(chamados30dBase * 0.32); // ~8 quando base=25
  } else if (ch90 >= 3) {
    score = Math.round(chamados30dBase * 0.4);
  } else if (ch90 >= 1) {
    score = Math.round(chamados30dBase * 0.2);
  }
  return Math.min(score, chamados30dBase + 4 * chamadoAdicional); // cap em base + 4 adicionais
}
