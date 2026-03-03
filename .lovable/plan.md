

# Correcao Definitiva: Cancelamentos igp-fibra

## Causa Raiz Identificada (3 camadas)

### Camada 1: Subtitulo mostra contagem errada

Na linha 599 de `Cancelamentos.tsx`, o subtitulo da pagina mostra `cancelados.length` (TODOS os cancelados, sem filtro de periodo = 562). O correto e mostrar `filtered.length` (cancelados filtrados pelo periodo selecionado).

```text
ERRADO (linha 599):
  {cancelados.length.toLocaleString()} cancelamentos
  → Sempre 562, ignora filtro de periodo

CORRETO:
  {filtered.length.toLocaleString()} cancelamentos
  → Respeita o periodo selecionado (ex: 154 nos ultimos 7 dias)
```

### Camada 2: Volume de dados cresceu (comportamento CORRETO)

O `MAX_BATCHES` foi aumentado de 10 para 50 no `useEventos.ts`, permitindo buscar ate 50.000 eventos em vez de 10.000. Para igp-fibra com 29.668 eventos, o limite antigo truncava silenciosamente os dados historicos. Agora todos os 639 eventos com `data_cancelamento` sao buscados, resultando em 562 clientes unicos cancelados no historico completo.

O numero 154 que aparecia antes era resultado de dados truncados em cache, NAO o numero real. 562 e o total correto para TODOS os periodos. Com filtro de 7 dias, o numero volta a ~154.

### Camada 3: Cache de producao desatualizado

O cache persistente (`localStorage`, TTL 24h) em producao precisa ser invalidado para que os navegadores busquem dados com a logica corrigida. O buster precisa ser incrementado para v2.

## Plano de Correcao

### 1. Corrigir subtitulo em `src/pages/Cancelamentos.tsx` (linha 599)

Trocar `cancelados.length` por `filtered.length` para que o subtitulo reflita o periodo selecionado.

### 2. Bump cache buster em `src/App.tsx` (linha 49)

Alterar buster de `"v1"` para `"v2"` para forcar invalidacao do cache em producao. Desta vez o buster e necessario porque:
- A logica do subtitulo esta sendo corrigida
- Producao precisa descartar dados stale

### 3. Remover logs de diagnostico

Remover os `console.log` de diagnostico adicionados em:
- `src/lib/churnUnified.ts` (6 logs)
- `src/pages/Cancelamentos.tsx` (2 logs)
- `src/pages/VisaoGeral.tsx` (1 log)

Estes logs poluem o console e nao sao necessarios em producao.

## Arquivos a Alterar

1. `src/pages/Cancelamentos.tsx` linha 599: `cancelados.length` → `filtered.length`
2. `src/App.tsx` linha 49: buster `"v1"` → `"v2"`
3. `src/lib/churnUnified.ts`: remover 6 console.logs de diagnostico
4. `src/pages/Cancelamentos.tsx`: remover 2 console.logs de diagnostico
5. `src/pages/VisaoGeral.tsx`: remover 1 console.log de diagnostico

## Resultado Esperado

- Subtitulo mostra contagem filtrada por periodo (ex: ~154 para 7 dias)
- KPI "Total Cancelados" ja estava correto (usa `filtered.length`)
- Producao invalida cache e busca dados frescos
- Todos os tenants funcionam normalmente (d-kiros, zen-telecom, igp-fibra)
- Console limpo sem logs de debug

## Por que funciona para d-kiros e zen-telecom?

Esses tenants tem menos de 10.000 eventos, entao o aumento do MAX_BATCHES nao alterou o volume de dados buscados. Para igp-fibra, com 29.668 eventos, o aumento revelou cancelamentos historicos que antes eram truncados.

