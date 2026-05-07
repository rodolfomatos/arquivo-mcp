import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArquivoClient } from 'src/client/ArquivoClient';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function createMockResponse(data: string | Record<string, unknown>, status = 200) {
  const buffer = new TextEncoder().encode(
    typeof data === 'string' ? data : JSON.stringify(data),
  ).buffer;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Map([['content-type', 'text/html; charset=utf-8']]),
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(typeof data === 'string' ? data : JSON.stringify(data)),
    arrayBuffer: vi.fn().mockResolvedValue(buffer),
  };
}

describe('ArquivoClient', () => {
  let client: ArquivoClient;

  beforeEach(() => {
    mockFetch.mockClear();
    client = new ArquivoClient({ maxRequestsPerSecond: 10 }); // faster for tests
  });

  describe('searchFulltext', () => {
    it('should call API with correct parameters', async () => {
      const mockData = {
        responseItems: [
          { title: 'Test', link: 'http://example.com', tstamp: '20200101', snippet: '...' },
        ],
      };
      mockFetch.mockResolvedValue(createMockResponse(mockData));

      const results = await client.searchFulltext({ query: 'test', maxItems: 5 });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const url = new URL(mockFetch.mock.calls[0][0]);
      expect(url.pathname).toBe('/textsearch');
      expect(url.searchParams.get('q')).toBe('test');
      expect(url.searchParams.get('limit')).toBe('5');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Test');
    });

    it('should clamp maxItems to 50', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ responseItems: [] }));

      await client.searchFulltext({ query: 'test', maxItems: 100 });

      const url = new URL(mockFetch.mock.calls[0][0]);
      expect(url.searchParams.get('limit')).toBe('50');
    });

    it('should handle empty responseItems', async () => {
      mockFetch.mockResolvedValue(createMockResponse({}));

      const results = await client.searchFulltext({ query: 'test' });

      expect(results).toEqual([]);
    });

    it('should strip HTML from snippet', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          responseItems: [{ title: 'T', link: 'l', tstamp: '20200101', snippet: '<p>Hello</p>' }],
        }),
      );

      const results = await client.searchFulltext({ query: 'test' });

      expect(results[0].snippet).toBe('Hello');
    });

    it('should build archive link with full tstamp', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          responseItems: [
            { title: 'T', link: 'http://example.com/page', tstamp: '20200101120000' },
          ],
        }),
      );

      const results = await client.searchFulltext({ query: 'test' });

      expect(results[0].archiveLink).toBe(
        'https://arquivo.pt/wayback/20200101120000/http://example.com/page',
      );
    });
  });

  describe('getUrlVersions', () => {
    it('should use versionHistory parameter', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          responseItems: [
            {
              tstamp: '20200101',
              status: 200,
              link: 'https://arquivo.pt/wayback/20200101/http://test.com',
            },
          ],
        }),
      );

      await client.getUrlVersions({ url: 'http://test.com' });

      const url = new URL(mockFetch.mock.calls[0][0]);
      expect(url.pathname).toBe('/textsearch');
      expect(url.searchParams.get('versionHistory')).toBe('http://test.com');
    });

    it('should clamp maxItems to 100', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ responseItems: [] }));

      await client.getUrlVersions({ url: 'http://test.com', maxItems: 200 });

      const url = new URL(mockFetch.mock.calls[0][0]);
      expect(url.searchParams.get('limit')).toBe('100');
    });
  });

  describe('searchImages', () => {
    it('should call /imagesearch', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          responseItems: [
            {
              title: 'img',
              imgLink: 'http://img.jpg',
              pageLink: 'http://page',
              tstamp: '20200101',
            },
          ],
        }),
      );

      await client.searchImages({ query: 'lisboa' });

      const url = new URL(mockFetch.mock.calls[0][0]);
      expect(url.pathname).toBe('/imagesearch');
      expect(url.searchParams.get('q')).toBe('lisboa');
    });

    it('should clamp maxItems to 20', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ responseItems: [] }));

      await client.searchImages({ query: 'test', maxItems: 30 });

      const url = new URL(mockFetch.mock.calls[0][0]);
      expect(url.searchParams.get('limit')).toBe('20');
    });
  });

  describe('fetchPage', () => {
    it('should fetch archive page and then extracted text', async () => {
      const archiveHtml = `<html><head><title>Test Page</title></head><body><p>Article</p><link rel="archived text" href="http://extracted.text"></body></html>`;
      const extractedText = `Extracted text content.`;
      mockFetch
        .mockResolvedValueOnce(createMockResponse(archiveHtml, 200))
        .mockResolvedValueOnce(createMockResponse(extractedText, 200));

      const result = await client.fetchPage(
        'http://arquivo.pt/wayback/20200101/http://example.com',
      );

      expect(result.title).toBe('Test Page');
      expect(result.content).toBe(extractedText);
    });

    it('should fallback to stripping HTML if extracted text not found', async () => {
      const archiveHtml = `<html><head><title>Page</title></head><body><p>Raw <b>HTML</b> content.</p></body></html>`;
      mockFetch.mockResolvedValue(createMockResponse(archiveHtml));

      const result = await client.fetchPage(
        'http://arquivo.pt/wayback/20200101/http://example.com',
      );

      expect(result.title).toBe('Page');
      expect(result.content).toContain('Raw HTML content.');
    });

    it('should truncate content to maxTokens', async () => {
      // 400 tokens * 4 = 1600 chars max; we create 5000 chars, expect truncation
      const longContent = 'A '.repeat(5000);
      const archiveHtml = `<html><head><title>Long</title></head><body><p>${longContent}</p></body></html>`;
      mockFetch.mockResolvedValue(createMockResponse(archiveHtml));

      const result = await client.fetchPage(
        'http://arquivo.pt/wayback/20200101/http://example.com',
        400,
      ); // ~1600 chars

expect(result.content.length).toBeLessThanOrEqual(1620);
    expect(result.content).toContain('...[truncated]');
  });

  it('should use parseArchiveUrl to build noFrame/replay URL when wrapper detected', async () => {
    const waybackHtml = `<html><head><title>Wrapped</title></head><body><div id="wm-ipp-base">toolbar</div><p>content</p></body></html>`;
    const noFrameHtml = `<html><head><title>Original</title></head><body><p>Original content.</p></body></html>`;
    mockFetch
      .mockResolvedValueOnce(createMockResponse(waybackHtml, 200))
      .mockResolvedValueOnce(createMockResponse(noFrameHtml, 200));

    const result = await client.fetchPage(
      'https://arquivo.pt/wayback/20230101120000/https://publico.pt/article/123',
    );

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const secondCallUrl = mockFetch.mock.calls[1][0] as string;
    expect(secondCallUrl).toContain('noFrame/replay');
    expect(secondCallUrl).toContain('20230101120000');
    expect(secondCallUrl).toContain('https://publico.pt/article/123');
    expect(result.content).toContain('Original content');
  });
});
});
