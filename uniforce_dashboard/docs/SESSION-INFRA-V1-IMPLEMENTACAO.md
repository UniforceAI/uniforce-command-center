# Implementação Session Infrastructure v1
**Data**: 2026-03-11 (criação) | 2026-03-12 (v1.3, v1.4)
**Status**: Aplicado em produção (yqdqmudsnjhixtxldqwi)
**Versão frontend**: session-infra-v1.4 (fix persistência filtros)
**TanStack Query buster**: v11

---

## Resumo Executivo

Implementação completa do plano de refactoring da infraestrutura de sessões e acesso do Uniforce Dashboard. Resolve 3 classes de problemas críticos + adiciona 4 features novas, incluindo uma solução escalável para gestão de domínios de email.

---

## O Que Foi Implementado

### Frente 1 — Fix de Acesso: Domínios Dinâmicos (Solução Definitiva)

**Problema**: `handle_new_user()` tinha domínios hardcoded. igp-fibra usava `@igpfibra.com` (sem .br), não reconhecido. Cada novo cliente exigia código alterado.

**Solução implementada**:
- Nova tabela `isp_email_domains` com mapping `domain → isp_id`
- `handle_new_user()` reescrito para fazer lookup dinâmico nessa tabela
- Para adicionar domínios: `INSERT INTO isp_email_domains (isp_id, domain) VALUES (...)`
- Nenhuma alteração de código necessária para novos clientes

**Arquivos**:
- `supabase_migration/session-infra-v1.sql` — migration completa aplicada
- `/tmp/uniforce-cc/src/contexts/AuthContext.tsx` — fallback client-side também usa DB
- `/tmp/uniforce-cc/src/lib/authUtils.ts` — remove hardcode, usa `getIspByEmailDomain()`

**Verificação**:
```sql
-- Listar todos os domínios cadastrados
SELECT isp_id, domain FROM isp_email_domains ORDER BY isp_id, domain;

-- Testar lookup (simula o que o trigger faz)
SELECT d.isp_id, i.instancia_isp
  FROM isp_email_domains d
  JOIN isps i ON i.isp_id = d.isp_id
 WHERE d.domain = 'igpfibra.com';
-- Resultado esperado: igp-fibra | ixc
```

**Para adicionar domínio de novo cliente**:
```sql
INSERT INTO isp_email_domains (isp_id, domain)
VALUES ('novo-isp', 'dominiodonovo.com.br')
ON CONFLICT (domain) DO NOTHING;
```

---

### Frente 2 — Filter Persistence: sessionStorage → localStorage

**Problema**: Filtros sumiam ao trocar de tab, Chrome freezar aba, ou após login no dia seguinte.

**Solução implementada** (`/tmp/uniforce-lovable/src/hooks/usePageFilters.ts` — v1.4):
- Storage: localStorage com chave `uf_filters_v3_{ispId}_{pageKey}`
- Session-aware: entrada inclui `_session_ts`; filtros de sessão anterior são descartados
- Cross-tab sync: `BroadcastChannel("uf_filters")` sincroniza em tempo real entre tabs
- F5/reload: IIFE `initSession()` no module load grava novo `SESSION_START_KEY` → `readFromStorage` descarta filtros antigos via comparação `_session_ts < sessionStart`

**⚠️ BUG CRÍTICO corrigido em v1.4** (commit `c47376e`, 2026-03-12):

A versão anterior usava `isPageReload()` (via `performance.getEntriesByType("navigation")`) no `useState` initializer para decidir se resetava filtros. Porém, em uma SPA (React Router), o resultado de `performance.getEntriesByType("navigation")` **NUNCA muda** — ele retorna o tipo da carga **inicial** da página. Consequência: após qualquer F5, **toda navegação SPA resetava filtros** porque `isPageReload()` retornava `true` em cada component mount subsequente.

**Fix**: `isPageReload()` removido do `useState` initializer. Substituído por IIFE `initSession()` que roda **uma vez** no module load: se foi reload, grava novo timestamp em `uf_session_start`. A função `readFromStorage()` já fazia o stale check correto via `_session_ts < sessionStart` — agora funciona porque `sessionStart` é efetivamente inicializado.

