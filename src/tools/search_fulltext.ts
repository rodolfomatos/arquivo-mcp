import type { ArquivoClient } from '../client/ArquivoClient.js';
import { formatSearchResults } from './common.js';
import { logger } from '../utils/logger.js';
import { isValidDateRange } from '../utils/validation.js';
import { truncateToTokens } from '../utils/tokens.js';
import type { SearchFulltextParams } from './types.js';

/**
 * Tool: search_fulltext
 * Full-text search on the Portuguese web archive.
 *
 * Validates date ranges, clamps maxItems to API limit (1–50), formats
 * results with formatSearchResults, and truncates to 8000 tokens (RNF-02).
 *
 * @param client - ArquivoClient instance
 * @param params.query - Search query (required, non-empty); supports "exact phrases" and -exclusions
 * @param params.from - Start date (YYYY or YYYYMMDDHHMMSS); optional
 * @param params.to - End date (YYYY or YYYYMMDDHHMMSS); optional
 * @param params.site - Limit to specific domain (e.g., publico.pt); optional
 * @param params.type - MIME type filter (html, pdf, doc, etc.); optional
 * @param params.maxItems - Number of results; defaults to 10, max 50
 * @param params.offset - Pagination offset (default 0)
 * @returns MCP content object with truncated text output
 * @throws Error if query missing, invalid date format, or API call fails
 *
 * Side effects: Logs errors on failure including params for context.
 */
export async function searchFulltextTool(
  client: ArquivoClient,
  params: SearchFulltextParams,
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

  const maxItems = Math.max(1, Math.min(params.maxItems ?? 10, 50));
  const offset = Math.max(0, params.offset ?? 0);

  try {
    const results = await client.searchFulltext({
      query: params.query.trim(),
      from: params.from,
      to: params.to,
      site: params.site,
      type: params.type,
      maxItems,
      offset,
    });

    const output = formatSearchResults(
      params.query.trim(),
      params.from,
      params.to,
      results,
      offset,
    );

    // Ensure output does not exceed 8000 tokens (RNF-02)
    const truncated = truncateToTokens(output, 8000);

    return { content: [{ text: truncated }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('search_fulltext error', { error: message, params });
    throw new Error(`Search failed: ${message}`);
  }
}
