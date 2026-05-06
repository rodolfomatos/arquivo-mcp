import { ArquivoClient } from './dist/client/ArquivoClient.js';

const client = new ArquivoClient({ timeoutMs: 120000, maxRetries: 4 });

console.log('Starting search for "Lisboa"...');
const start = Date.now();

try {
  const results = await client.searchFulltext({ query: 'Lisboa', maxItems: 5 });
  const elapsed = Date.now() - start;
  console.log(`SUCCESS after ${elapsed}ms`);
  console.log(`Got ${results.length} results`);
  console.log('First result:', results[0]);
} catch (err) {
  const elapsed = Date.now() - start;
  console.log(`ERROR after ${elapsed}ms: ${err.name}: ${err.message}`);
}