**Mecanismo de invalidação (v1.4)**:
```
F5/Reload → initSession() grava novo sessionStart → filtros salvos com _session_ts antigo → readFromStorage retorna defaults
SPA nav → sessionStart inalterado → readFromStorage lê filtros salvos → PERSISTEM
Browser tab switch → componente não desmonta → estado React mantido → PERSISTEM
Novo login → novo sessionStart → filtros da sessão anterior descartados
```

**Comportamento esperado após aplicar**:
| Cenário | Resultado |
|---|---|
| Navegar entre páginas do dashboard (SPA) | Filtros mantidos ✅ |
| Trocar de browser tab e voltar | Filtros mantidos ✅ |
| Reload (F5) | Filtros resetados ✅ |
| Retorno no dia seguinte (novo login) | Filtros resetados ✅ |
| Chrome freeze/unfreeze de aba | Filtros mantidos ✅ |
| Duas abas abertas, filtro muda numa | Outra tab atualiza em tempo real ✅ |

**Páginas beneficiadas** (9 no total — todas usam `usePageFilters`):
| Página | pageKey | Filtros persistidos |
|---|---|---|
| Visão Geral | `visao-geral` | periodo, bairro, cidade, bucket, geoMetric |
| Financeiro | `financeiro` | periodo, plano, metodo, filial, statusInternet, sorting |
| CRM / Clientes em Risco | `crm` | scoreMin, bucket, plano, cidade, bairro, periodo, statusInternet, viewMode, ownerFilter, sorting |
| Cancelamentos | `cancelamentos` | plano, cidade, bairro, bucket, churnDimension, periodo, cohortMetric, sorting |
| NPS | `nps` | periodo, tipoNPS, classificacao |
| Chamados | `chamados-frequentes` | periodo, status, urgencia, setor |
| Churn Analytics | `chamados-analytics` | plano, cidade, bairro, bucket |
| Churn Retenção | `churn-retencao` | periodo, uf, plano, riscoBucket, filial |
| Risk Table (Visão Geral) | `visao-geral-risk-table` | sortKey, sortDir |

---

### Frente 3 — Sessão de 8 Horas

**Configuração aplicada via Management API** (confirmada em produção):
- `jwt_exp: 28800` (8h) — tokens válidos por 8h, refresh a cada ~7.5h
- `sessions_timebox: 28800` — logout forçado 8h após login
- `sessions_inactivity_timeout: 14400` — logout após 4h de inatividade

**Frontend** (`/tmp/uniforce-cc/src/contexts/AuthContext.tsx`):
- `SIGNED_IN` → `localStorage.setItem("uf_session_start", Date.now())`
- `TOKEN_REFRESHED` → verifica se `Date.now() - session_start > 28800000` → `signOut()`

---

### Frente 4 — Kanban Durability

**Patch necessário no Lovable** (ver `PATCHES.md`):
- `RESOLVIDO_ARCHIVE_DAYS`: 7 → 30 dias corridos
- `PERDIDO_ARCHIVE_BUSINESS_DAYS`: 7 → 30 dias úteis
- Adicionar toggle "Ver Arquivados" no header do kanban

---

### Frente 5 — Bloqueio de Acesso por Inadimplência

**SQL aplicado em produção**:
```sql
-- Colunas adicionadas a isps:
billing_blocked        boolean   NOT NULL DEFAULT false
billing_blocked_since  timestamptz

-- Função e cron:
CREATE FUNCTION refresh_billing_blocked() ...
SELECT cron.schedule('refresh-billing-blocked', '0 * * * *', ...)
```

**Lógica**:
1. `PAYMENT_OVERDUE` (Asaas) / `invoice.payment_failed` (Stripe) → `billing_blocked_since = now()` (se ainda não definido)
2. Cron a cada hora → `billing_blocked = true` quando `billing_blocked_since < now() - 30 days`
3. `PAYMENT_RECEIVED` / `invoice.paid` → `billing_blocked = false, billing_blocked_since = null`
4. `BillingGuard` → redireciona para `/configuracoes/perfil?tab=financeiro`
5. Polling a cada 60s quando bloqueado → auto-libera após pagamento sem relogin

