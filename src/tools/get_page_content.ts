import type { ArquivoClient } from '../client/ArquivoClient.js';
import { logger } from '../utils/logger.js';
import type { GetPageContentParams } from './types.js';

/**
 * Validate that URL belongs to Arquivo.pt to prevent SSRF attacks.
 * Only allows exact hostname 'arquivo.pt' or subdomains ending with '.arquivo.pt'.
 *
 * @param url - URL string to validate
 * @returns true if hostname matches arquivo.pt or its subdomains
 */
function isArquivoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    return hostname === 'arquivo.pt' || hostname.endsWith('.arquivo.pt');
  } catch {
    return false;
  }
}

/**
 * Tool: get_page_content
 * Fetches text content from an archived page using the ArquivoClient.
 *
 * Validates that the URL is from arquivo.pt (SSRF protection), then calls
 * client.fetchPage() with token truncation. Logs a warning if operation exceeds
 * 5 seconds to signal potential performance issues.
 *
 * @param client - ArquivoClient instance (already configured with throttling/retry)
 * @param params.archive_url - Full Arquivo.pt archive URL; must belong to arquivo.pt domain
 * @param params.max_tokens - Maximum tokens to return; defaults to 4000, clamped 100–16000
 * @returns MCP content object with a single text field containing formatted output
 * @throws Error if validation fails, URL is not from arquivo.pt, or fetch fails
 *
 * Output format:
 *   [Conteúdo de: URL — TITLE]
 *   TÍTULO: ...
 *   TEXTO: ...
 *   [Truncado. Tamanho original: X KB] if content was truncated
 *
 * Side effects:
 *   - Logs warning if request duration > 5000ms
 *   - Logs error on failure with params for debugging
 */
export async function getPageContentTool(
  client: ArquivoClient,
  params: GetPageContentParams,
): Promise<{ content: Array<{ text: string }> }> {
  // Validation
  if (!params.archive_url || params.archive_url.trim() === '') {
    throw new Error('Archive URL parameter is required');
  }
  const archiveUrl = params.archive_url.trim();
  if (!isArquivoUrl(archiveUrl)) {
    throw new Error('Archive URL must be from arquivo.pt domain');
  }

  const maxTokens = Math.max(100, Math.min(params.max_tokens ?? 4000, 16000));

  try {
    const startTime = Date.now();
    const result = await client.fetchPage(archiveUrl, maxTokens);
    const duration = Date.now() - startTime;

    if (duration > 5000) {
      logger.warn('get_page_content took >5s', { duration, archiveUrl });
    }

    let output = `[Conteúdo de: ${archiveUrl} — ${result.title}]\n\n`;
    if (duration > 5000) {
      output += `[AVISO: Operação demorou ${(duration / 1000).toFixed(1)}s]\n\n`;
    }
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
