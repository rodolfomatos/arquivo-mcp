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
  originalURL?: string;
  snippet?: string;
  tstamp?: string;
  contentLength?: number;
  size?: number;
  status?: number;
  // Image search fields (API response)
  pageTitle?: string[];
  imgTitle?: string[];
  imgAlt?: string[];
  imgSrc?: string;
  imgLinkToArchive?: string;
  pageURL?: string;
  pageLinkToArchive?: string;
  imgTstamp?: string;
  pageTstamp?: string;
  imgWidth?: number;
  imgHeight?: number;
  // Legacy fields
  imgLink?: string;
  linkToArchive?: string;
  pageLink?: string;
  width?: number;
  height?: number;
}

interface ApiResponse<T> {
  response_items?: T[];
  responseItems?: T[]; // Legacy support
}

const ARQUIVO_API_BASE = 'https://arquivo.pt';

/**
 * Client for the Arquivo.pt (Portuguese web archive) API.
 * Provides search, version history, image search, and page content fetching.
 *
 * Features:
 * - Token bucket rate limiting to respect API boundaries
 * - Exponential backoff with jitter and Retry-After header support
 * - Request timeout with adaptive duration based on expected payload
 * - Automatic HTML parsing and extracted text fallback
 * - HTTP keep-alive for connection reuse (when supported)
 *
 * Default rate: 1 request per second (rps), 4 retries, 120s timeout (adaptive: max(base, 30s + maxItems×600ms), clamped 30–180s).
 */
export class ArquivoClient {
  private throttler: TokenBucket;
  private maxRetries: number;
  private timeoutMs: number;

