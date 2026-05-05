/**
 * Custom error for HTTP errors with response metadata.
 * Provides access to status code, headers, and Retry-After parsing.
 */
export class HttpError extends Error {
  public readonly status: number;
  public readonly headers: Headers;

  constructor(status: number, headers: Headers, message?: string) {
    super(message ?? `HTTP ${status}`);
    this.status = status;
    this.headers = headers;
    this.name = 'HttpError';
  }

  /**
   * Returns the Retry-After delay in milliseconds, if present and valid.
   * Supports both seconds and HTTP-date formats.
   */
  getRetryAfter(): number | null {
    const header = this.headers.get('Retry-After');
    if (!header) return null;

    // Parse as seconds
    const seconds = parseInt(header, 10);
    if (!isNaN(seconds)) {
      return seconds * 1000;
    }

    // Parse as HTTP-date
    const date = new Date(header);
    if (!isNaN(date.getTime())) {
      const delta = date.getTime() - Date.now();
      return delta > 0 ? delta : null;
    }

    return null;
  }
}
