import type { ArquivoClient } from '../client/ArquivoClient.js';
import { logger } from '../utils/logger.js';

/**
 * Tool: get_page_content
 * Fetch text content from an archived page.
 */
export async function getPageContentTool(
  client: ArquivoClient,
  params: {
    archive_url: string;
    max_tokens?: number;
  },
): Promise<{ content: Array<{ text: string }> }> {
  // Validation
  if (!params.archive_url || params.archive_url.trim() === '') {
    throw new Error('Archive URL parameter is required');
  }

  const maxTokens = Math.max(100, Math.min(params.max_tokens ?? 4000, 16000));

  try {
    const result = await client.fetchPage(params.archive_url.trim(), maxTokens);

    let output = `[Conteúdo de: ${params.archive_url.trim()} — ${result.title}]\n\n`;
    output += `TÍTULO: ${result.title}\n\n`;
    output += `TEXTO:\n${result.content}`;

    if (result.originalLength > result.content.length) {
      const originalKB = (result.originalLength / 1024).toFixed(1);
      output += `\n\n[Truncado. Tamanho original: ${originalKB} KB]`;
    }

    return { content: [{ text: output }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('get_page_content error', { error: message, params });
    throw new Error(`Failed to fetch page content: ${message}`);
  }
}
