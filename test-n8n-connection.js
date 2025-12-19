#!/usr/bin/env node

/**
 * Script para testar conexão com n8n via Cloudflare Access
 */

import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testN8nConnection() {
  log('\n═══════════════════════════════════════════════════', 'bright');
  log('  🔌 TESTE DE CONEXÃO - N8N API', 'bright');
  log('═══════════════════════════════════════════════════', 'bright');

  log('\n🔧 Testando n8n API...', 'blue');

  try {
    // Verificar se as credenciais estão configuradas
    if (!process.env.N8N_API_URL) {
      log('❌ N8N_API_URL não encontrada no .env', 'red');
      return false;
    }

    if (!process.env.N8N_API_KEY) {
      log('❌ N8N_API_KEY não encontrada no .env', 'red');
      return false;
    }

    if (!process.env.CF_CLIENT_ID || !process.env.CF_CLIENT_SECRET) {
      log('❌ Credenciais do Cloudflare Access não encontradas no .env', 'red');
      return false;
    }

    log(`\n📍 URL: ${process.env.N8N_API_URL}`, 'yellow');
    log('🔐 Usando autenticação via Cloudflare Access...', 'yellow');

    // Tentar acessar a API do n8n
    const response = await axios.get(`${process.env.N8N_API_URL}/api/v1/workflows`, {
      headers: {
        'X-N8N-API-KEY': process.env.N8N_API_KEY,
        'CF-Access-Client-Id': process.env.CF_CLIENT_ID,
        'CF-Access-Client-Secret': process.env.CF_CLIENT_SECRET
      },
      params: {
        limit: 1
      },
      validateStatus: () => true // Aceita qualquer status para análise
    });

    if (response.status === 200) {
      log('\n✅ n8n API conectada com sucesso!', 'green');
      log(`   Total de workflows: ${response.data.data?.length || 0}`, 'yellow');
      log(`   Status HTTP: ${response.status}`, 'yellow');
      return true;
    } else if (response.status === 401 || response.status === 403) {
      log('\n❌ Falha na autenticação', 'red');
      log(`   Status HTTP: ${response.status}`, 'yellow');
      log('   Verifique se as credenciais do Cloudflare Access estão corretas', 'yellow');
      return false;
    } else {
      log(`\n⚠️  Resposta inesperada do servidor`, 'yellow');
      log(`   Status HTTP: ${response.status}`, 'yellow');

      // Se a resposta for HTML (página de login do Cloudflare)
      if (response.headers['content-type']?.includes('text/html')) {
        log('   Resposta em HTML detectada - provavelmente página de login do Cloudflare Access', 'yellow');
        log('   As credenciais de Service Token podem estar incorretas ou expiradas', 'yellow');
      }

      return false;
    }
  } catch (error) {
    log(`\n❌ Erro ao conectar: ${error.message}`, 'red');

    if (error.code === 'ENOTFOUND') {
      log('   O servidor não pôde ser encontrado. Verifique a URL.', 'yellow');
    } else if (error.code === 'ECONNREFUSED') {
      log('   Conexão recusada. O servidor pode estar offline.', 'yellow');
    }

    return false;
  }
}

async function runTests() {
  const result = await testN8nConnection();

  log('\n═══════════════════════════════════════════════════', 'bright');
  log('  📊 RESULTADO DO TESTE', 'bright');
  log('═══════════════════════════════════════════════════', 'bright');

  log(`\nn8n API: ${result ? '✅ Conectado' : '❌ Falhou'}`);

  log('\n═══════════════════════════════════════════════════\n', 'bright');

  process.exit(result ? 0 : 1);
}

// Executar teste
runTests().catch(error => {
  log(`\n❌ Erro fatal: ${error.message}`, 'red');
  process.exit(1);
});
