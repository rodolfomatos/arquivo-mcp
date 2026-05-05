import { describe, it, expect } from 'vitest';
import { truncateToTokens } from 'src/utils/tokens';

describe('truncateToTokens', () => {
  it('should not truncate short text', () => {
    const text = 'short text';
    expect(truncateToTokens(text, 100)).toBe(text);
  });

  it('should truncate long text to approximate token count', () => {
    const longText = 'a '.repeat(100); // ~200 chars => ~50 tokens
    const result = truncateToTokens(longText, 10);
    // The truncation indicator adds overhead; actual content should be within token limit
    const content = result.replace('...[truncated]', '');
    const approxTokens = Math.ceil(content.length / 4);
    expect(approxTokens).toBeLessThanOrEqual(10);
  });

  it('should add truncation marker', () => {
    const text = 'a '.repeat(200);
    const result = truncateToTokens(text, 10);
    expect(result).toContain('...[truncated]');
  });

  it('should cut at word boundary', () => {
    const text = 'one two three four five six seven eight nine ten';
    const result = truncateToTokens(text, 2); // ~8 chars => likely "one two"
    expect(result).not.toContain('three'); // should not include the third word
  });
});
