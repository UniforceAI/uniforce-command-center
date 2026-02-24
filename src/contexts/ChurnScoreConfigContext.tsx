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
  // Financeiro — faixas por dias em atraso
  finAtraso1a5: number;           // padrão: 5
  finAtraso6a15: number;          // padrão: 10
  finAtraso16a30: number;         // padrão: 15
  finAtraso31a60: number;         // padrão: 20
  finAtraso60plus: number;        // padrão: 25
  financeiroTeto: number;         // padrão: 30
}

export const CHURN_SCORE_DEFAULTS: ChurnScoreConfig = {
  chamados30dBase: 25,
  chamadoAdicional: 5,
  npsDetrator: 30,
  qualidade: 20,
  comportamental: 20,
  finAtraso1a5: 5,
  finAtraso6a15: 10,
  finAtraso16a30: 15,
  finAtraso31a60: 20,
  finAtraso60plus: 25,
  financeiroTeto: 30,
};

interface ChurnScoreConfigContextType {
  config: ChurnScoreConfig;
  setConfig: (cfg: ChurnScoreConfig) => void;
  resetToDefaults: () => void;
}

const STORAGE_KEY = "churn_score_config_v2";

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
 * Calcula o score financeiro baseado nos dias em atraso e nas faixas configuráveis.
 */
export function calcScoreFinanceiroConfiguravel(
  diasAtraso: number | null,
  config: ChurnScoreConfig
): number {
  const dias = diasAtraso ?? 0;
  if (dias <= 0) return 0;

  let score = 0;
  if (dias >= 1) score = config.finAtraso1a5;
  if (dias >= 6) score = config.finAtraso6a15;
  if (dias >= 16) score = config.finAtraso16a30;
  if (dias >= 31) score = config.finAtraso31a60;
  if (dias > 60) score = config.finAtraso60plus;

  return Math.min(score, config.financeiroTeto);
}

/**
 * Calcula o score de suporte baseado nos chamados reais e nas configurações do usuário.
 */
export function calcScoreSuporteConfiguravel(
  ch30: number,
  ch90: number,
  config: ChurnScoreConfig
): number {
  const { chamados30dBase, chamadoAdicional } = config;
  const cap = chamados30dBase + 4 * chamadoAdicional;
  let score = 0;

  if (ch30 >= 2) {
    score = chamados30dBase + (ch30 - 2) * chamadoAdicional;
  } else if (ch30 === 1) {
    const base30 = Math.round(chamados30dBase * 0.32);
    const extra90 = ch90 > 1 ? (ch90 - 1) * Math.round(chamadoAdicional * 0.6) : 0;
    score = base30 + extra90;
  } else if (ch90 >= 5) {
    score = Math.round(chamados30dBase * 0.5) + (ch90 - 5) * Math.round(chamadoAdicional * 0.7);
  } else if (ch90 >= 3) {
    score = Math.round(chamados30dBase * 0.4) + (ch90 - 3) * Math.round(chamadoAdicional * 0.5);
  } else if (ch90 >= 1) {
    score = Math.round(chamados30dBase * 0.2);
  }

  return Math.min(score, cap);
}
