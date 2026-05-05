/**
 * Formata resultados de busca para output legível pelo LLM.
 */

/**
 * Maximum output tokens to avoid overwhelming the LLM (RNF-02).
 * Using ~4 chars per token approximation.
 */
const MAX_TOKENS = 8000;
const MAX_CHARS = MAX_TOKENS * 4; // ~32000 chars

function truncateOutput(output: string): string {
  if (output.length <= MAX_CHARS) {
    return output;
  }
  const truncated = output.slice(0, MAX_CHARS);
  // Find last newline to avoid cutting in middle of line
  const lastNewline = truncated.lastIndexOf('\n');
  const cutPoint = lastNewline > 0 ? lastNewline : MAX_CHARS;
  return output.slice(0, cutPoint) + '\n\n[Output truncated due to token limit]';
}

function formatDate(tstamp: string): string {
  const raw = tstamp.slice(0, 8); // YYYYMMDD
  if (raw.length === 8) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  return raw;
}

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url; // fallback: show raw URL
  }
}

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

  return truncateOutput(output);
}

/**
 * Formata lista de versões de URL.
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

  return truncateOutput(output);
}

/**
 * Formata resultados de imagem.
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

  return truncateOutput(output);
}
