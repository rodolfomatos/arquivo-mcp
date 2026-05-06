import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Create transport that spawns the server
const transport = new StdioClientTransport({
  command: 'node',
  args: ['dist/index.js'],
  env: { ...process.env, LOG_LEVEL: 'error' },
});

// Capture server stderr
transport.stderr?.on('data', (data) => {
  console.error(`[SERVER] ${data.toString()}`);
});

const client = new Client({ name: 'test-client', version: '0.0.1' }, { capabilities: {} });

try {
  await client.connect(transport);
  console.log('Connected to server');

  const toolsResult = await client.listTools();
  console.log(`Available tools: ${toolsResult.tools.map((t) => t.name).join(', ')}`);

  // Test search_fulltext with "Lisboa" (previously failed)
  console.log('\n=== Test 1: search_fulltext("Lisboa") ===');
  try {
    const result = await client.callTool({
      name: 'search_fulltext',
      arguments: { query: 'Lisboa', maxItems: 5 },
    });
    console.log('Success: content length', result.content?.[0]?.text?.length ?? 0);
  } catch (err) {
    console.error('FAILED:', err.message);
    console.error('Code:', err.code);
    console.error('Data:', err.data);
  }

  // Test search_fulltext with "Carnaval" (previously succeeded)
  console.log('\n=== Test 2: search_fulltext("Carnaval") ===');
  try {
    const result = await client.callTool({
      name: 'search_fulltext',
      arguments: { query: 'Carnaval', from: '2020', to: '2023', maxItems: 5 },
    });
    console.log('Success: content length', result.content?.[0]?.text?.length ?? 0);
  } catch (err) {
    console.error('FAILED:', err.message);
  }

  // Test get_url_versions with "www.dn.pt" (previously failed)
  console.log('\n=== Test 3: get_url_versions("www.dn.pt") ===');
  try {
    const result = await client.callTool({
      name: 'get_url_versions',
      arguments: { url: 'www.dn.pt', maxItems: 5 },
    });
    console.log('Success: content length', result.content?.[0]?.text?.length ?? 0);
  } catch (err) {
    console.error('FAILED:', err.message);
  }

  // Test get_page_content
  console.log('\n=== Test 4: get_page_content ===');
  try {
    // First get a valid archive URL
    const search = await client.callTool({
      name: 'search_fulltext',
      arguments: { query: 'arquivo.pt', maxItems: 1 },
    });
    const text = search.content[0].text;
    const urlMatch = text.match(/Arquivo:\s*(https?:\/\/[^\s]+)/);
    if (urlMatch) {
      const archiveUrl = urlMatch[1];
      console.log('Using archive URL:', archiveUrl);
      const result = await client.callTool({
        name: 'get_page_content',
        arguments: { archive_url: archiveUrl, max_tokens: 2000 },
      });
      console.log('Success: content length', result.content?.[0]?.text?.length ?? 0);
    } else {
      console.log('Could not extract archive URL from search results');
    }
  } catch (err) {
    console.error('FAILED:', err.message);
  }

  // Test search_images
  console.log('\n=== Test 5: search_images("Lisboa") ===');
  try {
    const result = await client.callTool({
      name: 'search_images',
      arguments: { query: 'Lisboa', maxItems: 5 },
    });
    console.log('Success: content length', result.content?.[0]?.text?.length ?? 0);
  } catch (err) {
    console.error('FAILED:', err.message);
  }
} catch (err) {
  console.error('Unexpected error:', err);
} finally {
  await client.close();
  // transport will close the server process
}
