#!/usr/bin/env node
/**
 * Demonstration Test Runner
 * Executes all tests from docs/DEMONSTRATION.md and reports results
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const runTest = async () => {
  const results = [];

  console.log('🚀 Iniciando testes de demonstração...\n');

  // Spawn server for testing
  const { spawn } = await import('child_process');
  const server = spawn('node', ['dist/index.js'], {
    env: { ...process.env, LOG_LEVEL: 'error' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';
  server.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  // Wait for server to initialize
  await new Promise((resolve) => setTimeout(resolve, 2500));

  if (server.exitCode !== null) {
    console.error('❌ Server failed to start:', stderr);
    process.exit(1);
  }

  // Create transport and client
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/index.js'],
    env: process.env, // Use current environment, including LOG_LEVEL if set
  });

  const client = new Client({ name: 'demo-test-runner', version: '1.0.0' }, { capabilities: {} });

  try {
    await client.connect(transport);
    console.log('✅ Connected to MCP server\n');

    // Test 1.1: search_fulltext("Lisboa")
    console.log('Teste 1.1: search_fulltext(query="Lisboa", maxItems=5)');
    try {
      const res = await client.callTool({
        name: 'search_fulltext',
        arguments: { query: 'Lisboa', maxItems: 5 },
      });
      console.log(`   ✅ Sucesso: ${res.content[0].text.length} chars`);
      results.push({ test: '1.1', status: '✅' });
    } catch (err) {
      console.log(`   ❌ Falhou: ${err.message}`);
      results.push({ test: '1.1', status: '❌', error: err.message });
    }

    // Test 1.2: search_fulltext("Carnaval", from="2020", to="2023")
    console.log(
      '\nTeste 1.2: search_fulltext(query="Carnaval", from="2020", to="2023", maxItems=5)',
    );
    try {
      const res = await client.callTool({
        name: 'search_fulltext',
        arguments: { query: 'Carnaval', from: '2020', to: '2023', maxItems: 5 },
      });
      console.log(`   ✅ Sucesso: ${res.content[0].text.length} chars`);
      results.push({ test: '1.2', status: '✅' });
    } catch (err) {
      console.log(`   ❌ Falhou: ${err.message}`);
      results.push({ test: '1.2', status: '❌', error: err.message });
    }

    // Test 1.3: search_fulltext with site filter
    console.log(
      '\nTeste 1.3: search_fulltext(query="tecnologia -smartphone", site="publico.pt", maxItems=5)',
    );
    try {
      const res = await client.callTool({
        name: 'search_fulltext',
        arguments: { query: 'tecnologia -smartphone', site: 'publico.pt', maxItems: 5 },
      });
      console.log(`   ✅ Sucesso: ${res.content[0].text.length} chars`);
      results.push({ test: '1.3', status: '✅' });
    } catch (err) {
      console.log(`   ❌ Falhou: ${err.message}`);
      results.push({ test: '1.3', status: '❌', error: err.message });
    }

    // Test 1.4: search_fulltext with type="pdf"
    console.log('\nTeste 1.4: search_fulltext(query="relatório", type="pdf", maxItems=3)');
    try {
      const res = await client.callTool({
        name: 'search_fulltext',
        arguments: { query: 'relatório', type: 'pdf', maxItems: 3 },
      });
      console.log(`   ✅ Sucesso: ${res.content[0].text.length} chars`);
      results.push({ test: '1.4', status: '✅' });
    } catch (err) {
      console.log(`   ❌ Falhou: ${err.message}`);
      results.push({ test: '1.4', status: '❌', error: err.message });
    }

    // Test 2.1: get_url_versions("publico.pt")
    console.log('\nTeste 2.1: get_url_versions(url="publico.pt", maxItems=10)');
    try {
      const res = await client.callTool({
        name: 'get_url_versions',
        arguments: { url: 'publico.pt', maxItems: 10 },
      });
      console.log(`   ✅ Sucesso: ${res.content[0].text.length} chars`);
      results.push({ test: '2.1', status: '✅' });
    } catch (err) {
      console.log(`   ❌ Falhou: ${err.message}`);
      results.push({ test: '2.1', status: '❌', error: err.message });
    }

    // Test 2.2: get_url_versions("www.dn.pt", from="2020-01-01", to="2023-12-31")
    console.log(
      '\nTeste 2.2: get_url_versions(url="www.dn.pt", from="2020-01-01", to="2023-12-31", maxItems=5)',
    );
    try {
      const res = await client.callTool({
        name: 'get_url_versions',
        arguments: { url: 'www.dn.pt', from: '2020-01-01', to: '2023-12-31', maxItems: 5 },
      });
      console.log(`   ✅ Sucesso: ${res.content[0].text.length} chars`);
      results.push({ test: '2.2', status: '✅' });
    } catch (err) {
      console.log(`   ❌ Falhou: ${err.message}`);
      results.push({ test: '2.2', status: '❌', error: err.message });
    }

    // Test 3.1: get_page_content
    console.log('\nTeste 3.1: get_page_content with real archive URL');
    try {
      const searchRes = await client.callTool({
        name: 'search_fulltext',
        arguments: { query: 'publico.pt', maxItems: 1 },
      });
      const text = searchRes.content[0].text;
      const urlMatch = text.match(/Arquivo:\s*(https?:\/\/[^\s]+)/);
      if (urlMatch) {
        const archiveUrl = urlMatch[1];
        console.log(`   Using URL: ${archiveUrl}`);
        const res = await client.callTool({
          name: 'get_page_content',
          arguments: { archive_url: archiveUrl, max_tokens: 2000 },
        });
        console.log(`   ✅ Sucesso: ${res.content[0].text.length} chars`);
        results.push({ test: '3.1', status: '✅' });
      } else {
        console.log(`   ⚠️ Nenhum URL na resposta (pesquisa retornou 0 resultados?)`);
        results.push({ test: '3.1', status: '⚠️', error: 'No archive URL in response' });
      }
    } catch (err) {
      console.log(`   ❌ Falhou: ${err.message}`);
      results.push({ test: '3.1', status: '❌', error: err.message });
    }

    // Test 4.1: search_images("Lisboa")
    console.log('\nTeste 4.1: search_images(query="Lisboa", maxItems=5)');
    try {
      const res = await client.callTool({
        name: 'search_images',
        arguments: { query: 'Lisboa', maxItems: 5 },
      });
      console.log(`   ✅ Sucesso: ${res.content[0].text.length} chars`);
      results.push({ test: '4.1', status: '✅' });
    } catch (err) {
      console.log(`   ❌ Falhou: ${err.message}`);
      results.push({ test: '4.1', status: '❌', error: err.message });
    }

    // Test 4.2: search_images("futebol", from="2010", to="2015")
    console.log('\nTeste 4.2: search_images(query="futebol", from="2010", to="2015", maxItems=5)');
    try {
      const res = await client.callTool({
        name: 'search_images',
        arguments: { query: 'futebol', from: '2010', to: '2015', maxItems: 5 },
      });
      console.log(`   ✅ Sucesso: ${res.content[0].text.length} chars`);
      results.push({ test: '4.2', status: '✅' });
    } catch (err) {
      console.log(`   ❌ Falhou: ${err.message}`);
      results.push({ test: '4.2', status: '❌', error: err.message });
    }

    // Workflow (end-to-end)
    console.log('\n--- Workflow End-to-End ---');

    // Step 1: search_fulltext("Sintra", from="2023", to="2023")
    console.log(
      '\nWorkflow Step 1: search_fulltext(query="Sintra", from="2023", to="2023", maxItems=3)',
    );
    let workflowUrl = null;
    try {
      const res = await client.callTool({
        name: 'search_fulltext',
        arguments: { query: 'Sintra', from: '2023', to: '2023', maxItems: 3 },
      });
      const text = res.content[0].text;
      const urlMatch = text.match(/Arquivo:\s*(https?:\/\/[^\s]+)/);
      if (urlMatch) {
        workflowUrl = urlMatch[1];
        console.log(`   ✅ Sucesso: URL encontrada`);
        results.push({ test: 'W1', status: '✅' });
      } else {
        console.log(`   ⚠️ Nenhum resultado para "Sintra" em 2023`);
        results.push({ test: 'W1', status: '⚠️', error: 'No results' });
      }
    } catch (err) {
      console.log(`   ❌ Falhou: ${err.message}`);
      results.push({ test: 'W1', status: '❌', error: err.message });
    }

    // Step 2: get_url_versions with the found URL
    if (workflowUrl) {
      console.log(`\nWorkflow Step 2: get_url_versions(url="${workflowUrl}", maxItems=5)`);
      try {
        const res = await client.callTool({
          name: 'get_url_versions',
          arguments: { url: workflowUrl, maxItems: 5 },
        });
        console.log(`   ✅ Sucesso: ${res.content[0].text.length} chars`);
        results.push({ test: 'W2', status: '✅' });

        // Step 3: get_page_content - would need specific version, skip for demo
        console.log(`\nWorkflow Step 3: get_page_content (skip - needs specific version)`);
        results.push({ test: 'W3', status: '⚠️', error: 'Skipped' });

        // Step 4: search_images("Sintra")
        console.log(`\nWorkflow Step 4: search_images(query="Sintra", maxItems=3)`);
        try {
          const res = await client.callTool({
            name: 'search_images',
            arguments: { query: 'Sintra', maxItems: 3 },
          });
          console.log(`   ✅ Sucesso: ${res.content[0].text.length} chars`);
          results.push({ test: 'W4', status: '✅' });
        } catch (err) {
          console.log(`   ❌ Falhou: ${err.message}`);
          results.push({ test: 'W4', status: '❌', error: err.message });
        }
      } catch (err) {
        console.log(`   ❌ Falhou: ${err.message}`);
        results.push({ test: 'W2', status: '❌', error: err.message });
        results.push({ test: 'W3', status: '⚠️', error: 'Skipped due to W2' });
        results.push({ test: 'W4', status: '⚠️', error: 'Skipped due to W2' });
      }
    } else {
      console.log(`\nWorkflow Steps 2-4: Skipped (no URL from Step 1)`);
      results.push({ test: 'W2', status: '⚠️', error: 'Skipped' });
      results.push({ test: 'W3', status: '⚠️', error: 'Skipped' });
      results.push({ test: 'W4', status: '⚠️', error: 'Skipped' });
    }

    await client.close();
  } catch (err) {
    console.error('\n❌ Fatal error:', err);
    process.exitCode = 1;
  } finally {
    server.kill();
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('RESUMO DOS TESTES');
  console.log('='.repeat(50));

  const total = results.length;
  const passed = results.filter((r) => r.status === '✅').length;
  const partial = results.filter((r) => r.status === '⚠️').length;
  const failed = results.filter((r) => r.status === '❌').length;

  console.log(`Total:  ${total}`);
  console.log(`Sucesso: ${passed}`);
  console.log(`Parcial: ${partial}`);
  console.log(`Falha:   ${failed}`);
  console.log('');

  if (failed === 0 && partial === 0) {
    console.log('🎉 TODOS OS TESTES PASSARAM!');
  } else if (failed === 0) {
    console.log('✨ Testes principais OK, alguns avisos não-críticos');
  } else {
    console.log('⚠️ Alguns testes falharam');
    process.exitCode = 1;
  }
};

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Usage: node run-demo-tests.js');
  console.log('');
  console.log('Executes all tests from docs/DEMONSTRATION.md and reports results.');
  console.log('');
  console.log('Requires:');
  console.log('  - Built dist/ directory (run "npm run build" first)');
  console.log('  - MCP SDK installed (npm ci)');
  console.log('  - Internet connection (tests hit real Arquivo.pt API)');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
