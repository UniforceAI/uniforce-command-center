

## Plano: Migrar dados CRM para projeto externo e redirecionar edge function

### Status: ✅ CONCLUÍDO

### O que foi feito

1. **Dados exportados** → `docs/crm-data-migration-inserts.sql` contém todos os INSERTs (40 workflows, 27 comments, 2 tags, 1 risk_bucket_config)
2. **Edge function `crm-api` atualizada** → Agora usa apenas o cliente externo (`yqdqmudsnjhixtxldqwi`) com service role para auth + dados CRM
3. **`scoped-client.ts` removido** → Não era usado em nenhum lugar

### Próximo passo do usuário

Executar o arquivo `docs/crm-data-migration-inserts.sql` no SQL Editor do projeto `yqdqmudsnjhixtxldqwi` para importar os dados.

### Arquitetura atual

```text
extClient (yqdq...) → auth + CRM data (single client, service role)
Edge function roda no Lovable Cloud (ohvd...) mas opera dados no projeto externo
Client-side: supabase.functions.invoke("crm-api") → sem mudanças
```
