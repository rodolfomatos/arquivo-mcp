/**
 * Token bucket rate limiter using event-driven waiting (no busy-wait polling).
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
  private waiting: (() => void)[] = [];

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
    this.intervalId = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - this.lastRefill) / 1000;
      const tokensToAdd = elapsed * this.refillRate;
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefill = now;

      // Resolve waiting consumers if tokens are available
      while (this.tokens >= 1 && this.waiting.length > 0) {
        this.tokens -= 1;
        const consumer = this.waiting[0];
        if (consumer) {
          consumer();
        }
      }
    }, 100);
  }

  /**
   * Consume one token. Resolves immediately if available, otherwise waits
   * until the refill interval grants a token.
   *
   * Side effects: Decrements internal token count.
   * @throws Never throws; waits indefinitely until token available.
   */
  async consume(): Promise<void> {
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    return new Promise((resolve) => {
      const wrappedResolve = () => {
        if (this.waiting.includes(wrappedResolve)) {
          this.waiting.splice(this.waiting.indexOf(wrappedResolve), 1);
          resolve();
        }
      };
      this.waiting.push(wrappedResolve);
    });
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
