import type { ArquivoClient } from '../client/ArquivoClient.js';
import { formatImageResults } from './common.js';
import { logger } from '../utils/logger.js';
import { isValidDateRange } from '../utils/validation.js';
import { truncateToTokens } from '../utils/tokens.js';
import type { SearchImagesParams } from './types.js';

/**
 * Tool: search_images
 * Search historical images in the Portuguese web archive.
 *
 * Validates date range parameters, clamps maxItems to API limit (1–20),
 * formats results using formatImageResults, and truncates to 8000 tokens
 * (RNF-02) to prevent oversized LLM responses.
 *
 * @param client - ArquivoClient instance
 * @param params.query - Search terms for images (required, non-empty)
 * @param params.from - Start date (YYYY or YYYYMMDDHHMMSS); optional
 * @param params.to - End date (YYYY or YYYYMMDDHHMMSS); optional
 * @param params.maxItems - Number of results; defaults to 10, max 20
 * @param params.offset - Pagination offset (default 0)
 * @returns MCP content object with truncated text output
 * @throws Error if query missing, invalid date format, or API call fails
 *
 * Side effects: Logs errors on failure including params for context.
 */
export async function searchImagesTool(
  client: ArquivoClient,
  params: SearchImagesParams,
): Promise<{ content: Array<{ text: string }> }> {
  // Validation
  if (!params.query || params.query.trim() === '') {
    throw new Error('Query parameter is required');
  }
  if (!isValidDateRange(params.from)) {
    throw new Error('Invalid date format for "from". Use YYYY or YYYYMMDDHHMMSS');
  }
  if (!isValidDateRange(params.to)) {
    throw new Error('Invalid date format for "to". Use YYYY or YYYYMMDDHHMMSS');
  }

  const maxItems = Math.max(1, Math.min(params.maxItems ?? 10, 20));
  const offset = Math.max(0, params.offset ?? 0);

  try {
    const results = await client.searchImages({
      query: params.query.trim(),
      from: params.from,
      to: params.to,
      maxItems,
      offset,
    });

    const output = formatImageResults(params.query.trim(), results, offset);

    // Ensure output does not exceed 8000 tokens (RNF-02)
    const truncated = truncateToTokens(output, 8000);

    return { content: [{ text: truncated }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('search_images error', { error: message, params });
    throw new Error(`Image search failed: ${message}`);
  }
}
