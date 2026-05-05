import type { ArquivoClient } from '../client/ArquivoClient.js';
import { formatVersionResults } from './common.js';
import { logger } from '../utils/logger.js';
import { isValidDateRange } from '../utils/validation.js';

/**
 * Tool: get_url_versions
 * List all archived versions of a specific URL.
 */
export async function getUrlVersionsTool(
  client: ArquivoClient,
  params: {
    url: string;
    from?: string;
    to?: string;
    maxItems?: number;
    offset?: number;
  },
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
  const offset = params.offset ?? 0;

  try {
    const results = await client.getUrlVersions({
      url: params.url.trim(),
      from: params.from,
      to: params.to,
      maxItems,
      offset,
    });

    const output = formatVersionResults(params.url.trim(), results, offset);

    return { content: [{ text: output }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('get_url_versions error', { error: message, params });
    throw new Error(`Version lookup failed: ${message}`);
  }
}
