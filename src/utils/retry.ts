/**
 * Retry logic with exponential backoff.
 * Retries on specific conditions (e.g., HTTP 429).
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
      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Check if an error is retryable: HTTP 429, 5xx, network errors, or AbortError (timeout).
 */
export function isRetryableError(error: unknown): boolean {
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