  /**
   * Initialize the ArquivoClient with optional configuration.
   *
   * @param options.maxRequestsPerSecond - Rate limit (requests per second). Default: 1. Can also be set via MAX_REQUESTS_PER_SECOND env var.
   * @param options.maxRetries - Number of retry attempts on retryable errors. Default: 4.
   * @param options.timeoutMs - Request timeout in milliseconds. Default: 120000 (120s). Adaptive: actual = max(base, 30s + maxItems×600ms), clamped 30-180s.
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
    this.maxRetries = options.maxRetries ?? 4;
    this.timeoutMs = options.timeoutMs ?? 120000;
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

    const urlStr = url.toString();

    // Adaptive timeout: ensure at least the configured base timeout, but scale up for large result sets
    // Formula: base timeout (this.timeoutMs) as minimum, plus 600ms per maxItem beyond a threshold
    // Clamp: 30s minimum, 120s maximum
    const items = (params.maxItems as number | undefined) ?? 10;
    const adaptiveTimeout = 30000 + items * 600; // linear scaling
    const effectiveTimeout = Math.min(120000, Math.max(this.timeoutMs, adaptiveTimeout));

    try {
      const response = await retryWithBackoff(
        async () => {
          const start = Date.now();
          logger.debug('Making request', { url: urlStr, timeout: effectiveTimeout });
          const controller = new AbortController();
          const attemptTimeout = setTimeout(() => {
            logger.debug('Timeout firing', { url: urlStr, timeout: effectiveTimeout });
            controller.abort();
          }, effectiveTimeout);
          try {
            const res = await fetch(urlStr, {
              signal: controller.signal,
              headers: {
                'User-Agent': 'arquivo-mcp/0.1.0',
                Accept: 'application/json',
              },
              keepalive: true,
            });

            if (!res.ok) {
              throw new HttpError(res.status, res.headers, `HTTP ${res.status} ${res.statusText}`);
            }

            const data = await res.json();
            const elapsed = Date.now() - start;
            logger.debug('Request succeeded', { url: urlStr, elapsedMs: elapsed });
            return data;
          } catch (err) {
            const elapsed = Date.now() - start;
            logger.debug('Fetch error', {
              url: urlStr,
              error: err instanceof Error ? err.message : String(err),
              errorName: err instanceof Error ? err.name : undefined,
              elapsedMs: elapsed,
            });
            throw err;
          } finally {
            clearTimeout(attemptTimeout);
          }
        },
        this.maxRetries,
        2000,
        isRetryableError,
      );

      return response;
    } catch (error) {
      logger.error('Request failed', { url: urlStr, error: String(error) });
      throw error;
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
    const timeout = timeoutMs ?? this.timeoutMs;

    try {
      return await retryWithBackoff(
        () => {
          const controller = new AbortController();
          const attemptTimeout = setTimeout(() => controller.abort(), timeout);
          return fetch(url, { ...init, signal: controller.signal }).finally(() => {
            clearTimeout(attemptTimeout);
          });
        },
        this.maxRetries,
        1000,
        isRetryableError,
      );
    } catch (error) {
      logger.error('Fetch failed', { url, error: String(error) });
      throw error;
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

    const items = data.response_items ?? data.responseItems ?? [];
    return items.map((item) => ({
      title: item.title ?? '',
      link: item.originalURL ?? item.link ?? '',
      archiveLink: this.buildArchiveLink(item.tstamp ?? '', item.originalURL ?? item.link ?? ''),
      snippet: stripHtml(item.snippet ?? ''),
      tstamp: item.tstamp ?? '',
      size: item.contentLength ?? item.size,
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
    try {
      const urlToCheck = params.url.includes('://') ? params.url : `http://${params.url}`;
      const parsed = new URL(urlToCheck);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch {
      throw new Error(`Invalid URL: ${params.url}`);
    }
    const data = await this.request<ApiResponse<ApiItem>>('/textsearch', {
      versionHistory: params.url,
      from: params.from,
      to: params.to,
      output: 'json',
      limit: Math.min(params.maxItems ?? 20, 100),
      offset: params.offset ?? 0,
    });

    const items = data.response_items ?? data.responseItems ?? [];
    return items.map((item) => ({
      tstamp: item.tstamp ?? '',
      status: item.status ?? 0,
      link: this.buildArchiveLink(item.tstamp ?? '', item.originalURL ?? item.link ?? ''),
      size: item.contentLength ?? item.size,
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

    const items = data.response_items ?? data.responseItems ?? [];
    return items.map((item) => ({
      title: item.pageTitle?.[0] ?? item.imgTitle?.[0] ?? item.imgAlt?.[0] ?? '',
      imgLink: item.imgLinkToArchive ?? item.imgSrc ?? '',
      pageLink: item.pageLinkToArchive ?? item.pageURL ?? '',
      tstamp: item.imgTstamp ?? item.pageTstamp ?? '',
      width: item.imgWidth,
      height: item.imgHeight,
    }));
  }

  /**
   * Parse an Arquivo.pt archive URL into timestamp and original URL.
   * Format: https://arquivo.pt/wayback/{timestamp}/{originalUrl}
   * Returns null if not matches.
   */
  private parseArchiveUrl(archiveUrl: string): { timestamp: string; originalUrl: string } | null {
    const match = archiveUrl.match(/arquivo\.pt\/wayback\/(\d{14,})\/(.+)/);
    if (!match) return null;
    return {
      timestamp: match[1],
      originalUrl: match[2],
    };
  }

