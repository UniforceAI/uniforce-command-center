

## Plano: Adicionar variável VITE_STRIPE_PUBLISHABLE_KEY

A chave Stripe publishable (`pk_live_...`) é uma chave **pública** — segura para armazenar no código. Não precisa de secrets management.

### Ação única

Adicionar a variável diretamente no arquivo `src/lib/stripe.ts` ou onde for consumida, como constante exportada:

```typescript
export const STRIPE_PUBLISHABLE_KEY = "pk_live_51T5enNRqpdAZA3POznPld3guRt6XkRLYvloPVJ2gJmLstJ85RfyAvBfYBYbXxcKnK3lhFji39JAPrNSPieU1MesW00UYD0J59H";
```

**Importante:** O arquivo `.env` deste projeto é gerenciado automaticamente pelo Lovable Cloud e não pode ser editado manualmente. Porém, como a chave publishable é pública, a abordagem correta é:

1. Criar um arquivo de configuração (ex: `src/lib/stripeConfig.ts`) com a constante exportada
2. Importar essa constante onde necessário no código

### Sobre o código do GitHub

Para sincronizar o código que você adicionou via GitHub, você precisa fazer um **pull** do repositório. No Lovable, vá em **Settings → GitHub** e use a opção de sincronizar/pull as mudanças do GitHub para o projeto Lovable.

### Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/lib/stripeConfig.ts` | Criar com a publishable key |

