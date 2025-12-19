# Claude Code Uniforce

Projeto de integração do Claude Code com Supabase e Postman via API REST direta.

## Configuração

As credenciais estão no arquivo `.env`:

### Supabase
- `SUPABASE_URL`: URL do projeto
- `SUPABASE_SERVICE_ROLE_KEY`: Chave de service role
- `SUPABASE_ACCESS_TOKEN`: Token de acesso

### Postman
- `POSTMAN_API_KEY`: API Key do Postman
- `POSTMAN_WORKSPACE_ID`: ID do workspace
- `POSTMAN_COLLECTION_ID`: ID da collection principal

## Arquivos Disponíveis

### Supabase
- `list-tables.js` - Lista todas as tabelas e schemas
- `list-tables-clean.js` - Lista simplificada
- `list-tables-organized.js` - Lista organizada por tipo (tabelas, views, RPCs)

**Uso:**
```bash
node list-tables-organized.js
```

### Postman
- `postman-helper.js` - Helper com funções para acessar a API
- `test-postman.js` - Script de teste da integração

**Uso:**
```bash
node test-postman.js
```

## Funções Postman Disponíveis

```javascript
import {
  listCollections,
  getCollection,
  updateCollection,
  listEnvironments,
  getEnvironment,
  createRequest
} from './postman-helper.js';

// Listar collections
const collections = await listCollections();

// Obter collection específica
const collection = await getCollection(collectionId);

// Atualizar collection
await updateCollection(collectionId, collectionData);

// Listar environments
const environments = await listEnvironments();

// Obter environment específico
const environment = await getEnvironment(environmentId);

// Criar novo request
await createRequest(collectionId, requestData);
```

## Estrutura do Projeto

```
.
├── .env                      # Credenciais
├── .claude/
│   └── settings.local.json   # Config MCP (n8n, osascript, supabase)
├── package.json
├── list-tables*.js           # Scripts Supabase
├── postman-helper.js         # Helper Postman
├── test-postman.js           # Teste Postman
└── README.md                 # Este arquivo
```

## Benefícios da Abordagem Atual

1. **Economia de tokens**: Removido postman-mcp que consumia 53.5k tokens (26.7%)
2. **API direta**: Acesso via REST sem overhead de MCP
3. **Flexibilidade**: Funções customizadas para necessidades específicas
4. **Manutenibilidade**: Código simples e direto

## Collections Disponíveis

1. **API ISPBOX V2 - API Netonda**
2. **CLIENTES** (Principal) - Repositório de APIs dos Clientes Uniforce
   - D-Kiros
   - Winq
   - FiberSchool
   - NetOnda
3. **FORKS e TEMPLATES**
4. **Opa Suite API**

## Environments Disponíveis

1. Business Management API
2. Pipefy Env
3. Winq-Auth
4. Cloud API
