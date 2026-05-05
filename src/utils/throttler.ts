/**
 * Token bucket rate limiter.
 * Allows up to `capacity` tokens, refilled at `refillRate` tokens per second.
 */
export class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private capacity: number;
  private refillRate: number;
  private intervalId: NodeJS.Timeout | null = null;

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
   * Consume a token, waiting if necessary.
   * Returns a promise that resolves when a token is available.
   */
  async consume(): Promise<void> {
    while (this.tokens < 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    this.tokens -= 1;
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
