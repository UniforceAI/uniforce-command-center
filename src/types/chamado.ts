export interface Chamado {
  "_id"?: string; // ID único do banco de dados
  "ID Cliente": string | number; // TEXT no banco
  "Qtd. Chamados": number | null;
  "Protocolo": string | null;
  "Data de Abertura": string | null;
  "Última Atualização": string | null;
  "Responsável": string | null;
  "Setor": string | null;
  "Categoria": string | null;
  "Motivo do Contato": string | null;
  "Origem": string | null;
  "Solicitante": string | null;
  "Urgência": string | null;
  "Status": string | null;
  "Dias ultimo chamado": number | null;
  "Tempo de Atendimento": string | number | null;
  "Classificação": string | null;
  "Insight": string | null;
  "Chamados Anteriores": string | null;
  "_chamadosAnteriores"?: Chamado[]; // Lista real de chamados anteriores deste cliente
  // Campos adicionais do schema
  "isp_id"?: string | null;
  "instancia_isp"?: string | null;
}

export interface DashboardData {
  data: Chamado[];
}
