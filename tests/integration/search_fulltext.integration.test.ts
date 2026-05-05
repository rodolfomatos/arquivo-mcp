import { describe, it, expect } from 'vitest';
import { ArquivoClient } from 'src/client/ArquivoClient';

describe('Integration: search_fulltext', () => {
  it('should return results for a simple query', async () => {
    const client = new ArquivoClient({ timeoutMs: 30000 }); // 30s for integration
    const results = await client.searchFulltext({ query: 'Portugal', maxItems: 5 });
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    const first = results[0];
    expect(first.title).toBeDefined();
    expect(first.link).toBeDefined();
    expect(first.archiveLink).toBeDefined();
    expect(first.snippet).toBeDefined();
    expect(first.tstamp).toBeDefined();
  }, 90000); // test timeout 90s
});
