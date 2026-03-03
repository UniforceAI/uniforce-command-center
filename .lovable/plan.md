

## Diagnóstico

A raiz do problema é simples: a correção de `maxDate` para usar `new Date()` foi aplicada **apenas** em `Cancelamentos.tsx`. A página `VisaoGeral.tsx` (linha 245-247) ainda usa `getMaxCancelDate()`, que calcula a data de referência com base no registro mais recente do dataset.

Como todos os tenants (igp-fibra, zen-telecom, d-kiros) compartilham o mesmo código, a discrepância não é "por tenant" — é "por página". Cancelamentos agora usa `new Date()`, Visão Geral usa `getMaxCancelDate()`. Por isso os números divergem.

## Plano de correção

### 1. Unificar VisaoGeral.tsx para usar `new Date()`

**Arquivo:** `src/pages/VisaoGeral.tsx`

- Linha 245-247: substituir `getMaxCancelDate(filteredEventos, churnStatus)` por `new Date()`.
- Remover import de `getMaxCancelDate` (linha 13), já que não será mais usado nesta página.
- Ajustar `dataLimiteChurn` (linha 249-252) — já deriva de `maxCancelamentoDate`, então funcionará automaticamente após a troca.

### 2. Limpar export morto de `getMaxCancelDate`

**Arquivo:** `src/lib/churnUnified.ts`

- Após a remoção do uso em ambas as páginas, a função `getMaxCancelDate` fica sem consumidores. Removê-la (ou mantê-la comentada para referência futura).

**Arquivo:** `src/pages/Cancelamentos.tsx`

- Remover `getMaxCancelDate` do import (linha 6), já que não é mais usado após a correção anterior.

### 3. Resultado esperado

- Ambas as páginas (Visão Geral e Cancelamentos) usam `new Date()` como referência temporal.
- Todos os tenants (igp-fibra, zen-telecom, d-kiros) exibem números consistentes entre si e entre páginas.
- Filtros 7d/30d/90d significam literalmente "últimos N dias a partir de hoje".

