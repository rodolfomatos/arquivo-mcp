import { describe, it, expect, vi } from 'vitest';
import { retryWithBackoff, isRetryableError } from 'src/utils/retry';

describe('retryWithBackoff', () => {
  it('should return result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await retryWithBackoff(fn, 2, 1000, () => true);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure then succeed', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce('ok');
    const result = await retryWithBackoff(fn, 2, 50, () => true);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should throw after max retries exceeded', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    await expect(retryWithBackoff(fn, 2, 10, () => true)).rejects.toThrow('fail');
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });
});

describe('isRetryableError', () => {
  it('should return true for 429', () => {
    const err = { response: { status: 429 } };
    expect(isRetryableError(err)).toBe(true);
  });

  it('should return true for 5xx', () => {
    const err = { response: { status: 502 } };
    expect(isRetryableError(err)).toBe(true);
  });

  it('should return false for 4xx non-429', () => {
    const err = { response: { status: 400 } };
    expect(isRetryableError(err)).toBe(false);
  });

  it('should return true for network errors', () => {
    const err = { code: 'ECONNABORTED' };
    expect(isRetryableError(err)).toBe(true);
  });
});
