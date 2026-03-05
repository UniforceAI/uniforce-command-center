# Padrão Arquitetural: Persistência de Filtros por Sessão

**Status:** Ativo (implementado em Mar/2026)
**Hook:** `src/hooks/usePageFilters.ts`

---

## Problema

Ao trocar de tab no navegador e retornar ao Uniforce Dashboard, todos os filtros aplicados eram perdidos. Causa raiz: o evento `SIGNED_IN` do Supabase (disparado ao re-sincronizar a sessão ao retornar à tab) setava `isLoading: true` no `AuthContext`, fazendo o `ProtectedRoute` desmontar os filhos — o que reiniciava todo `useState` nos valores padrão.

---

## Solução: `usePageFilters`

Hook genérico que substitui múltiplos `useState` de filtros por um único estado persistido em `sessionStorage`.

### Onde está

```
src/hooks/usePageFilters.ts
```

### Como funciona

| Evento | Comportamento |
|--------|---------------|
| Troca de tab / re-sync Supabase | Filtros restaurados do `sessionStorage` ✅ |
| Navegar para outra página e voltar | Filtros restaurados ✅ |
| F5 / Ctrl+R (reload manual) | Filtros resetam para defaults ✅ |
| Sign out | `sessionStorage` limpa automaticamente ✅ |
| Próximo dia (nova sessão de browser) | `sessionStorage` limpa automaticamente ✅ |
| Super admin troca de cliente ISP | Filtros isolados por ISP (não contamina) ✅ |

**Chave de storage:** `uf_filters_v1_{ispId}_{pageKey}`

---

## API do Hook

```typescript
const { filters, setFilter, resetFilters } = usePageFilters(pageKey, defaults);
```

| Parâmetro / Retorno | Tipo | Descrição |
|--------------------|------|-----------|
| `pageKey` | `string` | Identificador único da página (ex: `"crm"`) |
| `defaults` | `T` | Objeto com valores padrão de todos os filtros |
| `filters` | `T` | Estado atual dos filtros (readonly via destructure) |
| `setFilter(key, value)` | `fn` | Atualiza um filtro individual |
| `resetFilters()` | `fn` | Reseta para defaults e remove do storage |

---

## Padrão de Implementação

### Antes (padrão antigo — NÃO usar em páginas com filtros)

```typescript
const [bucket, setBucket] = useState("todos");
const [plano, setPlano] = useState("todos");
const clearFilters = () => { setBucket("todos"); setPlano("todos"); };
// uso:
onValueChange={setBucket}
onClick={clearFilters}
```

### Depois (padrão atual — usar sempre)

```typescript
const { filters, setFilter, resetFilters } = usePageFilters("minha-pagina", {
  bucket: "todos" as string,
  plano: "todos" as string,
});
const { bucket, plano } = filters;
// uso:
onValueChange={(v) => setFilter("bucket", v)}
onClick={resetFilters}
```

### Regras

1. **Persistir:** todos os filtros de busca/visualização (`Select`, `Slider`, `Toggle`, sort)
2. **NÃO persistir:** estados de modal/drawer (`selectedCliente`, `sheetOpen`, `importOpen`)
3. **`const filters = [...]`** (array para `GlobalFilters`) → renomear para `filterConfig` para evitar conflito de nomes
4. **`pageKey`** deve ser único por página (ver tabela abaixo)
5. **Tipos complexos** (union types, enums) → usar `as` no defaults: `"kanban" as "lista" | "kanban"`

---

## Páginas Migradas

### Páginas de Provedor (6 páginas públicas do dashboard)

| Página | Rota | `pageKey` | Filtros persistidos |
|--------|------|-----------|---------------------|
| Visão Geral | `/` | `"visao-geral"` | periodo, uf, cidade, bairro, plano, filial |
| Financeiro | `/financeiro` | `"financeiro"` | periodo, plano, metodo, filial, ordemPlanoDecrescente, sortColuna, sortDir |
| Chamados Frequentes | `/chamados` | `"chamados-frequentes"` | periodo, status, urgencia, setor |
| Clientes em Risco | `/crm` | `"crm"` | scoreMin, bucket, plano, cidade, bairro, periodo, viewMode, sortField, sortDir |
| Cancelamentos | `/cancelamentos` | `"cancelamentos"` | plano, cidade, bairro, bucket, churnDimension, periodo, cohortMetric, sortField, sortDir |
| NPS | `/nps` | `"nps"` | periodo, tipoNPS, classificacao |

### Páginas Internas (não expostas no menu principal)

| Página | `pageKey` | Filtros persistidos |
|--------|-----------|---------------------|
| Churn & Retenção | `"churn-retencao"` | periodo, uf, plano, riscoBucket, filial |
| Análise de Churn | `"chamados-analytics"` | plano, cidade, bairro, bucket |

---

## Páginas NÃO Migradas (correto — sem filtros de sessão)

As páginas abaixo **não foram alteradas** e não devem usar `usePageFilters` pois são fluxos transacionais ou de configuração — não há filtros de listagem a persistir:

| Arquivo | Motivo |
|---------|--------|
| `ConfiguracaoChurnScore.tsx` | Configuração de sistema — salva no banco, não em filtros |
| `SetupChamados.tsx` | Setup one-time de integração |
| `ContasAcesso.tsx` | Gestão de usuários — sem filtros de listagem |
| `PerfilISP.tsx` | Dados do ISP — sem filtros |
| `SelecionarCliente.tsx` | Seleção de ISP para super admin — fluxo de auth |
| `Auth.tsx` / `EsqueciSenha.tsx` / `ResetSenha.tsx` | Fluxos de autenticação |
| `EventosDebug.tsx` | Debug interno — reseta intencionalmente |

---

## Ao Adicionar uma Nova Página com Filtros

1. Importar: `import { usePageFilters } from "@/hooks/usePageFilters";`
2. Definir defaults tipados
3. Substituir `useState` pelos filtros
4. Documentar na tabela acima com `pageKey` único
5. Nunca reutilizar um `pageKey` existente

```typescript
// Exemplo para nova página /relatorios
const { filters, setFilter, resetFilters } = usePageFilters("relatorios", {
  periodo: "30" as string,
  tipo: "todos" as string,
  exportado: false as boolean,
});
const { periodo, tipo, exportado } = filters;
```
