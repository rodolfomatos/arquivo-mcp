#!/usr/bin/env node
/**
 * Direct test of Arquivo.pt textsearch API with timing
 */
const url = new URL('https://arquivo.pt/textsearch');
url.searchParams.set('q', 'Lisboa');
url.searchParams.set('output', 'json');
url.searchParams.set('limit', '5');
url.searchParams.set('offset', '0');

const controller = new AbortController();
const timeoutMs = 60000;

const timeout = setTimeout(() => {
  console.log(`[TIMEOUT] Aborting after ${timeoutMs}ms`);
  controller.abort();
}, timeoutMs);

console.log(`Starting fetch: ${url.toString()}`);
const start = Date.now();

fetch(url.toString(), {
  signal: controller.signal,
  headers: {
    'User-Agent': 'test-lisboa/1.0',
    Accept: 'application/json',
  },
})
  .then((res) => {
    clearTimeout(timeout);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    return res.json();
  })
  .then((data) => {
    const elapsed = Date.now() - start;
    console.log(`SUCCESS in ${elapsed}ms`);
    console.log('Results:', (data.response_items || data.responseItems || []).length);
  })
  .catch((err) => {
    const elapsed = Date.now() - start;
    console.log(`ERROR after ${elapsed}ms: ${err.name}: ${err.message}`);
  });
