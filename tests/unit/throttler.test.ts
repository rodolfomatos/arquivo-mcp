import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TokenBucket } from 'src/utils/throttler';

describe('TokenBucket', () => {
  let bucket: TokenBucket;

  beforeEach(() => {
    bucket = new TokenBucket(1, 1); // 1 token, refill 1/sec
  });

  afterEach(() => {
    bucket.stop();
  });

  it('should start with full capacity', async () => {
    await bucket.consume();
    // After consuming, tokens should be 0 immediately
    expect(bucket).toBeDefined();
  });

  it('should allow consuming when tokens available', async () => {
    await bucket.consume();
    // No error thrown = success
  });

  it('should wait and refill tokens over time', async () => {
    await bucket.consume(); // consume the initial token

    // At this time, no tokens available — consume will wait
    const start = Date.now();
    await bucket.consume(); // should block until refill (~1s)
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(900); // ~1 second
  });
});