  /**
   * Fetch and extract text content from an archived page.
   * Performs up to two fetches: the archive HTML page, optionally the noFrame/replay endpoint,
   * and/or extracted text file. Applies throttling, retry, timeout, token truncation, HTML parsing.
   *
   * Throttling: consumes 1 token for archive page, plus 1 more if noFrame/replay is attempted.
   *
   * @param archiveUrl - Full Arquivo.pt archive URL (must be from arquivo.pt)
   * @param maxTokens - Maximum tokens to return; defaults to 4000; truncated at word boundary
   * @returns Object with title, truncated content, and original full content length
   * @throws Error if archive page fetch fails or is not OK
   *
   * Side effects: logs warnings if extracted text fetch fails (falls back to HTML strip).
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

    // Detect Wayback wrapper (toolbar, scripts)
    const hasWaybackToolbar = $('.wb-toolbar, #wm-ipp-base, .wayback-toolbar').length > 0;
    const hasWaybackScript = html.includes('arquivo.pt/wayback/static') || html.includes('WB_womb');
    const isWrapper = hasWaybackToolbar || hasWaybackScript;

    let content: string | undefined;

    // Strategy: try noFrame/replay endpoint to get original page without wrapper
    if (isWrapper) {
      const parsed = this.parseArchiveUrl(archiveUrl);
      if (parsed) {
        const noFrameUrl = `https://arquivo.pt/noFrame/replay/${parsed.timestamp}/${parsed.originalUrl}`;
        logger.debug('Attempting noFrame/replay', { url: noFrameUrl });
        try {
          await this.throttler.consume(); // second token
          const noFrameRes = await this.fetchWithRetryAndTimeout(noFrameUrl, {
            headers: { 'User-Agent': 'arquivo-mcp/0.1.0' },
          });
          if (noFrameRes.ok) {
            const noFrameHtml = await decodeResponse(noFrameRes);
            // If the noFrame page is valid HTML, extract text
            content = stripHtml(noFrameHtml);
            logger.debug('NoFrame success', { url: noFrameUrl });
          } else {
            logger.warn('NoFrame fetch failed', { status: noFrameRes.status });
          }
        } catch (err) {
          logger.warn('NoFrame fetch error', {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    // If noFrame didn't yield content, try other extraction methods
    if (!content) {
      // Try to find the extracted text link (multiple selector strategies)
      const extractedLink =
        // Standard Wayback extracted text link
        $('link[rel="archived text"]').attr('href') ||
        $('link[rel="archived-text"]').attr('href') ||
        // Alternative: look for text extraction service links
        $(`a[href*="linkToExtractedText"]`).attr('href') ||
        $(`a[href*="extracted_text"]`).attr('href') ||
        // Check for Wayback's text version
        $(`a[href*="/txt/"]`).attr('href') ||
        // Check for any link containing 'text' in the Wayback toolbar
        $(`.wb-info-base a[href*="text"]`).attr('href');

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
        // No extracted text link found - try fetching the raw content directly
        // The archive URL may return a Wayback wrapper; try to get actual content
        const actualContent = this.tryExtractFromWaybackWrapper(html, $);
        if (actualContent) {
          content = actualContent;
        } else {
          content = stripHtml(html);
        }
      }
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

  private tryExtractFromWaybackWrapper(html: string, $: cheerio.CheerioAPI): string | null {
    // Strategy 1: Look for iframe with original content
    const iframeSrc = $('iframe[src]').attr('src');
    if (iframeSrc && !iframeSrc.includes('wayback')) {
      // This is likely the original page in an iframe
      // We can't fetch it here (would need another request), but log it
      logger.debug('Found potential original content iframe', { src: iframeSrc });
    }

    // Strategy 2: Check if this is a Wayback wrapper by looking for Wayback-specific elements
    const hasWaybackToolbar = $('.wb-toolbar, #wm-ipp-base, .wayback-toolbar').length > 0;
    const hasWaybackScript = html.includes('arquivo.pt/wayback/static') || html.includes('WB_womb');

    if (hasWaybackToolbar || hasWaybackScript) {
      // This is a Wayback wrapper page
      // Try to find the actual content iframe
      const replayIframe =
        $('iframe[id="replay_iframe"], iframe.replay-iframe').attr('src') ||
        $('iframe[src*="mp_"]').attr('src');

      if (replayIframe) {
        logger.debug('Found replay iframe, but cannot fetch from wrapper', { src: replayIframe });
        // Return a message indicating the content is in an iframe
        return null;
      }

      // Try to extract any visible text content that isn't Wayback UI
      const bodyText = $('body').text().trim();
      const waybackText = $('.wb-toolbar, #wm-ipp-base').text();

      // If most of the text is Wayback UI, this is just a wrapper
      if (waybackText.length > bodyText.length * 0.5) {
        logger.warn('Detected Wayback wrapper page, content likely in iframe');
        return null;
      }
    }

    // Not a wrapper, or couldn't detect - return null to use stripHtml fallback
    return null;
  }

  private buildArchiveLink(tstamp: string, originalUrl: string): string {
    if (!tstamp || !originalUrl) return originalUrl || '';
    try {
      new URL(originalUrl);
    } catch {
      return originalUrl;
    }
    const safeTstamp = tstamp.replace(/[^0-9]/g, '');
    return `https://arquivo.pt/wayback/${safeTstamp}/${encodeURIComponent(originalUrl)}`;
  }
}
