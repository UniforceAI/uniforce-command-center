
Objetivo: estabilizar o app (parar recarregamento/quebra em tela branca), eliminar refetch desnecessário entre páginas e fechar os principais riscos de segurança multi-tenant.

Diagnóstico do que está acontecendo agora (confirmado no código atual):
1) Cache 24h foi implementado parcialmente, não totalmente
- Está ativo em `App.tsx` (staleTime/gcTime 24h) e em hooks como `useEventos`, `useChurnData`, `useChamados`, `useNPSData`, `useCrmWorkflow`, `useRiskBucketConfig`.
- Porém duas páginas críticas ainda bypassam esse cache e fazem fetch manual pesado em `useEffect`:
  - `src/pages/Index.tsx`: busca `chamados` em batches diretamente via `externalSupabase` (duplicando o que `useChamados` já faz).
  - `src/pages/NPS.tsx`: busca `nps_check` manualmente com `select("*")` e estado local.
- Resultado: navegação continua lenta e com múltiplos carregamentos.

2) Há um gatilho de recarregamento em loop no login
- Em `src/pages/Auth.tsx`, quando `isLoading` passa de 6s, o componente chama `handleForceReset()` dentro do render:
  - limpa storage
  - faz `window.location.href = "/auth"`
- Isso pode causar ciclo de recarga contínua (especialmente em ambiente de teste/lento), aparentando “quebra total”.

3) Falta contenção global para erro assíncrono
- Sem Error Boundary global e sem handler central de rejeição não tratada, qualquer erro assíncrono em tela pesada pode resultar em tela branca.

4) Segurança: risco real de isolamento entre clientes no backend function
- `supabase/functions/crm-api/index.ts` usa service role e aceita `isp_id` vindo do payload sem validação forte de autorização do usuário.
- Isso abre vetor de acesso indevido por troca de `isp_id` no request.
- Além disso, há findings de segurança pendentes em políticas de leitura ampla (`profiles`, `actions_log`) reportados pelo scanner.

Plano de correção (ordem de execução)

Fase 1 — Hotfix de estabilidade imediata (parar “app inavegável”)
1. Corrigir loop de reload no login (`src/pages/Auth.tsx`)
- Remover chamada automática de `handleForceReset()` no render.
- Substituir por estado de fallback visual com botão manual (“Limpar sessão e tentar novamente”).
- Evitar `window.location.href` automático.

2. Adicionar proteção global contra tela branca
- Incluir Error Boundary no topo da aplicação (envolvendo rotas principais).
- Adicionar listener de `unhandledrejection` e `error` para capturar falhas assíncronas e mostrar fallback amigável (sem quebrar SPA).

Resultado esperado da fase 1:
- Para imediatamente o comportamento de recarregamento infinito.
- Em caso de erro, usuário vê fallback controlado em vez de branco total.

Fase 2 — Unificar 100% do carregamento no React Query (sem bypass)
1. Refatorar `Index.tsx` para usar só cache existente
- Remover `useEffect` de fetch manual de chamados.
- Derivar `chamados` a partir de `useChamados()` com `useMemo` para transformação (`Chamado[]`) e deduplicação, sem nova ida à API.
- `isLoading` da tela passa a vir do hook.

2. Refatorar `NPS.tsx` para usar `useNPSData()`
- Eliminar `fetchNPSData` local manual e estados redundantes (`setRespostasNPS`, `setIsLoading` controlados manualmente).
- Usar o hook cacheado por `queryKey` + memo para filtros e KPIs.
- Se precisar “taxa de resposta” com total enviado, criar query separada específica (também com cache 24h), sem `select("*")`.

3. Padronizar “fonte única de dados”
- Garantir que páginas não façam fetch direto quando já existe hook central.
- Manter “um hook por domínio de dado” (eventos, chamados, nps, churn) e páginas apenas compõem.

Resultado esperado da fase 2:
- Navegação entre páginas reutiliza cache real.
- Redução drástica de requisições duplicadas e tempo de bloqueio no mount.

Fase 3 — Persistência diária em device (além da memória)
Contexto: hoje o cache é em memória (rápido), mas se recarregar a aba ele perde.
Implementar persistência diária no navegador:
1. Persistir cache do React Query em `localStorage` (ou IndexedDB) com TTL por dia + `isp_id`.
2. Versionar chave de cache (ex.: `uf-cache-v1`) para invalidar corretamente após mudanças de schema.
3. Estratégia:
- Primeiro acesso do dia: busca API.
- Navegações e recargas no mesmo dia: hidrata do cache local.
- Troca de ISP: invalidação seletiva.
- Botão “Atualizar dados” para invalidate manual.

Resultado esperado da fase 3:
- “Primeira carga do dia” por ISP.
- Reabertura/reload da aplicação no mesmo dia sem custo total de reimportação.

Fase 4 — Segurança (prioridade alta em paralelo)
1. Blindar `crm-api` contra escalada de tenant
- Validar JWT no início da function.
- Derivar ISPs permitidos do usuário autenticado (perfil/roles) no backend.
- Ignorar ou validar estritamente `isp_id` do payload contra os ISPs autorizados.
- Retornar 403 quando não autorizado.
- Manter CORS completo em todos os retornos (sucesso/erro/preflight).

2. Reduzir uso amplo de service role
- Onde possível, operar com contexto autenticado + políticas.
- Se service role for indispensável, aplicar checagem de autorização explícita antes de qualquer query.

3. Ajustar políticas de dados sensíveis
- `profiles`: restringir SELECT para próprio usuário (e exceção admin controlada).
- `actions_log`: além do header de ISP, exigir vínculo ao usuário/role autorizado; evitar leitura ampla por qualquer autenticado.
- Revisar findings atuais do scanner e fechar os erros primeiro.

Resultado esperado da fase 4:
- Isolamento multi-tenant robusto no backend.
- Redução de risco de exposição de dados entre clientes.

Fase 5 — Otimizações complementares de throughput
1. Trocar `select("*")` por colunas essenciais nas consultas pesadas.
2. Evitar transformações duplicadas grandes no render (concentrar em memo único).
3. (Opcional) Pré-computar agregações pesadas no backend diário para diminuir CPU no front.

Critérios de aceite (validação objetiva)
1) Estabilidade
- Entrar em `/auth` com rede lenta não dispara reload automático infinito.
- Não há tela branca durante navegação normal; erro cai em fallback controlado.

2) Performance
- Navegar: Visão Geral → Financeiro → Chamados → NPS sem refetch pesado repetido.
- Após reload no mesmo dia, dados voltam rapidamente do cache persistido.
- Queda significativa de requests redundantes nas páginas que antes tinham fetch manual (`Index`, `NPS`).

3) Segurança
- Requests ao `crm-api` com `isp_id` não autorizado retornam 403.
- Scanner sem erros críticos de exposição ampla em `profiles/actions_log`.

Riscos e mitigação
- Risco: persistir cache grande no localStorage estourar limite.
  Mitigação: usar limite por query + limpeza por TTL + considerar IndexedDB se necessário.
- Risco: mudança de políticas quebrar telas administrativas.
  Mitigação: aplicar regras por etapas e testar fluxo admin/super admin antes de publicar.
- Risco: regressão de UX no login.
  Mitigação: manter ação manual de limpeza de sessão (sem automação destrutiva).

Sequência recomendada de entrega
1. Fase 1 (hotfix reload/tela branca) — urgente.
2. Fase 2 (retirar bypass React Query em Index/NPS).
3. Fase 3 (persistência diária no device).
4. Fase 4 (hardening de segurança backend + políticas).
5. Fase 5 (otimizações extras).
