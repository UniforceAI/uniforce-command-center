
# Unificacao Definitiva do Churn — Corrigir igp-fibra e zen-telecom

## Causa Raiz Identificada

As duas paginas usam logicas estruturalmente diferentes para contar cancelados:

- **Visao Geral** (funciona corretamente): usa abordagem "tudo-ou-nada"
  - Se `eventos` tem registros com `data_cancelamento` -> usa SOMENTE eventos
  - Se eventos retorna zero cancelados -> usa SOMENTE `churn_status`
  - Resultado: contagem limpa, sem duplicacao entre fontes

- **Cancelamentos** (via `buildUnifiedCancelados`): usa merge per-client
  - Para CADA cliente: se eventos tem `data_cancelamento`, usa; senao, fallback para `churn_status`
  - Resultado: soma cancelados de AMBAS as fontes, inflando o numero

Para d-kiros funciona porque os dados de cancelamento estao concentrados em uma fonte so. Para igp-fibra e zen-telecom, existem cancelados em AMBAS as tabelas, e o merge per-client adiciona registros extras que a Visao Geral nao conta.

## Solucao

Alterar `buildUnifiedCancelados` em `src/lib/churnUnified.ts` para replicar exatamente a logica all-or-nothing da Visao Geral:

1. Verificar se `eventos` tem QUALQUER registro com `data_cancelamento`
2. Se sim: usar SOMENTE eventos como fonte de cancelados (deduplicado por `cliente_id`), enriquecer com scores/motivos do `churn_status`
3. Se nao: usar SOMENTE `churn_status` com `status_churn === "cancelado"`

Isso garante que ambas as paginas produzam exatamente os mesmos numeros para qualquer tenant.

## Arquivos a Alterar

### 1. `src/lib/churnUnified.ts`
- Reescrever `buildUnifiedCancelados` com logica all-or-nothing
- Manter enrichment de scores/motivos via `churn_status` (nao afeta contagem)

### 2. `src/pages/Cancelamentos.tsx` (linha ~289)
- No grafico "Churn por Dimensao" (linha 289), atualmente usa `churnStatus` diretamente em vez do dataset unificado — trocar para usar `cancelados` (que vem do agregador unificado), garantindo consistencia tambem nos graficos

## Resultado Esperado
- Taxa de churn identica entre Visao Geral e Cancelamentos para todos os tenants
- d-kiros continua funcionando (sem regressao)
- igp-fibra e zen-telecom passam a mostrar os mesmos numeros da Visao Geral
- Nenhuma mudanca visual — apenas correcao numerica

## Detalhes Tecnicos

```text
ANTES (buildUnifiedCancelados):
  eventos com data_cancelamento  ---> adiciona ao mapa
  churn_status cancelados        ---> adiciona ao mapa (PER CLIENT fallback)
  = soma das duas fontes = INFLADO

DEPOIS (logica all-or-nothing):
  eventos tem data_cancelamento? 
    SIM -> usa SO eventos (dedup por cliente_id) + enrich com churn_status
    NAO -> usa SO churn_status cancelados
  = mesma contagem da Visao Geral = CORRETO
```
