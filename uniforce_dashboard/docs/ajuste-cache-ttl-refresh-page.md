 Plano de Ação

  Arquivos que serão alterados (nenhum mais)

  ┌─────┬──────────────────────────────────────┬───────────────────────────────────────────────────────┐
  │  #  │               Arquivo                │                      O que muda                       │
  ├─────┼──────────────────────────────────────┼───────────────────────────────────────────────────────┤
  │ 1   │ src/lib/refreshDetector.ts           │ NOVO — detecta se é reload de browser                 │
  ├─────┼──────────────────────────────────────┼───────────────────────────────────────────────────────┤
  │ 2   │ src/components/CacheRefreshGuard.tsx │ NOVO — invalida cache do tenant no reload             │
  ├─────┼──────────────────────────────────────┼───────────────────────────────────────────────────────┤
  │ 3   │ src/App.tsx                          │ Adiciona <CacheRefreshGuard> dentro de <AuthProvider> │
  ├─────┼──────────────────────────────────────┼───────────────────────────────────────────────────────┤
  │ 4   │ src/hooks/useChurnData.ts            │ Adiciona refetchOnMount: true em 2 queries            │
  ├─────┼──────────────────────────────────────┼───────────────────────────────────────────────────────┤
  │ 5   │ src/hooks/useChamados.ts             │ Adiciona refetchOnMount: true                         │
  ├─────┼──────────────────────────────────────┼───────────────────────────────────────────────────────┤
  │ 6   │ src/hooks/useEventos.ts              │ Adiciona refetchOnMount: true                         │
  ├─────┼──────────────────────────────────────┼───────────────────────────────────────────────────────┤
  │ 7   │ src/hooks/useNPSData.ts              │ Adiciona refetchOnMount: true                         │
  ├─────┼──────────────────────────────────────┼───────────────────────────────────────────────────────┤
  │ 8   │ src/hooks/useRiskBucketConfig.ts     │ Adiciona refetchOnMount: true                         │
  └─────┴──────────────────────────────────────┴───────────────────────────────────────────────────────┘

  Não altera: lógica de negócio, banco, n8n, autenticação, Supabase, Lovable design.

  ---
  Como funciona após a correção

  No reload (F5 / Ctrl+F5):
  F5 detectado pelo refreshDetector
      → CacheRefreshGuard marca queries do ISP logado como "stale"
      → queries ativas (página atual): refetch imediato em background
      → usuário vê dados do cache enquanto carrega (sem tela em branco)
      → dados novos do banco substituem ao chegar
      → ao navegar para outra página: refetchOnMount: true vê dado "stale" → busca do banco

  Na navegação normal (cliques no menu, sem F5):
  Dados ainda dentro do staleTime (24h) → considerados "frescos"
      → refetchOnMount: true NÃO refetcha dados frescos
      → comportamento idêntico ao atual (rápido, sem loading desnecessário)

  Resultado prático:
  - F5 → sempre dados atualizados do banco para aquele ISP ✅
  - Navegação normal → cache instantâneo como hoje ✅
  - Sem loading constante ✅
  - Zen-telecom e outros tenants isolados pelo isp_id ✅

  ---
  Garantia de Rollback

  O repositório está no GitHub (UniforceAI/uniforce-command-center) e o Lovable também commita nele. A estratégia de rollback é:

  Antes de aplicar qualquer mudança, vou:
  1. Verificar o commit atual (git rev-parse HEAD) — esse é o ponto de retorno
  2. Criar um branch separado (ex: fix/cache-refresh-on-reload) — nunca altero main diretamente
  3. Abrir um Pull Request — você revisa antes de fazer merge

  Se algo der errado após merge:
  git revert HEAD  # reverte o commit específico
  # ou
  git reset --hard <hash-do-commit-anterior>  # volta ao estado exato anterior

  Como o Lovable também trabalha no repo, usaremos branch + PR, então o main fica intocado até você aprovar o merge.



  #### PR #1 merged — commit 3a8bb55 em main às 15:49 UTC.

---

### Nota de compatibilidade SPA (2026-03-12, v1.4)

**IMPORTANTE**: `refreshDetector.ts` (`isPageReload()`) usa `performance.getEntriesByType("navigation")`.
Em SPA, este valor **nunca muda** após a carga inicial. Ou seja:
- Usar para detectar reload no **mount inicial** (como faz `CacheRefreshGuard` com `useRef`) → **CORRETO**
- Usar em **cada mount de componente** (como fazia `usePageFilters` v1.2) → **BUG** — retorna `true` eternamente após F5

O `CacheRefreshGuard` está correto porque captura o valor **uma vez** no `useRef(isPageReload())` e nunca re-avalia. O `usePageFilters` v1.4 removeu a dependência de `isPageReload()` e usa timestamp comparison via `SESSION_START_KEY` no localStorage.
