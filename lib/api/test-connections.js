#!/usr/bin/env node

/**
 * Script para testar todas as conexões de API
 */

import { supabase1API, supabase2API, postmanAPI, githubAPI } from './index.js';

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

async function testSupabase1() {
  log('\n📦 Testando Supabase Project 1 (bqljfrferpzkzwoxlnya)...', 'blue');

  try {
    // Fazer uma requisição simples ao REST API endpoint de status
    const response = await fetch('https://bqljfrferpzkzwoxlnya.supabase.co/rest/v1/', {
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxbGpmcmZlcnB6a3p3b3hsbnlhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODg5Nzc1MywiZXhwIjoyMDc0NDczNzUzfQ.SOHOZAPajPFR_opFN9ossLCZZhCOnHCgSTQOLemHz3A',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxbGpmcmZlcnB6a3p3b3hsbnlhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODg5Nzc1MywiZXhwIjoyMDc0NDczNzUzfQ.SOHOZAPajPFR_opFN9ossLCZZhCOnHCgSTQOLemHz3A'
      }
    });

    if (response.ok || response.status === 404 || response.status === 406) {
      log('✅ Supabase Project 1 conectado com sucesso!', 'green');
      log('   URL: https://bqljfrferpzkzwoxlnya.supabase.co', 'yellow');
      return true;
    } else {
      log(`❌ Erro na conexão: HTTP ${response.status}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Erro ao conectar: ${error.message}`, 'red');
    return false;
  }
}

async function testSupabase2() {
  log('\n📦 Testando Supabase Project 2 (yqdqmudsnjhixtxldqwi)...', 'blue');

  try {
    // Verificar se as credenciais estão configuradas
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
      log('❌ SUPABASE_URL ou SUPABASE_KEY não encontrados no .env', 'red');
      return false;
    }

    // Fazer uma requisição simples ao REST API endpoint de status
    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/`, {
      headers: {
        'apikey': process.env.SUPABASE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_KEY}`
      }
    });

    if (response.ok || response.status === 404 || response.status === 406) {
      log('✅ Supabase Project 2 conectado com sucesso!', 'green');
      log(`   URL: ${process.env.SUPABASE_URL}`, 'yellow');
      return true;
    } else {
      log(`❌ Erro na conexão: HTTP ${response.status}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Erro ao conectar: ${error.message}`, 'red');
    return false;
  }
}

async function testPostman() {
  log('\n📮 Testando Postman API...', 'blue');

  try {
    if (!process.env.POSTMAN_API_KEY) {
      log('⚠️  POSTMAN_API_KEY não encontrada no .env', 'yellow');
      log('   Adicione POSTMAN_API_KEY ao arquivo .env para usar a API do Postman', 'yellow');
      return null; // Null indica que não foi configurado, não que falhou
    }

    const workspaces = await postmanAPI.getWorkspaces();

    log('✅ Postman API conectada com sucesso!', 'green');
    log(`   Workspaces encontrados: ${workspaces.length}`, 'yellow');
    return true;
  } catch (error) {
    log(`❌ Erro ao conectar: ${error.message}`, 'red');
    return false;
  }
}

async function testGitHub() {
  log('\n🐙 Testando GitHub API...', 'blue');

  try {
    if (!process.env.GITHUB_TOKEN) {
      log('⚠️  GITHUB_TOKEN não encontrada no .env', 'yellow');
      log('   Adicione GITHUB_TOKEN ao arquivo .env para usar a API do GitHub', 'yellow');
      return null; // Null indica que não foi configurado, não que falhou
    }

    const user = await githubAPI.getAuthenticatedUser();

    log('✅ GitHub API conectada com sucesso!', 'green');
    log(`   Usuário: ${user.login}`, 'yellow');

    // Tentar obter repos da organização
    try {
      const org = process.env.GITHUB_ORG || 'uniforce';
      const repos = await githubAPI.getOrgRepos(org);
      log(`   Repositórios da org "${org}": ${repos.length}`, 'yellow');
    } catch (err) {
      // Silenciosamente ignorar erro de org
      const userRepos = await githubAPI.getUserRepos();
      log(`   Repositórios pessoais: ${userRepos.length}`, 'yellow');
    }

    return true;
  } catch (error) {
    log(`❌ Erro ao conectar: ${error.message}`, 'red');
    return false;
  }
}

async function runTests() {
  log('═══════════════════════════════════════════════════', 'bright');
  log('  🔌 TESTE DE CONEXÕES - API CLIENTS', 'bright');
  log('═══════════════════════════════════════════════════', 'bright');

  const results = {
    supabase1: await testSupabase1(),
    supabase2: await testSupabase2(),
    postman: await testPostman(),
    github: await testGitHub()
  };

  log('\n═══════════════════════════════════════════════════', 'bright');
  log('  📊 RESUMO DOS TESTES', 'bright');
  log('═══════════════════════════════════════════════════', 'bright');

  const formatResult = (result) => {
    if (result === true) return '✅ Conectado';
    if (result === false) return '❌ Falhou';
    return '⚠️  Não configurado';
  };

  log(`\nSupabase Project 1: ${formatResult(results.supabase1)}`);
  log(`Supabase Project 2: ${formatResult(results.supabase2)}`);
  log(`Postman API:        ${formatResult(results.postman)}`);
  log(`GitHub API:         ${formatResult(results.github)}`);

  const totalSuccess = Object.values(results).filter(r => r === true).length;
  const totalFailed = Object.values(results).filter(r => r === false).length;
  const totalNotConfigured = Object.values(results).filter(r => r === null).length;

  log('\n═══════════════════════════════════════════════════', 'bright');
  log(`Total: ${totalSuccess} conectado(s) | ${totalFailed} falha(s) | ${totalNotConfigured} não configurado(s)`, 'bright');
  log('═══════════════════════════════════════════════════\n', 'bright');

  // Retorna código de saída apropriado
  process.exit(totalFailed > 0 ? 1 : 0);
}

// Executar testes
runTests().catch(error => {
  log(`\n❌ Erro fatal: ${error.message}`, 'red');
  process.exit(1);
});