**Edge functions atualizadas e deployadas**:
- `asaas-webhook/index.ts` — implementa lógica #1 e #3
- `stripe-webhook/index.ts` — implementa lógica #1 e #3

**Para testar bloqueio manualmente**:
```sql
-- Bloquear ISP de teste
UPDATE isps SET billing_blocked = true, billing_blocked_since = now() - interval '31 days'
WHERE isp_id = 'zen-telecom';

-- Verificar
SELECT isp_id, billing_blocked, billing_blocked_since FROM isps WHERE isp_id = 'zen-telecom';

-- Desbloquear
UPDATE isps SET billing_blocked = false, billing_blocked_since = null
WHERE isp_id = 'zen-telecom';
```

---

### Frente 6 — Remover Super-Admin do Cadastro

**Patch no Lovable** (ver `PATCHES.md`): remover qualquer seletor de role do formulário de cadastro. O trigger `handle_new_user()` já atribui roles automaticamente.

---

### Frente 7 — Evoluções de UX Arquitetadas

Infraestrutura criada que suporta:
- **7.1 BroadcastChannel**: implementado em `usePageFilters.ts`
- **7.2 Retomada pós-bloqueio**: implementado em `BillingGuard.tsx` (polling 60s)
- **7.3 Presets de filtros**: tabela `user_filter_presets` criada com RLS
- **7.4 Hidratação progressiva**: sem mudança de infraestrutura necessária (usar `keepPreviousData`)
- **7.5 Sessão até fim do dia**: `uf_session_start` está disponível para cálculo

---

## Arquivos Criados/Modificados

### Locais (aplicados imediatamente)

| Arquivo | Tipo | Status |
|---|---|---|
| `supabase_migration/session-infra-v1.sql` | SQL Migration | ✅ Aplicado em produção |
| `supabase/functions/asaas-webhook/index.ts` | Edge Function | ✅ Deployado |
| `supabase/functions/stripe-webhook/index.ts` | Edge Function | ✅ Deployado |

### Para aplicar no Lovable (UniforceAI/uniforce-command-center)

| Arquivo | Local | Ação |
|---|---|---|
| `src/contexts/AuthContext.tsx` | `src/contexts/AuthContext.tsx` | Substituir completo | ✅ Aplicado |
| `src/lib/authUtils.ts` | `src/lib/authUtils.ts` | Substituir/criar | ✅ Aplicado |
| `src/hooks/usePageFilters.ts` | `src/hooks/usePageFilters.ts` | **v1.4** (fix filtros SPA) | ✅ Commit `c47376e` |
| `src/components/BillingGuard.tsx` | `src/components/BillingGuard.tsx` | Criar (novo) | ✅ Aplicado |
| `src/hooks/useTeamMembers.ts` | `src/hooks/useTeamMembers.ts` | Novo (CRM owner avatars) | ✅ Commit `1f0854d` |
| `src/App.tsx` | `src/App.tsx` | Buster v11 | ✅ Commit `c47376e` |

---

## Verificação de Produção Pós-Aplicação

```
1. igp-fibra sessão:
   - Logar com financeiro@igpfibra.com
   - Dashboard deve carregar sem quebrar
   - Trocar de página → sessão mantida

2. Filtros navegação SPA (TESTE MAIS IMPORTANTE — bug v1.4):
   - Abrir /financeiro → aplicar filtro "plano = Fibra 100"
   - Navegar para /crm (menu lateral)
   - Voltar para /financeiro → filtro "Fibra 100" DEVE estar aplicado
   - Repetir com todas as 9 páginas que usam filtros
   - Verificar: DevTools → Application → localStorage → buscar uf_filters_v3_*

2b. Filtros cross-tab:
   - Aplicar filtro em Financeiro
   - Abrir nova aba com o mesmo dashboard
   - Navegar de volta → filtro permanece

2c. Filtros após F5:
   - Aplicar filtro → F5 → filtro DEVE resetar (nova sessão)
   - Após F5, navegar entre páginas → filtros definidos PÓS-F5 DEVEM persistir

3. Filtros entre dias:
   - Aplicar filtro
   - Sair (logout)
   - Entrar novamente → filtro deve estar resetado (nova sessão = novo uf_session_start)

4. 8h session:
   - DevTools: localStorage.getItem("uf_session_start")
   - Deve ser timestamp do último login

5. Kanban durability:
   - Mover card para "Resolvido"
   - Simular 8 dias passados (alterar data no DB)
   - Card deve continuar visível (threshold 30d)

6. Billing gate:
   - SQL: UPDATE isps SET billing_blocked=true WHERE isp_id='d-kiros'
   - Logar como usuário d-kiros
   - Tentar acessar /financeiro → redireciona para /configuracoes/perfil?tab=financeiro
   - Reverter: UPDATE isps SET billing_blocked=false, billing_blocked_since=null WHERE isp_id='d-kiros'

7. Domain management:
   - Verificar: SELECT * FROM isp_email_domains ORDER BY isp_id
   - 10 domínios devem estar presentes
```

