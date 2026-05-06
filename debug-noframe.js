const url = 'https://arquivo.pt/noFrame/replay/20170303094741/https://www.publico.pt/2015/06/08/sociedade/noticia/os-arguidos-da-operacao-marques-1698356';

try {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'test-agent' }
  });
  const html = await res.text();
  console.log('HTML length:', html.length);
  // Look for article content markers
  console.log('Has <article>:', html.includes('<article'));
  console.log('Has class="content":', html.includes('class="content'));
  console.log('Has id="content":', html.includes('id="content'));
  console.log('Has <main>:', html.includes('<main'));
  // Count text nodes大概
  const textContent = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  console.log('Approx text length:', textContent.length);
  // Show first 500 chars of visible text
  console.log('Text preview:', textContent.substring(0, 500));
} catch (err) {
  console.error('Error:', err.message);
}
