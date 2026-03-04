

## Plano: Migrar dados CRM para projeto externo e redirecionar edge function

### Verificação da infraestrutura

A infraestrutura no projeto externo (`yqdqmudsnjhixtxldqwi`) precisa conter:
- Tabelas: `crm_workflow`, `crm_comments`, `crm_tags`, `risk_bucket_config`, `actions_log`
- Enum: `workflow_status` (`em_tratamento`, `resolvido`, `perdido`)
- Função: `update_updated_at_column()`
- Triggers de `updated_at` em `crm_workflow` e `risk_bucket_config`

Assumindo que o Claude Code criou tudo conforme a documentação fornecida, a estrutura está em conformidade.

### Dados a migrar (projeto interno → externo)

| Tabela | Registros | ISPs |
|---|---|---|
| `crm_workflow` | 40 | zen-telecom (17), d-kiros (12), igp-fibra (7), agy-telecom (4) |
| `crm_comments` | 27 | zen-telecom (14), d-kiros (6), igp-fibra (7) |
| `crm_tags` | 2 | zen-telecom |
| `risk_bucket_config` | 1 | zen-telecom |
| `actions_log` | 0 | (vazio) |

### Etapas de implementação

#### 1. Exportar dados do projeto interno
Ler todos os registros das 4 tabelas com dados via `read-query` do projeto interno.

#### 2. Importar dados no projeto externo
Não é possível inserir dados diretamente no projeto externo via ferramentas Lovable. O plano é:
- Gerar os comandos SQL `INSERT` com todos os dados
- O usuário (ou Claude Code) executa no projeto externo

#### 3. Atualizar edge function `crm-api`
Mudança principal: em vez de criar dois clientes Supabase (externo para auth + interno para dados), usar **apenas o cliente externo** para tudo — auth E operações CRM. O `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` internos deixam de ser usados para CRM. A edge function passa a usar `EXT_URL` + `EXT_SERVICE_KEY` como o único cliente de dados.

```text
ANTES:
  extClient (yqdq...) → auth only
  supabase  (ohvd...) → CRM data

DEPOIS:
  extClient (yqdq...) → auth + CRM data (single client)
```

#### 4. Atualizar `crmApi.ts` (client-side)
A chamada `supabase.functions.invoke("crm-api")` continuará igual — a edge function ainda roda no Lovable Cloud. Nenhuma mudança necessária no client-side.

#### 5. `scoped-client.ts` — pode ser removido
Não é usado em nenhum lugar do código. Cleanup.

### Arquivos afetados

| Arquivo | Ação |
|---|---|
| `supabase/functions/crm-api/index.ts` | Alterar para usar extClient como único cliente de dados |
| `src/integrations/supabase/scoped-client.ts` | Remover (não é usado) |
| Dados (SQL exports) | Gerar INSERTs para execução no projeto externo |

