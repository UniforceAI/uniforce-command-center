# Guia de Teste — Onboarding Self-Service

## URLs
- App: https://dash.uniforce.com.br/onboarding
- Dev (Lovable): https://attendant-analytics.lovable.app/onboarding
- Supabase: https://supabase.com/dashboard/project/yqdqmudsnjhixtxldqwi

## Fluxo de Email — Novo Comportamento (pós 09/03/2026)

**ANTES (removido):** Após signup → bloqueio "confirme seu e-mail" → só seguia após clicar no link
**AGORA:** Signup → IXC → Stripe checkout → **PostPaymentScreen** → email de boas-vindas via Resend → clicar link → primeiro acesso com ToS

- `mailer_autoconfirm = true` no Supabase: sem bloqueio de email durante o cadastro
- Email de boas-vindas é enviado pelo `stripe-webhook` após `checkout.session.completed`
- Link do email → `/configuracoes/perfil?new_account=1` → ToS modal aparece

## Conta Sandbox (Stripe TEST mode)

**IMPORTANTE:** `felipe@uniforce.com.br` é super_admin e **não pode testar o fluxo de onboarding** (wizard Steps 1-5). O guard de redirecionamento detecta `profile.isp_id='uniforce'` e envia direto para o dashboard.

### Para testar o FLUXO DE ONBOARDING (Steps 1-5):
Use um e-mail diferente de `@uniforce.com.br`, ex:
- `teste.provedor@gmail.com`
- Qualquer email de domínio diferente → será tratado como novo ISP

### ISP sandbox `uniforce-sandbox` (para testar billing TEST):
- Execute `payment-gateway/db/013_sandbox_isp.sql` no Supabase SQL Editor
- `felipe@uniforce.com.br` (super_admin) pode navegar para este ISP no dashboard
- Usa Stripe TEST keys (mesmo padrão do ISP `uniforce`)
- CNPJ: 60.293.381/0001-76

## Fluxo Principal: Email/Senha

1. Acessar `/onboarding` sem estar logado
2. Preencher: Nome Admin, Nome Provedor, CNPJ, E-mail, Telefone, Senha
3. Clicar "Criar conta e continuar"
4. Se email confirmation ativo: verificar caixa de entrada → clicar no link
5. Retornar a `/onboarding?confirmed=1` → Step 2 carrega automaticamente

## Fluxo Google OAuth

1. Acessar `/onboarding` sem estar logado
2. Clicar "Continuar com Google"
3. Selecionar conta Google
4. Retornar a `/onboarding?step=2&google=1` → formulário de complemento aparece
5. Preencher Nome do Provedor, CNPJ (nome e email vêm do Google)
6. Clicar "Continuar para Integração"

## Step 2 — Integração IXC

**Credenciais de teste (Zen-Telecom):**
- URL: Usar URL real de um IXC de teste
- Chave: `155:e5bc0ed55f06f0d2020c6597f9527632d8261a680a543e9e090279a48d5f5977`
- Formato exigido: `usuario:chave` (tudo junto no mesmo campo)

**Teste do Tutorial:**
- Clicar em "Como gerar minha chave API?"
- Lightbox deve abrir com 5 passos + imagens
- Fechar → retornar ao formulário com dados preservados

**Teste IP Blocking:**
- Marcar slider "Meu servidor IXC usa restrição de acesso por IP"
- Card de aviso deve aparecer
- Após criar ISP: verificar e-mail cadastrado para o email com IPs

**Validação:**
- Inserir credenciais → clicar "Testar Conexão"
- Se OK: mensagem verde + X clientes ativos
- Se Falha: mensagem de erro + botão "Continuar" permanece desabilitado

## Step 3 — Plano (após tela de confirmação)

- Selecionar plano → checkbox lock-in 3 meses → "Contratar"
- Redireciona para Stripe Checkout (mesma aba — não nova aba)
- Completar pagamento no Stripe Sandbox

**Pré-seleção via URL:**
- Acessar `/onboarding?plano=<price_id>` → Step 3 com plano pré-marcado

## Pós-Checkout — `/configuracoes/perfil`

- Toast "Assinatura ativada!" deve aparecer
- Modal de Termos de Serviço deve aparecer (bloqueante)
- Rolar até o fim → botão "Li e Aceito" habilita
- Aceitar → modal fecha
- Banner financeiro deve aparecer (se `financial_email` não cadastrado)
- Preencher e-mail + nome financeiro → salvar

## Verificações no Banco

```sql
-- Após criar ISP e aceitar ToS:
SELECT isp_id, onboarding_status, ip_blocking_requested,
       contract_accepted_at, tos_accepted_version, financial_email
FROM public.isps
WHERE isp_id = '<novo_isp_id>';

-- Aceites de ToS:
SELECT * FROM public.tos_acceptances
WHERE isp_id = '<novo_isp_id>';
```

## Credenciais de Edge Functions (para teste manual)

```bash
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
BASE="https://yqdqmudsnjhixtxldqwi.supabase.co/functions/v1"

# validate-erp-credentials (requer JWT)
curl -X POST "$BASE/validate-erp-credentials" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer <USER_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"erp_type":"ixc","base_url":"https://ixc.exemplo.com.br","api_key":"155","api_token":"e5bc0ed..."}'
```
