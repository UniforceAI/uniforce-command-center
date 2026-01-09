export type TipoNPS = "atendimento" | "contrato" | "os";
export type ClassificacaoNPS = "Detrator" | "Neutro" | "Promotor";

export interface RespostaNPS {
  cliente_id: number;
  cliente_nome: string;
  tipo_nps: TipoNPS;
  nota: number;
  classificacao: ClassificacaoNPS;
  comentario: string;
  data_resposta: string;
  // Campos gerados automaticamente pelo frontend
  insight?: string;
  acao_sugerida?: string;
}

export interface NPSStats {
  npsGeral: number;
  npsInstalacao: number;
  npsOS: number;
  npsAtendimento: number;
  totalRespostas: number;
  promotores: number;
  neutros: number;
  detratores: number;
}
