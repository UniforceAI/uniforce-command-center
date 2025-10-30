export interface Chamado {
  "ID Cliente": number;
  "Qtd. Chamados": number;
  "Protocolo": string;
  "Data de Abertura": string;
  "Última Atualização": string;
  "Responsável": string;
  "Setor": string;
  "Categoria": string;
  "Motivo do Contato": string;
  "Origem": string;
  "Solicitante": string;
  "Urgência": "Alta" | "Média" | "Baixa";
  "Status": "Novo" | "Em Andamento" | "Resolvido" | "Fechado";
  "Dias desde Último Chamado": number;
  "Tempo de Atendimento": string;
  "Classificação": "Rápido" | "Normal" | "Lento" | "Reincidente";
  "Insight": string;
  "Chamados Anteriores": string;
}

export interface DashboardData {
  data: Chamado[];
}
