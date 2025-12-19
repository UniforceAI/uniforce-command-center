import { RespostaNPS, TipoNPS, ClassificacaoNPS } from "@/types/nps";

const nomes = [
  "LUCIANA LIMA", "FERNANDA RIBEIRO", "MARIA OLIVEIRA", "PATRICIA ARAUJO",
  "ANA PEREIRA", "FRANCISCO ALMEIDA", "CARLOS ROCHA", "LUIZ EDUARDO",
  "ELIANE SOUZA", "JOAO BATISTA", "PAULO HENRIQUE", "DANIEL FREITAS",
  "RENATA GOMES", "ANTONIO COSTA", "MARCOS SILVA", "JULIANA SANTOS",
  "ROBERTO FERREIRA", "CAMILA RODRIGUES", "ANDERSON MARTINS", "PRISCILA COSTA"
];

const comentariosDetrator = [
  "Problema não resolvido",
  "Demora excessiva no processo",
  "Atendimento confuso",
  "Serviço abaixo do esperado",
  "Técnico não explicou corretamente",
  "Falta de comunicação",
  "Reagendamento sem aviso"
];

const comentariosNeutro = [
  "Experiência ok",
  "Atendeu parcialmente",
  "Poderia melhorar",
  "Serviço básico",
  "Tempo de espera razoável"
];

const comentariosPromotor = [
  "Muito satisfeito com o serviço",
  "Tudo funcionou perfeitamente",
  "Equipe atenciosa",
  "Recomendo o serviço",
  "Excelente atendimento",
  "Problema resolvido rapidamente"
];

function getClassificacao(nota: number): ClassificacaoNPS {
  if (nota <= 6) return "Detrator";
  if (nota <= 8) return "Neutro";
  return "Promotor";
}

function getComentario(classificacao: ClassificacaoNPS): string {
  const lista = classificacao === "Detrator" 
    ? comentariosDetrator 
    : classificacao === "Neutro" 
      ? comentariosNeutro 
      : comentariosPromotor;
  return lista[Math.floor(Math.random() * lista.length)];
}

function generateNota(tipo: TipoNPS): number {
  // Pós-atendimento tem melhor avaliação
  if (tipo === "pos_atendimento") {
    return Math.random() > 0.3 ? Math.floor(Math.random() * 4) + 7 : Math.floor(Math.random() * 7);
  }
  // Pós-instalação e pós-OS têm mais detratores
  return Math.random() > 0.5 ? Math.floor(Math.random() * 4) + 7 : Math.floor(Math.random() * 7);
}

function generateDate(): string {
  const today = new Date();
  const daysAgo = Math.floor(Math.random() * 30);
  const date = new Date(today);
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
}

export function generateMockNPSData(count: number = 200): RespostaNPS[] {
  const tipos: TipoNPS[] = ["pos_instalacao", "pos_os", "pos_atendimento"];
  const data: RespostaNPS[] = [];

  for (let i = 0; i < count; i++) {
    const tipo = tipos[Math.floor(Math.random() * tipos.length)];
    const nota = generateNota(tipo);
    const classificacao = getClassificacao(nota);
    
    data.push({
      cliente_id: 300000 + i,
      cliente_nome: nomes[Math.floor(Math.random() * nomes.length)],
      tipo_nps: tipo,
      nota,
      classificacao,
      comentario: getComentario(classificacao),
      data_resposta: generateDate(),
    });
  }

  return data.sort((a, b) => 
    new Date(b.data_resposta).getTime() - new Date(a.data_resposta).getTime()
  );
}

// Gerar insight automático baseado nos dados
export function generateInsight(resposta: RespostaNPS): string {
  if (resposta.classificacao === "Detrator") {
    if (resposta.tipo_nps === "pos_instalacao") {
      return "Cliente detrator após instalação - verificar processo";
    }
    if (resposta.tipo_nps === "pos_os") {
      return "Possível falha no processo de O.S - acompanhar";
    }
    return "Alta chance de reincidência de chamados";
  }
  if (resposta.classificacao === "Promotor") {
    return "Cliente promotor – oportunidade de indicação";
  }
  return "Cliente neutro - oportunidade de melhoria";
}

// Gerar ação sugerida
export function generateAcaoSugerida(resposta: RespostaNPS): string {
  if (resposta.classificacao === "Detrator") {
    if (resposta.nota <= 3) {
      return "Contato urgente - risco de churn";
    }
    return "Agendar ligação de follow-up";
  }
  if (resposta.classificacao === "Promotor") {
    return "Enviar programa de indicação";
  }
  return "Monitorar próximas interações";
}

export const mockNPSData = generateMockNPSData(200);
