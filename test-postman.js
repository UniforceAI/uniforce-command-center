import { listCollections, getCollection, listEnvironments } from './postman-helper.js';

async function testPostmanAPI() {
  console.log('\n🧪 Testando Postman API\n');
  console.log('='.repeat(50));

  try {
    // Testa listagem de collections
    console.log('\n📚 Collections no workspace:');
    console.log('-'.repeat(50));
    const collections = await listCollections();

    if (collections && collections.length > 0) {
      collections.forEach((col, index) => {
        console.log(`  ${index + 1}. ${col.name}`);
        console.log(`     ID: ${col.uid}`);
      });
    } else {
      console.log('  Nenhuma collection encontrada.');
    }

    // Testa obtenção da collection principal
    console.log('\n📋 Detalhes da Collection principal:');
    console.log('-'.repeat(50));
    const collection = await getCollection();

    if (collection) {
      console.log(`  Nome: ${collection.info.name}`);
      console.log(`  ID: ${collection.info._postman_id}`);
      console.log(`  Descrição: ${collection.info.description || 'N/A'}`);

      if (collection.item && collection.item.length > 0) {
        console.log(`\n  📁 Pastas/Requests (${collection.item.length}):`);
        collection.item.slice(0, 5).forEach((item, index) => {
          console.log(`     ${index + 1}. ${item.name}`);
        });
        if (collection.item.length > 5) {
          console.log(`     ... e mais ${collection.item.length - 5} items`);
        }
      }
    }

    // Testa listagem de environments
    console.log('\n🌍 Environments no workspace:');
    console.log('-'.repeat(50));
    const environments = await listEnvironments();

    if (environments && environments.length > 0) {
      environments.forEach((env, index) => {
        console.log(`  ${index + 1}. ${env.name}`);
        console.log(`     ID: ${env.uid}`);
      });
    } else {
      console.log('  Nenhum environment encontrado.');
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ Teste concluído com sucesso!\n');

  } catch (error) {
    console.error('\n❌ Erro durante o teste:', error.message);
    console.error('\nDetalhes:', error);
  }
}

testPostmanAPI();
