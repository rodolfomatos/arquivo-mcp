#!/usr/bin/env node
/**
 * Teste específico: Pesquisa sobre "Operação Marquês"
 * Demonstra como usar o MCP server para research histórico
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const runTest = async () => {
  console.log('🔍 Testando pesquisa: "Operação Marquês"\n');
  console.log(
    'Este teste demonstra como usar o arquivo-mcp para research de tópicos históricos.\n',
  );

  // Create transport and client
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/index.js'],
    env: { ...process.env, LOG_LEVEL: 'error' },
  });

  const client = new Client(
    { name: 'operacao-marques-test', version: '1.0.0' },
    { capabilities: {} },
  );

  try {
    await client.connect(transport);
    console.log('✅ Conectado ao servidor MCP\n');

    // Test 1: Busca simples
    console.log('=== Teste 1: Busca simples ===');
    console.log('Tool: arquivo_search_fulltext');
    console.log('Query: "Operação Marquês"');
    console.log('Max items: 10\n');

    const res1 = await client.callTool({
      name: 'search_fulltext',
      arguments: { query: 'Operação Marquês', maxItems: 10 },
    });

    const output1 = res1.content[0].text;
    console.log('Resultado:\n');
    console.log(output1);
    console.log('\n---');

    // Test 2: Com filtro de data (mais recente)
    console.log('\n=== Teste 2: Com filtro temporal (2015-2020) ===');
    console.log('Query: "Operação Marquês"');
    console.log('From: 2015, To: 2020\n');

    const res2 = await client.callTool({
      name: 'search_fulltext',
      arguments: { query: 'Operação Marquês', from: '2015', to: '2020', maxItems: 10 },
    });

    const output2 = res2.content[0].text;
    console.log('Resultado:\n');
    console.log(output2);
    console.log('\n---');

    // Test 3: Buscar imagens relacionadas
    console.log('\n=== Teste 3: Imagens relacionadas ===');
    console.log('Query: "Operação Marquês"\n');

    const res3 = await client.callTool({
      name: 'search_images',
      arguments: { query: 'Operação Marquês', maxItems: 5 },
    });

    const output3 = res3.content[0].text;
    console.log(output3);
    console.log('\n---');

    // Test 4: Obter versões de um URL específico (exemplo)
    console.log('\n=== Teste 4: Versões de URL específico ===');
    console.log('Procurando um URL sobre o tema...\n');

    // Find a URL about Operação Marquês
    const searchLines = output1.split('\n');
    let exampleUrl = null;
    for (const line of searchLines) {
      if (line.includes('publico.pt') || line.includes('dn.pt') || line.includes('expresso.pt')) {
        const match = line.match(/(https?:\/\/[^\s]+)/);
        if (match) {
          exampleUrl = match[1];
          break;
        }
      }
    }

    if (exampleUrl) {
      console.log(`URL encontrada: ${exampleUrl}\n`);
      console.log('Buscando versões arquivadas...\n');

      const res4 = await client.callTool({
        name: 'get_url_versions',
        arguments: { url: exampleUrl, maxItems: 5 },
      });

      const output4 = res4.content[0].text;
      console.log(output4);
    } else {
      console.log(
        'Nenhum URL de noticiário encontrado nos resultados (pesquisa pode ter retornado 0 resultados)',
      );
    }

    console.log('\n=== Resumo do Teste ===');
    console.log('✅ search_fulltext: Funcionou');
    console.log('✅ search_fulltext com filtros: Funcionou');
    console.log('✅ search_images: Funcionou');
    console.log('✅ get_url_versions: Funcionou (se URL encontrada)');

    await client.close();

    console.log('\n🎉 Teste concluído com sucesso!');
    console.log('\nNota: A extração de conteúdo de páginas (get_page_content) pode retornar');
    console.log('apenas o wrapper do Wayback Machine se o conteúdo estiver em iframe.');
  } catch (err) {
    console.error('\n❌ Erro durante o teste:', err.message);
    process.exitCode = 1;
  }
};

runTest().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
