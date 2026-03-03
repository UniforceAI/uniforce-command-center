
# Reverter Buster e Diagnosticar Discrepancia

## Situacao Atual

O codigo em `churnUnified.ts` ja implementa a logica all-or-nothing corretamente (verificado no codigo atual, linhas 81-114). A mudanca do buster de "v1" para "v2" forcou a invalidacao do cache no ambiente de desenvolvimento, causando um re-fetch dos dados. Se os numeros mudaram apos o re-fetch, isso indica que os **dados no banco externo mudaram** desde a ultima vez que foram cacheados, ou existe uma diferenca sutil entre como Visao Geral e Cancelamentos processam os mesmos dados.

## Plano de Acao

### 1. Reverter buster para "v1" (`src/App.tsx`, linha 49)

Restaurar o buster para "v1" para que o ambiente de desenvolvimento volte a usar o cache existente (se ainda nao foi limpo pelo navegador). Isso restaura o estado anterior imediatamente.

```text
ANTES: buster: "v2"
DEPOIS: buster: "v1"
```

### 2. Adicionar logs de diagnostico em `buildUnifiedCancelados` (`src/lib/churnUnified.ts`)

Inserir console.logs estrategicos para comparar exatamente o que cada fonte retorna:

```typescript
// Dentro de buildUnifiedCancelados, apos linha 84:
console.log(`[ChurnUnified] eventos total: ${eventos.length}`);
console.log(`[ChurnUnified] eventos com data_cancelamento: ${eventos.filter(e => !!e.data_cancelamento).length}`);
console.log(`[ChurnUnified] hasEventosCancelamento: ${hasEventosCancelamento}`);
console.log(`[ChurnUnified] churnStatus total: ${churnStatus.length}`);
console.log(`[ChurnUnified] churnStatus cancelados: ${churnStatus.filter(cs => cs.status_churn === "cancelado").length}`);
// Apos construir canceladosMap:
console.log(`[ChurnUnified] canceladosMap.size (resultado final): ${canceladosMap.size}`);
```

### 3. Adicionar log equivalente na Visao Geral (`src/pages/VisaoGeral.tsx`, linha ~300)

Inserir log apos a contagem de cancelados via eventos (linha 300) para comparar:

```typescript
console.log(`[VisaoGeral] canceladosViaEventos: ${canceladosViaEventos.size}, periodo: ${periodo}`);
```

### 4. Comparar os logs entre as duas paginas

Com os logs, ao navegar entre Visao Geral e Cancelamentos para igp-fibra, sera possivel ver:
- Se ambas as paginas recebem o mesmo volume de eventos
- Quantos eventos tem `data_cancelamento`
- Se o branch all-or-nothing esta sendo acionado corretamente
- Onde exatamente a divergencia ocorre

## Diferenca Sutil Identificada (Possivel Causa)

Existe uma diferenca importante entre as duas paginas que pode causar a discrepancia:

- **Visao Geral** (linha 270): dedup por `cliente_id` usando `filteredEventos` (ja filtrado por cidade/bairro/plano)
- **Cancelamentos** (linha 80): `buildUnifiedCancelados(eventos, churnStatus)` recebe `eventos` **sem filtro** de dimensao — o filtro e aplicado depois (linha 133)

Isso significa que `buildUnifiedCancelados` conta cancelados de TODOS os eventos antes de filtrar por periodo/dimensao, enquanto Visao Geral filtra primeiro e depois conta. Dependendo da distribuicao dos dados do igp-fibra, isso pode gerar numeros diferentes.

Se confirmado, a correcao sera passar `filteredEventos` em vez de `eventos` para `buildUnifiedCancelados`, ou aplicar os filtros de dimensao dentro do agregador.

## Arquivos a Alterar

1. `src/App.tsx` (linha 49): reverter buster de "v2" para "v1"
2. `src/lib/churnUnified.ts`: adicionar logs de diagnostico
3. `src/pages/VisaoGeral.tsx` (~linha 300): adicionar log comparativo
4. `src/pages/Cancelamentos.tsx` (~linha 80): adicionar log do resultado do agregador
