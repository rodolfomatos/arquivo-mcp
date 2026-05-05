import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchFulltextTool, getUrlVersionsTool } from 'src/tools/index';
import type { ArquivoClient } from 'src/client/ArquivoClient';

describe('searchFulltextTool', () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      searchFulltext: vi.fn(),
    };
  });

  it('should throw if query is missing', async () => {
    await expect(searchFulltextTool(mockClient, {} as any)).rejects.toThrow(
      'Query parameter is required',
    );
  });

  it('should throw if query is empty', async () => {
    await expect(searchFulltextTool(mockClient, { query: '   ' })).rejects.toThrow(
      'Query parameter is required',
    );
  });

  it('should clamp maxItems between 1 and 50', async () => {
    mockClient.searchFulltext = vi.fn().mockResolvedValue([]);

    await searchFulltextTool(mockClient, { query: 'test', maxItems: 100 });
    expect(mockClient.searchFulltext).toHaveBeenCalledWith(
      expect.objectContaining({ maxItems: 50 }),
    );

    await searchFulltextTool(mockClient, { query: 'test', maxItems: 0 });
    expect(mockClient.searchFulltext).toHaveBeenCalledWith(
      expect.objectContaining({ maxItems: 1 }),
    );
  });

  it('should format results correctly', async () => {
    mockClient.searchFulltext = vi.fn().mockResolvedValue([
      {
        title: 'Result 1',
        link: 'http://example.com/1',
        archiveLink: 'https://arquivo.pt/wayback/20200101/http://example.com/1',
        snippet: 'Snippet 1',
        tstamp: '20200101120000',
      },
    ]);

    const result = await searchFulltextTool(mockClient, { query: 'test' });

    expect(result.content).toHaveLength(1);
    expect(result.content[0].text).toContain('[1 resultados para "test"]');
    expect(result.content[0].text).toContain('Result 1');
    expect(result.content[0].text).toContain('example.com');
    expect(result.content[0].text).toContain('2020-01-01');
  });

  it('should propagate errors with friendly message', async () => {
    mockClient.searchFulltext = vi.fn().mockRejectedValue(new Error('Network error'));

    await expect(searchFulltextTool(mockClient, { query: 'test' })).rejects.toThrow(
      'Search failed: Network error',
    );
  });
});

describe('getUrlVersionsTool', () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      getUrlVersions: vi.fn(),
    };
  });

  it('should throw if url is missing', async () => {
    await expect(getUrlVersionsTool(mockClient, {} as any)).rejects.toThrow(
      'URL parameter is required',
    );
  });

  it('should throw if url is empty', async () => {
    await expect(getUrlVersionsTool(mockClient, { url: '' } as any)).rejects.toThrow(
      'URL parameter is required',
    );
  });

  it('should clamp maxItems between 1 and 100', async () => {
    mockClient.getUrlVersions = vi.fn().mockResolvedValue([]);

    await getUrlVersionsTool(mockClient, { url: 'http://test.com', maxItems: 200 });
    expect(mockClient.getUrlVersions).toHaveBeenCalledWith(
      expect.objectContaining({ maxItems: 100 }),
    );

    await getUrlVersionsTool(mockClient, { url: 'http://test.com', maxItems: 0 });
    expect(mockClient.getUrlVersions).toHaveBeenCalledWith(
      expect.objectContaining({ maxItems: 1 }),
    );
  });

  it('should format version list correctly', async () => {
    mockClient.getUrlVersions = vi.fn().mockResolvedValue([
      {
        tstamp: '20200101120000',
        status: 200,
        link: 'https://arquivo.pt/wayback/20200101/http://test.com',
        size: 20480,
      },
    ]);

    const result = await getUrlVersionsTool(mockClient, { url: 'http://test.com' });

    expect(result.content).toHaveLength(1);
    expect(result.content[0].text).toContain('[1 versões arquivadas de http://test.com]');
    expect(result.content[0].text).toContain('2020-01-01 — HTTP 200');
    expect(result.content[0].text).toContain('Tamanho: 20.0 KB');
  });
});
