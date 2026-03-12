# Patches para Aplicar Manualmente no Lovable

Este arquivo descreve as mudanças a fazer em arquivos existentes do repo Lovable
(UniforceAI/uniforce-command-center) que não puderam ser editados diretamente.

---

## 1. `src/App.tsx` — Adicionar BillingGuard

Importar e envolver rotas protegidas:

```diff
+ import { BillingGuard } from "@/components/BillingGuard";

// Dentro do JSX, onde há <ProtectedRoute>:
- <ProtectedRoute>
-   <PageComponent />
- </ProtectedRoute>

+ <ProtectedRoute>
+   <BillingGuard>
+     <PageComponent />
+   </BillingGuard>
+ </ProtectedRoute>
```

Aplicar para TODAS as rotas protegidas (não aplicar em `/auth`, `/configuracoes`, `/perfil`, `/logout`).

---

## 2. `src/pages/Auth.tsx` — Remover seletor de super_admin do cadastro

Localizar qualquer `<select>`, `<RadioGroup>`, ou campo com opção "super_admin" no formulário de cadastro/registro.

**Remover completamente** esse campo — o trigger `handle_new_user()` já atribui o role correto automaticamente baseado no domínio do email.

Se há lógica `createUserProfileInExternal()` ou similar em authUtils, garantir que o fallback de role padrão seja `"viewer"` (não `"super_admin"`).

---

## 3. `src/pages/ClientesEmRisco.tsx` + `src/lib/workflowLifecycle.ts`

### 3a. Estender threshold de auto-arquivo

Localizar as constantes de threshold:

```diff
- const RESOLVIDO_ARCHIVE_DAYS = 7;
- const PERDIDO_ARCHIVE_BUSINESS_DAYS = 7;
+ const RESOLVIDO_ARCHIVE_DAYS = 30;
+ const PERDIDO_ARCHIVE_BUSINESS_DAYS = 30;
```

Se os valores estiverem em `workflowLifecycle.ts`, atualizar lá. Se estiverem inline em `ClientesEmRisco.tsx`, atualizar no componente.

### 3b. Adicionar toggle "Ver Arquivados"

Adicionar botão no header do kanban:

```tsx
const [showArchived, setShowArchived] = useState(false);

// No header do kanban:
<Button
  variant="outline"
  size="sm"
  onClick={() => setShowArchived((v) => !v)}
>
  {showArchived ? "Ocultar Arquivados" : "Ver Arquivados"}
</Button>

// Na chamada da API:
callCrmApi({ action: "fetch_workflow", includeArchived: showArchived })
```

Renderizar seção colapsável de arquivados abaixo das colunas principais.

---

## 4. `src/contexts/AuthContext.tsx` — Substituir arquivo completo (v1.1)

Substituir o conteúdo atual pelo arquivo `/tmp/uniforce-cc/src/contexts/AuthContext.tsx`.

**Mudanças v1.1 (pós-auditoria):**
- `lsGet`/`lsSet`/`lsRemove` helpers com try-catch (Incognito mode safe)
- `signingOutRef` previne signOut duplo em TOKEN_REFRESHED race condition
- `isSuperAdminEmail()` movido para antes de `loadFullProfile` (hoisting explícito)
- Domain fallback via `.rpc("get_isp_by_email_domain")` (SECURITY DEFINER, bypassa RLS)
- `isBillingBlocked` com guard triplo: `billingBlocked && !isSuperAdmin && !!profile?.isp_id`
- Mensagens de erro diferenciadas: `domain_not_registered` vs `no_isp` vs `incomplete_config`
- `uf_session_start` gravado no SIGNED_IN; verificação de 8h no TOKEN_REFRESHED
- `selectedIsp` em localStorage (key `uf_selected_isp_v2`) — não mais sessionStorage

**ATENÇÃO**: Verificar o nome do import do supabase client no projeto:
- Se o projeto usa `import { supabase } from "@/integrations/supabase/client"` → ok
- Se usa `import { externalSupabase } from "@/integrations/supabase/external-client"` → substituir `supabase` por `externalSupabase` no arquivo

---

## 5. `src/lib/authUtils.ts` — Substituir arquivo completo (v1.1)

Substituir o conteúdo atual pelo arquivo `/tmp/uniforce-cc/src/lib/authUtils.ts`.

**Mudanças v1.1 (pós-auditoria):**
- `getIspByEmailDomain`: usa RPC `get_isp_by_email_domain()` (SECURITY DEFINER) em vez de
  query direta em `isp_email_domains` — necessário pois RLS restringe à própria ISP;
  usuário recém-autenticado sem `isp_id` no profile ainda não passa no RLS
- `user_roles` insert: usa `.upsert({ ignoreDuplicates: true })` em vez de `.insert().maybeSingle()`
  que não ignorava conflito (lançaria erro em unique constraint violation)
- Profiles sem ISP: usa `.upsert()` para evitar duplicate key se profile base já foi criado pelo trigger

---

## 6. Adicionar SessionExpiryBanner (opcional — Frente 3.2)

Para exibir aviso de expiração quando restam < 30min, criar:

```tsx
// src/components/SessionExpiryBanner.tsx
import { useEffect, useState } from "react";

const SESSION_START_KEY   = "uf_session_start";
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
const WARN_BEFORE_MS      = 30 * 60 * 1000; // avisar 30min antes

export function SessionExpiryBanner() {
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const start = parseInt(localStorage.getItem(SESSION_START_KEY) ?? "0", 10);
      if (!start) return;
      const remaining = SESSION_DURATION_MS - (Date.now() - start);
      if (remaining < WARN_BEFORE_MS && remaining > 0) {
        setMinutesLeft(Math.ceil(remaining / 60000));
      } else {
        setMinutesLeft(null);
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  if (!minutesLeft) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded-lg shadow-lg">
      ⏰ Sua sessão expira em <strong>{minutesLeft} minutos</strong>. Salve seu trabalho.
    </div>
  );
}
```

Adicionar `<SessionExpiryBanner />` no layout principal (`src/App.tsx` ou no componente de layout raiz).
