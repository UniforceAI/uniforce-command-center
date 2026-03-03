
# Performance: Cache de Dados no Navegador + Correções de Segurança

## Diagnóstico da Lentidão

O problema de performance tem uma causa raiz clara: **todos os hooks de dados usam `useState`/`useEffect` puros**, sem qualquer camada de cache. Isso significa que:

- Cada vez que o usuario navega de `/visao-geral` para `/financeiro`, **todas as requisicoes sao refeitas do zero** (eventos, chamados, churn_status, NPS, CRM workflow, risk_bucket_config)
- A pagina `VisaoGeral` sozinha dispara **30-50+ requisicoes HTTP** (batches de 1000 registros)
- O React Query ja esta instalado e configurado (`QueryClientProvider`), mas **nenhum hook o utiliza** -- ele esta la so como wrapper vazio

Como os dados atualizam apenas **1x por dia**, toda essa refetch e completamente desnecessaria.

## Solucao: Migrar hooks para React Query com staleTime de 24h

### Hooks a migrar (6 hooks criticos):

| Hook | Origem | Requests por mount |
|------|--------|--------------------|
| `useEventos` | external supabase | 10-20 batches |
| `useChurnData` | external supabase | 5-10 batches |
| `useChamados` | external supabase | 5-15 batches |
| `useNPSData` | external supabase | 1 request |
| `useCrmWorkflow` | internal (crm-api) | 1 request |
| `useRiskBucketConfig` | internal (crm-api) | 1 request |

### Estrategia tecnica:

1. Configurar `QueryClient` com `staleTime` de 24 horas e `gcTime` (cacheTime) de 24 horas
2. Cada hook usa `useQuery` com uma `queryKey` que inclui o `ispId`
3. Na primeira navegacao do dia, os dados carregam normalmente
4. Nas navegacoes subsequentes, os dados vem do cache em memoria instantaneamente
5. O usuario pode forcar um refresh manual se necessario (botao de atualizar)

### Exemplo da transformacao (useChurnData):

**Antes (atual):**
```
useState + useEffect -> fetch direto -> recarrega toda vez
```

**Depois:**
```
useQuery({ queryKey: ["churn-data", ispId], queryFn: fetchAll, staleTime: 24h })
-> primeira vez: carrega normalmente
-> proximas paginas: dados instantaneos do cache
```

### Beneficio esperado:
- Primeira carga: igual ou ligeiramente mais rapida (sem mudanca)
- Navegacao entre paginas: **instantanea** (0ms de loading, dados ja em memoria)
- Troca de ISP (super admin): refetch automatico (queryKey muda)

---

## Correcoes de Seguranca

### 1. Credenciais do Supabase externo hardcoded no frontend
**Arquivo:** `src/integrations/supabase/external-client.ts`

A URL e a `anon_key` do Supabase externo estao hardcoded diretamente no codigo fonte. Embora a `anon_key` seja por definicao publica (equivalente a uma chave de API do lado do cliente), o padrao correto e mover para variaveis de ambiente para facilitar rotacao e evitar exposicao desnecessaria em buscas de codigo.

**Acao:** Mover para `VITE_EXTERNAL_SUPABASE_URL` e `VITE_EXTERNAL_SUPABASE_ANON_KEY` (ou deixar como esta, ja que anon keys sao publicas por design -- baixo risco).

### 2. Super Admin determinado apenas por dominio de email no frontend
**Arquivo:** `src/contexts/AuthContext.tsx` (linha 96-98)

```typescript
const SUPER_ADMIN_DOMAINS = ["uniforce.com.br"];
function isSuperAdminEmail(email: string): boolean {
  return SUPER_ADMIN_DOMAINS.includes(emailDomain(email));
}
```

Qualquer usuario que criar uma conta com email `@uniforce.com.br` ganha acesso super admin automaticamente. Isso e uma vulnerabilidade se o provedor de email nao for controlado, ou se alguem registrar um email falso. A verificacao deveria ser feita no backend (RLS ou edge function) e nao apenas no cliente.

**Acao:** Documentar o risco. A mitigacao ideal seria validar o dominio no backend antes de conceder privilegios, mas como a autenticacao usa o Supabase externo e os dados sao somente leitura com RLS, o risco pratico e moderado.

### 3. Erro ativo no console: coluna `nps_check.celular` nao existe
O hook `useNPSData` faz `SELECT ... celular ...` mas a coluna nao existe na tabela externa. Isso causa erro silencioso que impede o carregamento de dados NPS.

**Acao:** Remover `celular` do select e usar apenas as colunas existentes.

---

## Plano de implementacao

### Etapa 1 -- Configurar QueryClient com staleTime global
**Arquivo:** `src/App.tsx`

Alterar a criacao do `QueryClient` para definir defaults globais:
```
staleTime: 24 * 60 * 60 * 1000 (24h)
gcTime: 24 * 60 * 60 * 1000 (24h)
refetchOnWindowFocus: false
refetchOnMount: false
retry: 1
```

### Etapa 2 -- Migrar useEventos para React Query
**Arquivo:** `src/hooks/useEventos.ts`

- Extrair a funcao `fetchEventos` para fora do hook (como `queryFn`)
- Usar `useQuery` com `queryKey: ["eventos", ispId]`
- Manter a mesma logica de batching e merge
- Retornar `{ data, isLoading, error }` do React Query

### Etapa 3 -- Migrar useChurnData para React Query
**Arquivo:** `src/hooks/useChurnData.ts`

- Separar em duas queries: `["churn-status", ispId]` e `["churn-events", ispId]`
- Ambas com staleTime de 24h

### Etapa 4 -- Migrar useChamados para React Query
**Arquivo:** `src/hooks/useChamados.ts`

- `useQuery` com `queryKey: ["chamados", ispId]`
- `getChamadosPorCliente` continua como funcao derivada (memoizada)

### Etapa 5 -- Migrar useNPSData para React Query + fix coluna
**Arquivo:** `src/hooks/useNPSData.ts`

- `useQuery` com `queryKey: ["nps-data", ispId]`
- Remover `celular` e `telefone` do select (colunas inexistentes)

### Etapa 6 -- Migrar useCrmWorkflow e useRiskBucketConfig
**Arquivos:** `src/hooks/useCrmWorkflow.ts`, `src/hooks/useRiskBucketConfig.ts`

- Ambos para `useQuery` com staleTime de 24h
- Mutacoes (addToWorkflow, updateStatus, etc.) usam `useMutation` com `invalidateQueries`

### Etapa 7 -- Botao de refresh manual
Adicionar um botao "Atualizar dados" no header/toolbar que invalida todas as queries, forcando um refetch completo quando o usuario precisar.

---

## Arquivos impactados
1. `src/App.tsx` (QueryClient config)
2. `src/hooks/useEventos.ts`
3. `src/hooks/useChurnData.ts`
4. `src/hooks/useChamados.ts`
5. `src/hooks/useNPSData.ts`
6. `src/hooks/useCrmWorkflow.ts`
7. `src/hooks/useRiskBucketConfig.ts`

## Resultado esperado
- Primeira carga do dia: sem mudanca (mesmo tempo)
- Navegacao entre paginas: **de 5-15s para instantaneo**
- Troca de ISP: refetch automatico
- Erro NPS corrigido
- Riscos de seguranca documentados
