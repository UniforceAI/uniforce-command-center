export interface Chamado {
  "_id"?: string; // ID único do banco de dados
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
  "Dias ultimo chamado": number;
  "Tempo de Atendimento": string | number;
  "Classificação": "Rápido" | "Normal" | "Lento" | "Reincidente";
  "Insight": string;
  "Chamados Anteriores": string;
  "_chamadosAnteriores"?: Chamado[]; // Lista real de chamados anteriores deste cliente
}

export interface DashboardData {
  data: Chamado[];
}
