import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchImagesTool } from 'src/tools/search_images';
import type { ArquivoClient } from 'src/client/ArquivoClient';

describe('searchImagesTool', () => {
  let mockClient: Pick<ArquivoClient, 'searchImages'>;

  beforeEach(() => {
    mockClient = {
      searchImages: vi.fn(),
    };
  });

  it('should throw if query is missing', async () => {
    await expect(
      searchImagesTool(mockClient as ArquivoClient, { query: undefined as unknown as string }),
    ).rejects.toThrow('Query parameter is required');
  });

  it('should throw if query is empty', async () => {
    await expect(searchImagesTool(mockClient as ArquivoClient, { query: '   ' })).rejects.toThrow(
      'Query parameter is required',
    );
  });

  it('should clamp maxItems between 1 and 20', async () => {
    mockClient.searchImages = vi.fn().mockResolvedValue([]);

    await searchImagesTool(mockClient as ArquivoClient, { query: 'test', maxItems: 30 });
    expect(mockClient.searchImages).toHaveBeenCalledWith(expect.objectContaining({ maxItems: 20 }));

    await searchImagesTool(mockClient as ArquivoClient, { query: 'test', maxItems: 0 });
    expect(mockClient.searchImages).toHaveBeenCalledWith(expect.objectContaining({ maxItems: 1 }));
  });

  it('should format results correctly', async () => {
    mockClient.searchImages = vi.fn().mockResolvedValue([
      {
        title: 'Test Image',
        imgLink: 'https://arquivo.pt/img.jpg',
        pageLink: 'http://example.com/page',
        tstamp: '20200101',
        width: 800,
        height: 600,
      },
    ]);

    const result = await searchImagesTool(mockClient as ArquivoClient, { query: 'test' });

    expect(result.content).toHaveLength(1);
    expect(result.content[0].text).toContain('[1 imagens para "test"]');
    expect(result.content[0].text).toContain('Test Image');
    expect(result.content[0].text).toContain('URL imagem: https://arquivo.pt/img.jpg');
    expect(result.content[0].text).toContain('Data: 2020-01-01');
    expect(result.content[0].text).toContain('Dimensões: 800x600');
  });

  it('should propagate errors with friendly message', async () => {
    mockClient.searchImages = vi.fn().mockRejectedValue(new Error('Network error'));

    await expect(searchImagesTool(mockClient as ArquivoClient, { query: 'test' })).rejects.toThrow(
      'Image search failed: Network error',
    );
  });
});
