// Tipos para a tabela eventos (estrutura genérica, será ajustada após ver os dados reais)
export interface Evento {
  id: string;
  isp_id: string;
  cliente_id: number | string;
  cliente_nome?: string;
  tipo_evento?: string;
  categoria?: string;
  subcategoria?: string;
  data_evento?: string;
  valor?: number;
  status?: string;
  motivo?: string;
  descricao?: string;
  cidade?: string;
  uf?: string;
  plano?: string;
  metodo_pagamento?: string;
  dias_atraso?: number;
  score_risco?: number;
  [key: string]: any; // Permitir campos extras
}

// Classificação de risco
export type NivelRisco = "Crítico" | "Alto" | "Médio" | "Baixo";

// Drivers de churn
export type DriverChurn = "Financeiro" | "Rede/Instabilidade" | "Reincidência" | "NPS Detrator" | "Outro";

// Status de cobrança
export type StatusCobranca = "Em aberto" | "Vencido" | "Recuperado" | "Em negociação";

// Período de filtro
export type PeriodoFiltro = "7" | "30" | "90" | "365" | "todos";

// KPIs genéricos
export interface KPIData {
  valor: number | string;
  disponivel: boolean;
  tooltip?: string;
}

// Faixas de aging
export const FAIXAS_AGING = [
  { min: 1, max: 7, label: "1-7 dias" },
  { min: 8, max: 15, label: "8-15 dias" },
  { min: 16, max: 30, label: "16-30 dias" },
  { min: 31, max: 60, label: "31-60 dias" },
  { min: 61, max: Infinity, label: "60+ dias" },
];
