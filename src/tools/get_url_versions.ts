import type { ArquivoClient } from '../client/ArquivoClient.js';
import { formatVersionResults } from './common.js';
import { logger } from '../utils/logger.js';
import { isValidDateRange } from '../utils/validation.js';
import { truncateToTokens } from '../utils/tokens.js';
import type { GetUrlVersionsParams } from './types.js';

/**
 * Tool: get_url_versions
 * List all archived versions of a specific URL.
 */
export async function getUrlVersionsTool(
  client: ArquivoClient,
  params: GetUrlVersionsParams,
): Promise<{ content: Array<{ text: string }> }> {
  // Validation
  if (!params.url || params.url.trim() === '') {
    throw new Error('URL parameter is required');
  }
  if (!isValidDateRange(params.from)) {
    throw new Error('Invalid date format for "from". Use YYYY or YYYYMMDDHHMMSS');
  }
  if (!isValidDateRange(params.to)) {
    throw new Error('Invalid date format for "to". Use YYYY or YYYYMMDDHHMMSS');
  }

  const maxItems = Math.max(1, Math.min(params.maxItems ?? 20, 100));
  const offset = Math.max(0, params.offset ?? 0);

  try {
    const results = await client.getUrlVersions({
      url: params.url.trim(),
      from: params.from,
      to: params.to,
      maxItems,
      offset,
    });

    const output = formatVersionResults(params.url.trim(), results, offset);

    // Ensure output does not exceed 8000 tokens (RNF-02)
    const truncated = truncateToTokens(output, 8000);

    return { content: [{ text: truncated }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('get_url_versions error', { error: message, params });
    throw new Error(`Version lookup failed: ${message}`);
  }
}
