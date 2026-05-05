import { describe, it, expect } from 'vitest';
import { ArquivoClient } from 'src/client/ArquivoClient';

describe('Integration: get_url_versions', () => {
  it('should return versions for a known URL', async () => {
    const client = new ArquivoClient();
    const results = await client.getUrlVersions({ url: 'http://www.publico.pt', maxItems: 10 });
    expect(Array.isArray(results)).toBe(true);
    if (results.length > 0) {
      const first = results[0];
      expect(first.tstamp).toBeDefined();
      expect(first.status).toBeDefined();
      expect(first.link).toBeDefined();
    }
  });
});
