import { ArquivoClient } from './dist/client/ArquivoClient.js';

const client = new ArquivoClient();

const testUrls = [
  'https://arquivo.pt/wayback/20170303094741/https://www.publico.pt/2015/06/08/sociedade/noticia/os-arguidos-da-operacao-marques-1698356',
  'https://arquivo.pt/wayback/20200306174729/https://www.publico.pt/operacao-marques',
];

for (const url of testUrls) {
  console.log(`\n=== Testing: ${url} ===`);
  try {
    const result = await client.fetchPage(url, 12000); // 12k tokens
    console.log(`Title: ${result.title}`);
    console.log(`Content length: ${result.content.length} chars`);
    console.log(`Preview: ${result.content.substring(0, 500)}...`);
  } catch (err) {
    console.error(`Error: ${err.name}: ${err.message}`);
  }
}
