import { TokenBucket } from '../utils/throttler.js';
import { retryWithBackoff, isRetryableError } from '../utils/retry.js';
import { stripHtml } from '../utils/html.js';
import { truncateToTokens } from '../utils/tokens.js';
import { logger } from '../utils/logger.js';
import { decodeResponse } from '../utils/encoding.js';
import * as cheerio from 'cheerio';

export interface SearchResult {
  title: string;
  link: string;
  archiveLink: string;
  snippet: string;
  tstamp: string;
  size?: number;
}

export interface Version {
  tstamp: string;
  status: number;
  link: string;
  size?: number;
}

export interface ImageResult {
  title: string;
  imgLink: string;
  pageLink: string;
  tstamp: string;
  width?: number;
  height?: number;
}

interface ApiItem {
  title?: string;
  link?: string;
  snippet?: string;
  tstamp?: string;
  size?: number;
  status?: number;
  imgLink?: string;
  pageLink?: string;
  width?: number;
  height?: number;
}

interface ApiResponse<T> {
  responseItems: T[];
}

const ARQUIVO_API_BASE = 'https://arquivo.pt';

export class ArquivoClient {
  private throttler: TokenBucket;
  private maxRetries: number;
  private timeoutMs: number;

  constructor(
    options: {
      maxRequestsPerSecond?: number;
      maxRetries?: number;
      timeoutMs?: number;
    } = {},
  ) {
    this.throttler = new TokenBucket(
      options.maxRequestsPerSecond ?? 1,
      1, // refill rate: 1 token per second
    );
    this.maxRetries = options.maxRetries ?? 2;
    this.timeoutMs = options.timeoutMs ?? 10000;
  }

  private async request<T>(endpoint: string, params: Record<string, unknown> = {}): Promise<T> {
    await this.throttler.consume();

    const url = new URL(`${ARQUIVO_API_BASE}${endpoint}`);
    Object.keys(params).forEach((key) => {
      const value = params[key];
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await retryWithBackoff(
        async () => {
          logger.debug('Making request', { url: url.toString() });
          const res = await fetch(url.toString(), {
            signal: controller.signal,
            headers: {
              'User-Agent': 'arquivo-mcp/0.1.0',
              Accept: 'application/json',
            },
          });

          if (!res.ok) {
            const error = new Error(`HTTP ${res.status} ${res.statusText}`);
            // @ts-expect-error — attaching status for retry logic
            error.response = { status: res.status };
            throw error;
          }

          return res.json() as Promise<T>;
        },
        this.maxRetries,
        1000,
        isRetryableError,
      );

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Fetch with retry and timeout, without throttling (caller must consume token).
   */
  private async fetchWithRetryAndTimeout(
    url: string,
    init?: RequestInit,
    timeoutMs?: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs ?? this.timeoutMs);
    try {
      return await retryWithBackoff(
        () => fetch(url, { ...init, signal: controller.signal }),
        this.maxRetries,
        1000,
        isRetryableError,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async searchFulltext(params: {
    query: string;
    from?: string;
    to?: string;
    site?: string;
    type?: string;
    maxItems?: number;
    offset?: number;
  }): Promise<SearchResult[]> {
    const data = await this.request<ApiResponse<ApiItem>>('/textsearch', {
      q: params.query,
      from: params.from,
      to: params.to,
      siteSearch: params.site,
      type: params.type,
      output: 'json',
      limit: Math.min(params.maxItems ?? 10, 50),
      offset: params.offset ?? 0,
    });

    const items = data.responseItems ?? [];
    return items.map((item) => ({
      title: item.title ?? '',
      link: item.link ?? '',
      archiveLink: this.buildArchiveLink(item.tstamp ?? '', item.link ?? ''),
      snippet: stripHtml(item.snippet ?? ''),
      tstamp: item.tstamp ?? '',
      size: item.size,
    }));
  }

  async getUrlVersions(params: {
    url: string;
    from?: string;
    to?: string;
    maxItems?: number;
    offset?: number;
  }): Promise<Version[]> {
    const data = await this.request<ApiResponse<ApiItem>>('/textsearch', {
      versionHistory: params.url,
      from: params.from,
      to: params.to,
      output: 'json',
      limit: Math.min(params.maxItems ?? 20, 100),
      offset: params.offset ?? 0,
    });

    const items = data.responseItems ?? [];
    return items.map((item) => ({
      tstamp: item.tstamp ?? '',
      status: item.status ?? 0,
      link: this.buildArchiveLink(item.tstamp ?? '', item.link ?? ''),
      size: item.size,
    }));
  }

  async searchImages(params: {
    query: string;
    from?: string;
    to?: string;
    maxItems?: number;
    offset?: number;
  }): Promise<ImageResult[]> {
    const data = await this.request<ApiResponse<ApiItem>>('/imagesearch', {
      q: params.query,
      from: params.from,
      to: params.to,
      output: 'json',
      limit: Math.min(params.maxItems ?? 10, 20),
      offset: params.offset ?? 0,
    });

    const items = data.responseItems ?? [];
    return items.map((item) => ({
      title: item.title ?? '',
      imgLink: item.imgLink ?? '',
      pageLink: item.pageLink ?? '',
      tstamp: item.tstamp ?? '',
      width: item.width,
      height: item.height,
    }));
  }

  /**
   * Fetch and extract text content from an archived page.
   * Now uses throttling, retry, and timeout for both fetches.
   */
  async fetchPage(
    archiveUrl: string,
    maxTokens?: number,
  ): Promise<{ title: string; content: string; originalLength: number }> {
    // First fetch: the archive page itself
    await this.throttler.consume();
    const res = await this.fetchWithRetryAndTimeout(archiveUrl, {
      headers: { 'User-Agent': 'arquivo-mcp/0.1.0' },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch archive page: HTTP ${res.status}`);
    }

    const html = await decodeResponse(res);
    const $ = cheerio.load(html);

    // Try to find the extracted text link
    const extractedLink =
      $('link[rel="archived text"]').attr('href') ||
      $('a[href*="linkToExtractedText"]').attr('href');

    let content: string;
    if (extractedLink) {
      // Second fetch: the extracted text version (also throttled)
      await this.throttler.consume();
      const extractedRes = await this.fetchWithRetryAndTimeout(extractedLink, {
        headers: { 'User-Agent': 'arquivo-mcp/0.1.0' },
      });

      if (extractedRes.ok) {
        content = await decodeResponse(extractedRes);
      } else {
        logger.warn('Extracted text fetch failed, falling back to HTML strip', {
          status: extractedRes.status,
        });
        content = stripHtml(html);
      }
    } else {
      content = stripHtml(html);
    }

    const title = $('title').text().trim() || 'Untitled';

    const maxTokensVal = maxTokens ?? 4000;
    const truncated = truncateToTokens(content, maxTokensVal);

    return {
      title,
      content: truncated,
      originalLength: content.length,
    };
  }

  private buildArchiveLink(tstamp: string, originalUrl: string): string {
    if (!tstamp) return originalUrl;
    return `https://arquivo.pt/wayback/${tstamp}/${originalUrl}`;
  }

  /**
   * Cleanly shut down the client (stop throttler intervals, etc.)
   */
  shutdown(): void {
    this.throttler.stop();
  }
}
