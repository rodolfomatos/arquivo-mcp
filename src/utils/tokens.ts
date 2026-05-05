/**
 * Truncate text to approximately `maxTokens` tokens.
 * Uses rough approximation: 1 token ≈ 4 characters.
 * Cuts at word boundaries to avoid partial words.
 */
export function truncateToTokens(text: string, maxTokens: number): string {
  const approxCharsPerToken = 4;
  const maxChars = maxTokens * approxCharsPerToken;

  if (text.length <= maxChars) {
    return text;
  }

  // Cut at the last complete word before limit
  let truncated = text.slice(0, maxChars);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > 0) {
    truncated = truncated.slice(0, lastSpace);
  }

  return truncated + '...[truncated]';
}