---

## Como Adicionar Novos ISPs e Domínios

### Novo ISP com domínio de email:
```sql
-- 1. Inserir ISP (se não existir)
INSERT INTO isps (isp_id, isp_nome, instancia_isp, ativo)
VALUES ('novo-isp', 'Novo ISP Telecom', 'ixc', true);

-- 2. Mapear domínio(s) de email
INSERT INTO isp_email_domains (isp_id, domain)
VALUES
  ('novo-isp', 'novoisp.com.br'),
  ('novo-isp', 'novoisptelecom.com.br');  -- múltiplos domínios suportados

-- A partir daí, qualquer usuário que se cadastrar com @novoisp.com.br
-- será automaticamente vinculado ao ISP 'novo-isp'
```

### ISP existente — adicionar novo domínio:
```sql
INSERT INTO isp_email_domains (isp_id, domain)
VALUES ('igp-fibra', 'igpfibra.net')
ON CONFLICT (domain) DO NOTHING;
```

---

## Notas Técnicas

- `billing_blocked` é verificado a cada hora pelo cron `refresh-billing-blocked` (jobid: **8**)
- O acesso do `uniforce.com.br` nunca é bloqueado por billing (super_admin bypass em BillingGuard)
- `user_filter_presets` table está pronta para UI de presets (Frente 7.3) — basta adicionar o componente
- BroadcastChannel não funciona em iOS Safari (limitação de WebKit) — fallback gracioso (sem sync cross-tab no iOS, filtros ainda persistem via localStorage)
- `get_isp_by_email_domain(p_domain text)` RPC com SECURITY DEFINER — accesível por `authenticated` e `anon` para domain lookup pré-autenticação. Retorna `text` (não varchar) em todos os campos para evitar type mismatch.
- `authUtils.ts` v1.1: usa RPC (não query direta em `isp_email_domains`) porque usuário recém-autenticado sem `isp_id` no profile ainda não passa no RLS da tabela. `user_roles` usa `upsert+ignoreDuplicates` para evitar constraint violation.
- `BillingGuard.tsx` v1.1: ALLOWED_PATHS usa match exato + prefixo "/" (não `startsWith` puro que permite bypass). Polling pausa quando tab está oculta (`document.visibilityState`). `invalidateQueries` restrito a keys específicas.

### Correções v1.1 aplicadas após auditoria:

| Bug | Severidade | Arquivo | Fix |
|---|---|---|---|
| RLS `isp_email_domains` expunha todos os domínios | Alta | DB | Policy restrita a próprio ISP |
| `get_isp_by_email_domain()` tipo varchar mismatch | Alta | DB | Reescrita com cast `::text` |
| `AuthContext` localStorage sem try-catch | Alta | AuthContext.tsx | Helpers `lsGet/lsSet/lsRemove` |
| `TOKEN_REFRESHED` race condition duplo signOut | Alta | AuthContext.tsx | `signingOutRef` flag |
| `BroadcastChannel` loop prevention racy | Média | usePageFilters.ts | `INSTANCE_ID` no payload |
| `isPageReload()` fallback deprecated | Baixa | usePageFilters.ts | Removido |
| `BillingGuard` ALLOWED_PATHS bypass | Média | BillingGuard.tsx | Match exato + `p + "/"` |
| `invalidateQueries()` sem escopo | Baixa | BillingGuard.tsx | Keys específicas |
| Polling ativa em tab oculta | Baixa | BillingGuard.tsx | `visibilityState` guard |
| `authUtils` domain lookup falha em RLS | Alta | authUtils.ts | Usa RPC SECURITY DEFINER |
| `user_roles` insert falha em conflito | Alta | authUtils.ts | `upsert+ignoreDuplicates` |
| Asaas webhook audit INSERT não idempotente | Alta | asaas-webhook | Mudado para upsert |
| `PAYMENT_OVERDUE` usava `new Date()` | Média | asaas-webhook | Usa `payment.dueDate` real |

