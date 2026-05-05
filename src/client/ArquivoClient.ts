import { TokenBucket } from '../utils/throttler.js';
import { retryWithBackoff, isRetryableError } from '../utils/retry.js';
import { stripHtml } from '../utils/html.js';
import { truncateToTokens } from '../utils/tokens.js';
import { logger } from '../utils/logger.js';
import { decodeResponse } from '../utils/encoding.js';
import { HttpError } from '../utils/HttpError.js';
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

/**
 * Client for the Arquivo.pt (Portuguese web archive) API.
 * Provides search, version history, image search, and page content fetching.
 *
 * Features:
 * - Token bucket rate limiting to respect API boundaries
 * - Exponential backoff with jitter and Retry-After header support
 * - Request timeout AbortController
 * - Automatic HTML parsing and extracted text fallback
 *
 * Default rate: 1 request per second (rps), 2 retries, 10s timeout.
 */
export class ArquivoClient {
  private throttler: TokenBucket;
  private maxRetries: number;
  private timeoutMs: number;

  /**
   * Initialize the ArquivoClient with optional configuration.
   *
   * @param options.maxRequestsPerSecond - Rate limit (requests per second). Default: 1. Can also be set via MAX_REQUESTS_PER_SECOND env var.
   * @param options.maxRetries - Number of retry attempts on retryable errors. Default: 2.
   * @param options.timeoutMs - Request timeout in milliseconds. Default: 10000 (10s).
   *
   * Throttling: TokenBucket with refill rate = capacity (steady 1 token/sec).
   * Retry: Exponential backoff with 0.8–1.2 jitter; respects Retry-After header on 429.
   */
  constructor(
    options: {
      maxRequestsPerSecond?: number;
      maxRetries?: number;
      timeoutMs?: number;
    } = {},
  ) {
    const rps =
      options.maxRequestsPerSecond ??
      (typeof process.env.MAX_REQUESTS_PER_SECOND === 'string'
        ? parseInt(process.env.MAX_REQUESTS_PER_SECOND, 10)
        : undefined) ??
      1;
    // TokenBucket: capacity = rps tokens, refillRate = 1 token/sec (steady drip)
    this.throttler = new TokenBucket(rps, 1);
    this.maxRetries = options.maxRetries ?? 2;
    this.timeoutMs = options.timeoutMs ?? 10000;
  }

  /**
   * Make an authenticated GET request to the Arquivo.pt API.
   * Handles throttling, timeout, retries, and JSON parsing.
   *
   * @param endpoint - API endpoint path (e.g., '/textsearch')
   * @param params - Query parameters object; undefined/null values are omitted
   * @returns Parsed JSON response of type T
   * @throws HttpError for HTTP errors (4xx/5xx); other errors for network/timeouts
   *
   * @private Internal method; applies throttling automatically.
   */
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
            throw new HttpError(res.status, res.headers, `HTTP ${res.status} ${res.statusText}`);
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
   *
   * @param url - Target URL to fetch
   * @param init - Optional RequestInit for custom fetch options (headers, method, body)
   * @param timeoutMs - Override default timeout; uses instance default if omitted
   * @returns Response object on successful fetch (caller must check .ok)
   * @throws Error or AbortError on failure after retries or timeout
   *
   * @private Internal method; does not apply throttling. Caller must call throttler.consume() beforehand.
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

  /**
   * Perform a full-text search on the Portuguese web archive.
   *
   * @param params.query - Search query; supports "exact phrases" and -exclusions
   * @param params.from - Start date filter (YYYY or YYYYMMDDHHMMSS); optional
   * @param params.to - End date filter (YYYY or YYYYMMDDHHMMSS); optional
   * @param params.site - Limit to a specific domain (e.g., 'publico.pt')
   * @param params.type - MIME type filter (html, pdf, doc, etc.)
   * @param params.maxItems - Number of results; defaults to 10, capped at 50
   * @param params.offset - Pagination offset (default 0)
   * @returns Array of SearchResult with title, link, archiveLink, snippet, tstamp, optional size
   *
   * Note: Uses API limit parameter hard-capped at 50 to avoid excessive requests.
   */
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

  /**
   * List all archived versions of a specific URL.
   *
   * @param params.url - URL to look up (with or without protocol)
   * @param params.from - Start date filter (YYYY or YYYYMMDDHHMMSS); optional
   * @param params.to - End date filter (YYYY or YYYYMMDDHHMMSS); optional
   * @param params.maxItems - Number of versions; defaults to 20, capped at 100
   * @param params.offset - Pagination offset (default 0)
   * @returns Array of Version with tstamp, status, link, optional size
   *
   * Note: Uses /textsearch endpoint with versionHistory parameter; limit hard-capped at 100.
   */
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

  /**
   * Search for historical images in the Portuguese web archive.
   *
   * @param params.query - Search terms for images
   * @param params.from - Start date filter (YYYY or YYYYMMDDHHMMSS); optional
   * @param params.to - End date filter (YYYY or YYYYMMDDHHMMSS); optional
   * @param params.maxItems - Number of results; defaults to 10, capped at 20
   * @param params.offset - Pagination offset (default 0)
   * @returns Array of ImageResult with title, imgLink, pageLink, tstamp, optional width/height
   *
   * Note: Uses /imagesearch endpoint; limit hard-capped at 20 to avoid large responses.
   */
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
   * Performs two fetches: the archive HTML page, then optionally the extracted text file.
   * Applies throttling, retry, timeout, token truncation, and HTML parsing.
   *
   * @param archiveUrl - Full Arquivo.pt archive URL (must be from arquivo.pt)
   * @param maxTokens - Maximum tokens to return; defaults to 4000; truncated at word boundary
   * @returns Object with title, truncated content, and original full content length
   * @throws Error if archive page fetch fails or is not OK
   *
   * Side effects: logs warnings if extracted text fetch fails (falls back to HTML strip).
   * Throttling: consumes two tokens if extracted text is found, one otherwise.
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
