#!/usr/bin/env node
/**
 * Test specifically for "Lisboa" query with extended patience
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const run = async () => {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/index.js'],
    env: { ...process.env, LOG_LEVEL: 'error' },
  });

  const client = new Client({ name: 'test', version: '1.0' }, { capabilities: {} });

  await client.connect(transport);
  console.log('Testing search_fulltext("Lisboa", maxItems=5) with 90s timeout...\n');

  const timeoutMs = 90000; // custom longer timeout for this test
  // But we can't change client timeout via tool; it's internal. We'll just wait.

  try {
    const res = await client.callTool({
      name: 'search_fulltext',
      arguments: { query: 'Lisboa', maxItems: 5 },
    });
    console.log('SUCCESS! Content length:', res.content[0].text.length);
    console.log('\nPreview:\n', res.content[0].text.substring(0, 500));
  } catch (err) {
    console.log('FAILED:', err.message);
  }

  await client.close();
};

run().catch(console.error);
