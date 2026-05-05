/**
 * Token bucket rate limiter.
 * Allows up to `capacity` tokens, refilled at `refillRate` tokens per second.
 *
 * Usage: call consume() before each API request to wait for a token.
 * Stop the refill timer when shutting down via stop().
 */
export class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private capacity: number;
  private refillRate: number;
  private intervalId: NodeJS.Timeout | null = null;

  /**
   * Initialize token bucket with capacity and refill rate.
   *
   * @param capacity - Maximum number of tokens (burst size)
   * @param refillRate - Tokens added per second (steady drip)
   *
   * Side effects: Starts a 100ms interval to gradually refill tokens based on elapsed time.
   */
  constructor(capacity: number, refillRate: number) {
    this.capacity = capacity;
    this.refillRate = refillRate;
    this.tokens = capacity;
    this.lastRefill = Date.now();
    this.startRefillTimer();
  }

  private startRefillTimer(): void {
    // Refill tokens gradually every 100ms
    this.intervalId = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - this.lastRefill) / 1000; // seconds
      const tokensToAdd = elapsed * this.refillRate;
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }, 100);
  }

  /**
   * Consume one token, blocking until available if bucket is empty.
   *
   * Algorithm: busy-wait loop with 50ms sleeps until tokens >= 1, then decrement.
   * This ensures rate-limited concurrency without external dependencies.
   *
   * Side effects: Decrements internal token count.
   * @throws Never throws; waits indefinitely until token available.
   */
  async consume(): Promise<void> {
    while (this.tokens < 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    this.tokens -= 1;
  }

  /**
   * Stop the background refill timer.
   * Used during client shutdown to prevent memory leaks and stray intervals.
   * Safe to call multiple times.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
