import { describe, it, expect } from 'vitest';
import { ArquivoClient } from 'src/client/ArquivoClient';

describe('Integration: get_page_content', () => {
  it('should fetch content from an archived URL', async () => {
    const client = new ArquivoClient();
    const search = await client.searchFulltext({ query: 'Portugal', maxItems: 1 });
    expect(search.length).toBeGreaterThan(0);
    const archiveUrl = search[0].archiveLink;
    const content = await client.fetchPage(archiveUrl, 1000);
    expect(content.title).toBeDefined();
    expect(content.content).toBeDefined();
    expect(content.originalLength).toBeGreaterThan(0);
  });
});
