

# Corrigir Cache Stale em Produção

## Causa Raiz

O sistema usa `PersistQueryClientProvider` com cache de 24 horas no `localStorage`. Quando o deploy em produção atualiza o codigo, o cache antigo persiste no navegador do usuario e os dados pre-computados com a logica inflada continuam sendo exibidos. O parametro `buster: "v1"` nao foi alterado apos a correcao, entao o React Query restaura dados stale sem re-fetch.

## Solucao

### 1. Bumpar o cache buster (`src/App.tsx`, linha 49)

Alterar o `buster` de `"v1"` para `"v2"`. Isso forca todos os navegadores a invalidar o cache persistente no proximo carregamento, garantindo que os dados sejam buscados novamente com o codigo corrigido.

```text
ANTES: buster: "v1"
DEPOIS: buster: "v2"
```

### 2. Re-publicar (deploy)

Apos a alteracao, publicar novamente para que todos os usuarios de producao recebam o novo buster e refacam os fetches com a logica corrigida.

## Resultado Esperado

- Todos os navegadores em producao descartam o cache antigo automaticamente
- Os dados sao re-fetched com a logica all-or-nothing corrigida
- igp-fibra passa a mostrar 154 cancelados (consistente com o ambiente de desenvolvimento)
- Nenhuma regressao para zen-telecom e d-kiros (dados tambem serao re-fetched)

## Arquivo Alterado

- `src/App.tsx` (linha 49): bump buster de "v1" para "v2"

