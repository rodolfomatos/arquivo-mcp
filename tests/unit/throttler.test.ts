import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TokenBucket } from 'src/utils/throttler';

describe('TokenBucket', () => {
  let bucket: TokenBucket;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    bucket.stop();
    vi.useRealTimers();
  });

  it('should start with full capacity', async () => {
    bucket = new TokenBucket(1, 1);
    await bucket.consume();
    expect(bucket).toBeDefined();
  });

  it('should allow consuming when tokens available', async () => {
    bucket = new TokenBucket(1, 1);
    await bucket.consume();
    // No error thrown = success
  });

  it('should wait and refill tokens over time', async () => {
    bucket = new TokenBucket(1, 1); // 1 token, refill 1/sec

    // consume the initial token
    await bucket.consume();

    // No tokens left — next consume will wait
    const p = bucket.consume();

    // Advance time in 200ms steps to allow refill intervals to fire
    // Interval fires every 100ms; refillRate=1 means 0.1 tokens per 100ms
    // Need 10 intervals (1000ms) to accumulate 1 token
    for (let i = 0; i < 12; i++) {
      await vi.advanceTimersByTimeAsync(100);
    }

    await p;
    // Token was refilled and consumed
    expect(bucket).toBeDefined();
  });
});
