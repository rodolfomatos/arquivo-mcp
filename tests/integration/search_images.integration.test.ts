import { describe, it, expect } from 'vitest';
import { ArquivoClient } from 'src/client/ArquivoClient';

describe('Integration: search_images', () => {
  it('should return image results for a query', async () => {
    const client = new ArquivoClient();
    const results = await client.searchImages({ query: 'Lisboa', maxItems: 5 });
    expect(Array.isArray(results)).toBe(true);
    if (results.length > 0) {
      const first = results[0];
      expect(first.title).toBeDefined();
      expect(first.imgLink).toBeDefined();
      expect(first.pageLink).toBeDefined();
      expect(first.tstamp).toBeDefined();
    }
  });
});
