/**
 * Formata resultados de busca para output legível pelo LLM.
 */

/**
 * Format a YYYYMMDD... timestamp into a human-readable date.
 * Handles partial timestamps gracefully:
 *   4 digits (YYYY)    → "2023"
 *   6 digits (YYYYMM)  → "2023-01"
 *   8+ digits          → "2023-01-15"
 *
 * @param tstamp - Raw timestamp from API (e.g., '20230115120000')
 * @returns Formatted date string
 */
function formatDate(tstamp: string): string {
  const len = Math.min(tstamp.length, 8);
  if (len < 4) return tstamp;
  if (len === 4) return tstamp.slice(0, 4);
  if (len === 6) return `${tstamp.slice(0, 4)}-${tstamp.slice(4, 6)}`;
  return `${tstamp.slice(0, 4)}-${tstamp.slice(4, 6)}-${tstamp.slice(6, 8)}`;
}

/**
 * Extract a clean hostname from a URL for display (strip 'www.' prefix).
 * If URL parsing fails, returns the original string as fallback.
 *
 * @param url - Full URL (e.g., 'https://www.publico.pt/...')
 * @returns Clean hostname (e.g., 'publico.pt') or raw URL on parse error
 */
function extractHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url; // fallback: show raw URL
  }
}

/**
 * Format full-text search results into a human-readable, LLM-friendly string.
 *
 * Output structure:
 *   [N resultados para "query" desde/até/entre dateRange]
 *   1. Title (hostname — date)
 *     URL original: ...
 *     Arquivo: ...
 *     Snippet: ...
 *
 * @param query - Original search query (echoed in header)
 * @param from - Start date filter for display (optional)
 * @param to - End date filter for display (optional)
 * @param results - Array of search result items
 * @param offset - Pagination offset; added to result numbering
 * @param total - Optional total count; used to indicate next page availability
 * @returns Formatted string
 */
export function formatSearchResults(
  query: string,
  from?: string,
  to?: string,
  results: Array<{
    title: string;
    link: string;
    archiveLink: string;
    snippet: string;
    tstamp: string;
    size?: number;
  }> = [],
  offset: number = 0,
  total?: number,
): string {
  const dateRange =
    from && to ? `entre ${from} e ${to}` : from ? `desde ${from}` : to ? `até ${to}` : '';

  // Note: dateRange gets appended with a space if present
  const header = `[${results.length} resultados para "${query}"${dateRange ? ` ${dateRange}` : ''}]\n\n`;

  let output = header;

  results.forEach((result, index) => {
    const date = formatDate(result.tstamp);
    const site = extractHostname(result.link);
    output += `${index + 1 + offset}. ${result.title} (${site} — ${date})\n`;
    output += `   URL original: ${result.link}\n`;
    output += `   Arquivo: ${result.archiveLink}\n`;
    if (result.snippet) {
      output += `   Snippet: ${result.snippet}\n`;
    }
    output += '\n';
  });

  if (total && total > offset + results.length) {
    output += `[Próxima página disponível: offset=${offset + results.length}]\n`;
  }

  return output;
}

/**
 * Format version history results into a human-readable string.
 *
 * Output structure:
 *   [N versões arquivadas de URL]
 *   1. YYYY-MM-DD — HTTP STATUS
 *     Arquivo: ...
 *     Tamanho: X.X KB (if available)
 *
 * @param url - Original URL being versioned (echoed in header)
 * @param results - Array of version items with tstamp, status, link, optional size
 * @param offset - Pagination offset; added to result numbering
 * @param total - Optional total count; used to indicate next page availability
 * @returns Formatted string
 */
export function formatVersionResults(
  url: string,
  results: Array<{
    tstamp: string;
    status: number;
    link: string;
    size?: number;
  }> = [],
  offset: number = 0,
  total?: number,
): string {
  let output = `[${results.length} versões arquivadas de ${url}]\n\n`;

  results.forEach((result, index) => {
    const date = formatDate(result.tstamp);
    output += `${index + 1 + offset}. ${date} — HTTP ${result.status}\n`;
    output += `   Arquivo: ${result.link}\n`;
    if (result.size) {
      output += `   Tamanho: ${(result.size / 1024).toFixed(1)} KB\n`;
    }
    output += '\n';
  });

  if (total && total > offset + results.length) {
    output += `[Próxima página disponível: offset=${offset + results.length}]\n`;
  }

  return output;
}

/**
 * Format image search results into a human-readable string.
 *
 * Output structure:
 *   [N imagens para "query"]
 *   1. Title
 *     URL imagem: ...
 *     Página de origem: ...
 *     Data: YYYY-MM-DD
 *     Dimensões: WxH (if available)
 *
 * @param query - Original search query (echoed in header)
 * @param results - Array of image result items
 * @param offset - Pagination offset; added to result numbering
 * @param total - Optional total count; used to indicate next page availability
 * @returns Formatted string
 */
export function formatImageResults(
  query: string,
  results: Array<{
    title: string;
    imgLink: string;
    pageLink: string;
    tstamp: string;
    width?: number;
    height?: number;
  }> = [],
  offset: number = 0,
  total?: number,
): string {
  let output = `[${results.length} imagens para "${query}"]\n\n`;

  results.forEach((result, index) => {
    const date = formatDate(result.tstamp);
    output += `${index + 1 + offset}. ${result.title}\n`;
    output += `   URL imagem: ${result.imgLink}\n`;
    output += `   Página de origem: ${result.pageLink}\n`;
    output += `   Data: ${date}\n`;
    if (result.width && result.height) {
      output += `   Dimensões: ${result.width}x${result.height}\n`;
    }
    output += '\n';
  });

  if (total && total > offset + results.length) {
    output += `[Próxima página disponível: offset=${offset + results.length}]\n`;
  }

  return output;
}
