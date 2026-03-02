

# Unificar Calculo de Inadimplencia em Todo o Produto

## Problema

A taxa de inadimplencia aparece diferente entre Visao Geral e Financeiro porque usam logicas de calculo distintas, apesar de ambas respeitarem o filtro de periodo.

**Visao Geral** (correto):
1. Filtra eventos pelo periodo selecionado
2. Filtra apenas eventos financeiros (COBRANCA ou SNAPSHOT financeiro)
3. Deduplica por cliente_id (mantém evento mais recente por cliente)
4. Conta quantos desses clientes tem dias_atraso > 0
5. Taxa = vencidos / total_clientes_financeiros

**Financeiro** (incorreto):
1. Filtra eventos pelo periodo selecionado
2. Conta clientesUnicos de TODOS os eventos filtrados (inclusive nao-financeiros)
3. Conta vencidos (dias_atraso > 0) sem deduplicar por cliente
4. Taxa = clientes_vencidos / clientesUnicos (denominador inflado)

O denominador do Financeiro inclui clientes que so aparecem em eventos nao-financeiros, inflando a base e reduzindo a taxa artificialmente.

## Solucao

Aplicar no Financeiro a mesma logica da Visao Geral:

```text
// Dentro do useMemo de kpis em Financeiro.tsx (linhas 168-210)
// ANTES: usa filteredEventos generico e Set simples
// DEPOIS: deduplica por cliente_id, pega evento mais recente

const clientesFinMap = new Map();
filteredEventos.forEach(e => {
  if (!clientesFinMap.has(e.cliente_id) ||
    new Date(e.event_datetime) > new Date(clientesFinMap.get(e.cliente_id).event_datetime)) {
    clientesFinMap.set(e.cliente_id, e);
  }
});
const clientesFinUnicos = Array.from(clientesFinMap.values());
const totalClientesFin = clientesFinMap.size;
const vencidosFin = clientesFinUnicos.filter(e => e.dias_atraso > 0);
const clientesVencidos = vencidosFin.length;
const taxaInadimplencia = totalClientesFin > 0
  ? ((clientesVencidos / totalClientesFin) * 100).toFixed(1)
  : "0";
```

Isso garante:
- O filtro de periodo continua sendo respeitado (igual a todas as outras metricas)
- A deduplicacao por cliente e identica a da Visao Geral
- O denominador usa apenas clientes financeiros (nao infla com outros tipos de evento)

## Arquivo a editar

**src/pages/Financeiro.tsx** - Substituir o bloco de calculo de KPIs (linhas 168-210) para usar deduplicacao por cliente_id identica a da Visao Geral, mantendo `filteredEventos` como base (respeita periodo e demais filtros).

## Verificacao

Apos a mudanca, ambas as paginas com o mesmo filtro de periodo devem exibir a mesma taxa de inadimplencia, pois usarao:
- Mesma base: eventos financeiros filtrados pelo periodo
- Mesma deduplicacao: Map por cliente_id, evento mais recente
- Mesmo criterio: dias_atraso > 0

