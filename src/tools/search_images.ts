import type { ArquivoClient } from '../client/ArquivoClient.js';
import { formatImageResults } from './common.js';
import { logger } from '../utils/logger.js';
import { isValidDateRange } from '../utils/validation.js';

/**
 * Tool: search_images
 * Search historical images in the Portuguese web archive.
 */
export async function searchImagesTool(
  client: ArquivoClient,
  params: {
    query: string;
    from?: string;
    to?: string;
    maxItems?: number;
    offset?: number;
  },
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
  const offset = params.offset ?? 0;

  try {
    const results = await client.searchImages({
      query: params.query.trim(),
      from: params.from,
      to: params.to,
      maxItems,
      offset,
    });

    const output = formatImageResults(params.query.trim(), results, offset);

    return { content: [{ text: output }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('search_images error', { error: message, params });
    throw new Error(`Image search failed: ${message}`);
  }
}
