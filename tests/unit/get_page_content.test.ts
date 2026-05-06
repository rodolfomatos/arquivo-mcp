import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPageContentTool } from 'src/tools/get_page_content';
import type { ArquivoClient } from 'src/client/ArquivoClient';

describe('getPageContentTool', () => {
  let mockClient: Pick<ArquivoClient, 'fetchPage'>;

  beforeEach(() => {
    mockClient = {
      fetchPage: vi.fn(),
    };
  });

  it('should throw if archive_url is missing', async () => {
    await expect(
      getPageContentTool(mockClient as ArquivoClient, {
        archive_url: undefined as unknown as string,
      }),
    ).rejects.toThrow('Archive URL parameter is required');
  });

  it('should throw if archive_url is empty', async () => {
    await expect(
      getPageContentTool(mockClient as ArquivoClient, { archive_url: '' }),
    ).rejects.toThrow('Archive URL parameter is required');
  });

  it('should reject URLs not from arquivo.pt', async () => {
    await expect(
      getPageContentTool(mockClient as ArquivoClient, {
        archive_url: 'http://example.com/page',
      }),
    ).rejects.toThrow('Archive URL must be from arquivo.pt domain');
  });

  it('should accept valid arquivo.pt URLs', async () => {
    mockClient.fetchPage = vi.fn().mockResolvedValue({
      title: 'Title',
      content: 'Content',
      originalLength: 1000,
    });

    // Should not throw
    await getPageContentTool(mockClient as ArquivoClient, {
      archive_url: 'https://arquivo.pt/wayback/20200101/http://example.com/page',
    });
  });

  it('should clamp max_tokens between 100 and 16000', async () => {
    mockClient.fetchPage = vi.fn().mockResolvedValue({
      title: 'Title',
      content: 'Content',
      originalLength: 1000,
    });

    await getPageContentTool(mockClient as ArquivoClient, {
      archive_url: 'https://arquivo.pt/wayback/20200101/http://url.com',
      max_tokens: 20000,
    });
    expect(mockClient.fetchPage).toHaveBeenCalledWith(
      'https://arquivo.pt/wayback/20200101/http://url.com',
      16000,
    );

    await getPageContentTool(mockClient as ArquivoClient, {
      archive_url: 'https://arquivo.pt/wayback/20200101/http://url.com',
      max_tokens: 10,
    });
    expect(mockClient.fetchPage).toHaveBeenCalledWith(
      'https://arquivo.pt/wayback/20200101/http://url.com',
      100,
    );
  });

  it('should format output correctly', async () => {
    const fullContent = 'This is the page content.';
    mockClient.fetchPage = vi.fn().mockResolvedValue({
      title: 'Test Page',
      content: fullContent,
      originalLength: fullContent.length,
    });

    const result = await getPageContentTool(mockClient as ArquivoClient, {
      archive_url: 'https://arquivo.pt/wayback/20200101/http://test.com/page',
    });

    expect(result.content).toHaveLength(1);
    const text = result.content[0].text;
    expect(text).toContain(
      '[Conteúdo de: https://arquivo.pt/wayback/20200101/http://test.com/page — Test Page]',
    );
    expect(text).toContain('TÍTULO: Test Page');
    expect(text).toContain('TEXTO:\nThis is the page content.');
    expect(text).not.toContain('Truncado'); // not truncated
  });

  it('should indicate truncation when originalLength > content length', async () => {
    mockClient.fetchPage = vi.fn().mockResolvedValue({
      title: 'Long Page',
      content: 'Short content', // truncated
      originalLength: 50000,
    });

    const result = await getPageContentTool(mockClient as ArquivoClient, {
      archive_url: 'https://arquivo.pt/wayback/20200101/http://test.com/long',
    });

    const text = result.content[0].text;
    expect(text).toContain('Truncado');
    expect(text).toContain('Tamanho original: 48.8 KB');
  });

  it('should propagate errors with friendly message', async () => {
    mockClient.fetchPage = vi.fn().mockRejectedValue(new Error('Timeout'));

    await expect(
      getPageContentTool(mockClient as ArquivoClient, {
        archive_url: 'https://arquivo.pt/wayback/20200101/http://test.com',
      }),
    ).rejects.toThrow('Failed to fetch page content: Timeout');
  });
});
