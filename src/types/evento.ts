// Tipos para a tabela eventos - baseado na estrutura real do Supabase externo
export interface Evento {
  // Identificadores
  id: string;
  isp_id: string;
  instancia_isp: string;
  event_id: number;
  event_type: string;
  event_datetime: string;
  
  // Cliente
  cliente_id: number;
  cliente_nome: string;
  cliente_tipo_pessoa: string;
  cliente_documento: string;
  cliente_email: string;
  cliente_celular: string;
  cliente_cidade: string;
  cliente_uf: string;
  cliente_segmento: string;
  cliente_data_cadastro: string;
  cliente_bairro?: string;
  cliente_cep?: string;
  genero?: string;
  documento?: string;
  
  // Serviço/Plano
  servico_id?: number;
  tipo_servico?: string;
  plano_nome: string;
  plano_id?: number;
  velocidade_down_mbps?: number;
  velocidade_up_mbps?: number;
  down_mbps_contratado?: number;
  up_mbps_contratado?: number;
  valor_mensalidade: number;
  dia_vencimento: number;
  servico_status_codigo: number;
  servico_status: string;
  data_instalacao: string;
  tipo_conexao?: string;
  fidelidade?: string;
  
  // Contrato
  id_contrato?: number;
  status_contrato?: string;
  status_internet?: string;
  status_velocidade?: string;
  contrato_suspenso?: string;
  
  // Cobrança
  cobranca_id?: number;
  cobranca_status_codigo?: number;
  cobranca_status: string;
  data_gerado?: string;
  data_vencimento?: string;
  data_pagamento?: string;
  valor_cobranca?: number;
  valor_pago?: number;
  metodo_cobranca?: string;
  dias_atraso: number;
  vencido: boolean;
  linha_digitavel?: string;
  pix_codigo?: string;
  pix_qrcode_img?: string;
  pix_imagem_src?: string;
  aguardando_confirmacao_pagamento?: string;
  id_carteira_cobranca?: number;
  titulo_protestado?: string;
  
  // Atendimento
  atendimento_id?: number;
  protocolo?: string;
  assunto?: string;
  categoria?: string;
  motivo_contato?: string;
  origem?: string;
  setor?: string;
  urgencia?: string;
  atendimento_status?: string;
  tempo_atendimento_min?: number;
  resolvido_primeiro_contato?: boolean;
  reincidente_30d?: boolean;
  ultimo_atendimento?: string;
  os_aberta?: string;
  
  // Métricas de Rede/Sinal
  rx_dbm?: number;
  tx_dbm?: number;
  snr_db?: number;
  latency_ms?: number;
  jitter_ms?: number;
  packet_loss_pct?: number;
  downtime_min_24h?: number;
  
  // OLT/ONU
  olt_id?: number;
  olt_slotno?: number;
  olt_ponno?: number;
  olt_ponid?: string;
  onu_numero?: number;
  onu_data_sinal?: string;
  onu_temperatura_c?: number;
  onu_voltagem_v?: number;
  
  // Sessão/Conexão
  acct_session_id?: string;
  ip?: string;
  groupname?: string;
  mtu?: number;
  tempo_conectado?: number;
  dias_conectado?: number;
  upload_atual?: number;
  download_atual?: number;
  auto_preencher_ipv6?: string;
  fixar_ipv6?: string;
  
  // NPS
  nps_score?: number;
  nps_comment?: string;
  
  // Risco/Scores
  churn_risk_score?: number;
  churn_risk_bucket?: string;
  inadimplencia_risk_score?: number;
  inadimplencia_bucket?: string;
  
  // Alertas e Ações
  alerta_tipo?: string;
  acao_recomendada_1?: string;
  acao_recomendada_2?: string;
  acao_recomendada_3?: string;
  
  // LTV
  ltv_meses_estimado?: number;
  ltv_reais_estimado?: number;
  
  // Geo
  geo_lat?: number;
  geo_lng?: number;
  
  // Outros
  filial_id?: number;
  id_conta?: number;
  desbloqueio_confianca?: string;
  desbloqueio_confianca_ativo?: string;
  liberacao_bloqueio_manual?: string;
  
  // Datas
  mes_referencia?: string;
  dia_referencia?: string;
  created_at: string;
  updated_at: string;
  
  [key: string]: any;
}

// Classificação de risco
export type NivelRisco = "Crítico" | "Alto" | "Médio" | "Baixo";

// Tipos de evento
export type TipoEvento = "COBRANCA" | "ATENDIMENTO" | "REDE" | "NPS" | "CHURN" | "INSTALACAO" | "CANCELAMENTO";

// Status de cobrança
export type StatusCobranca = "A Vencer" | "Vencido" | "Pago" | "Cancelado";

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

// Faixas de risco de churn
export const FAIXAS_CHURN_RISK = [
  { min: 0, max: 25, label: "Baixo", color: "#22c55e" },
  { min: 26, max: 50, label: "Médio", color: "#eab308" },
  { min: 51, max: 75, label: "Alto", color: "#f97316" },
  { min: 76, max: 100, label: "Crítico", color: "#ef4444" },
];
