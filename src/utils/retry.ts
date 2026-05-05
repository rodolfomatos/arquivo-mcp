import { HttpError } from './HttpError.js';

/**
 * Retry logic with exponential backoff and jitter.
 * Respects Retry-After header if present on HttpError.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  baseDelayMs: number = 1000,
  shouldRetry: (error: unknown, attempt: number) => boolean,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries || !shouldRetry(error, attempt)) {
        throw error;
      }

      // Calculate delay with optional Retry-After and jitter
      let delay: number;
      if (error instanceof HttpError) {
        const retryAfter = error.getRetryAfter();
        if (retryAfter != null) {
          delay = retryAfter;
        } else {
          delay = baseDelayMs * Math.pow(2, attempt);
          const jitter = 0.8 + Math.random() * 0.4; // ±20%
          delay *= jitter;
        }
      } else {
        delay = baseDelayMs * Math.pow(2, attempt);
        const jitter = 0.8 + Math.random() * 0.4; // ±20%
        delay *= jitter;
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Check if an error is retryable: HttpError with 429/5xx, network errors, or AbortError (timeout).
 */
export function isRetryableError(error: unknown): boolean {
  // HttpError (preferred)
  if (error instanceof HttpError) {
    const status = error.status;
    return status === 429 || (status >= 500 && status < 600);
  }
  // Legacy: error with response property (for compatibility with old tests)
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const typedError = error as { response?: { status: number } };
    const status = typedError.response?.status;
    if (typeof status === 'number') {
      return status === 429 || (status >= 500 && status < 600);
    }
  }
  // Network errors, timeouts — also retryable
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const typedError = error as { code?: string };
    return typedError.code === 'ECONNABORTED' || typedError.code === 'ENETUNREACH';
  }
  // AbortError from AbortController (Node.js fetch)
  if (error instanceof Error && error.name === 'AbortError') {
    return true;
  }
  return false;
}