### Correções v1.2 aplicadas na revisão final:

| Bug | Severidade | Arquivo | Fix |
|---|---|---|---|
| `stableDefaults = useMemo(Object.values(defaults))` quebra com arrays | Alta | usePageFilters.ts | `useRef` — captura inicial, sem re-compute |
| Double-render no mount: useState + useEffect ambos lendo storage | Média | usePageFilters.ts | `isInitialMountRef` — pula resync no primeiro mount |
| `SIGNED_OUT` (logout forçado) não limpa `SELECTED_ISP_KEY` | Média | AuthContext.tsx | `lsRemove(SELECTED_ISP_KEY)` no handler |
| `refreshProfile()` no BillingGuard sem `.catch()` | Média | BillingGuard.tsx | `.catch()` adicionado — evita guard travado em silêncio |
| `ensureUserProfile` inseria `viewer` mesmo se admin já atribuído | Alta | authUtils.ts | Check explícito de role existente antes do insert |
| `session-infra-v1.sql` tinha `USING(true)` vulnerável + funções ausentes | Alta | session-infra-v1.sql | RLS corrigido + `get_isp_by_email_domain()` + `refresh_billing_blocked()` adicionados |

### Correções v1.3 (2026-03-12, commit `ec6a000`):

| Bug | Severidade | Arquivo | Fix |
|---|---|---|---|
| `usePageFilters` mudou API para `{pageKey,ispId,defaults}` mas TODOS os callers usavam `("pageKey", defaults)` | **Crítica** | usePageFilters.ts | Aceitar ambas as formas; `ispId` via `useActiveIsp()` como fallback |
| `defaults=undefined` → crash em TODAS as páginas ao destruturar `filters` | **Crítica** | usePageFilters.ts | `safeDefaults: T = defaults ?? ({} as T)` |

### Correções v1.4 (2026-03-12, commit `c47376e`):

| Bug | Severidade | Arquivo | Fix |
|---|---|---|---|
| `isPageReload()` retornava `true` para TODOS os mounts após F5 (SPA navigation type nunca muda) → filtros resetados a cada navegação entre páginas | **Crítica** | usePageFilters.ts | IIFE `initSession()` no module load grava `SESSION_START_KEY`; `isPageReload()` removido do `useState` init; `readFromStorage` faz stale check via `_session_ts < sessionStart` |
| `SESSION_START_KEY` nunca era escrito — `getSessionStart()` sempre retornava 0 → `_session_ts` comparison nunca invalidava filtros de sessão anterior | **Alta** | usePageFilters.ts | `initSession()` grava timestamp no load; `writeToStorage` usa `sessionStart` real |
| Buster `v10` não invalidava cache de browsers com filtros broken | **Média** | App.tsx | Buster v10 → v11 |

---

## Anti-Regressão: Regras para Futuras Alterações em usePageFilters

> **NUNCA usar `performance.getEntriesByType("navigation")` em lógica condicional dentro de hooks React.**
> Em SPAs, esse valor reflete a carga inicial da página e NUNCA muda durante a sessão.
> Usar module-level initialization (IIFE) + timestamp comparison em localStorage.

> **Ao alterar a assinatura do hook, manter retrocompatibilidade** com a forma legada `usePageFilters("pageKey", defaults)`.
> 9 callers no codebase usam essa forma. Quebrá-la causa crash em TODAS as páginas.

> **Sempre bumpar o buster em App.tsx** ao alterar o formato de dados persistidos.
> Browsers com JS antigo podem ter localStorage com schema incompatível.

> **Testar navegação SPA (não apenas F5)**: aplicar filtro → navegar para outra página → voltar → filtro deve persistir.
> Este é o cenário que o bug v1.4 quebrava e que os clientes reportaram repetidamente.
