import * as cheerio from 'cheerio';

const MAX_ENTITY_DECODE_LENGTH = 10 * 1024 * 1024; // 10MB limit

/**
 * Decode HTML entities in a string (no cheerio needed).
 * Handles numeric entities (&#123;, &#xABC;) and common named entities.
 * Truncates input at MAX_ENTITY_DECODE_LENGTH to prevent catastrophic backtracking.
 */
function decodeHtmlEntities(text: string): string {
  if (text.length > MAX_ENTITY_DECODE_LENGTH) {
    text = text.substring(0, MAX_ENTITY_DECODE_LENGTH);
  }
  return text
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = parseInt(dec, 10);
      if (code > 0x10ffff) return `&#${dec};`;
      return String.fromCharCode(code);
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const code = parseInt(hex, 16);
      if (code > 0x10ffff) return `&#x${hex};`;
      return String.fromCharCode(code);
    })
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&eacute;/g, 'é')
    .replace(/&Eacute;/g, 'É')
    .replace(/&egrave;/g, 'è')
    .replace(/&Egrave;/g, 'È')
    .replace(/&ecirc;/g, 'ê')
    .replace(/&Ecirc;/g, 'Ê')
    .replace(/&euml;/g, 'ë')
    .replace(/&Euml;/g, 'Ë')
    .replace(/&atilde;/g, 'ã')
    .replace(/&Atilde;/g, 'Ã')
    .replace(/&aacute;/g, 'á')
    .replace(/&Aacute;/g, 'Á')
    .replace(/&agrave;/g, 'à')
    .replace(/&Agrave;/g, 'À')
    .replace(/&acirc;/g, 'â')
    .replace(/&Acirc;/g, 'Â')
    .replace(/&auml;/g, 'ä')
    .replace(/&Auml;/g, 'Ä')
    .replace(/&ccedil;/g, 'ç')
    .replace(/&Ccedil;/g, 'Ç')
    .replace(/&iacute;/g, 'í')
    .replace(/&Iacute;/g, 'Í')
    .replace(/&igrave;/g, 'ì')
    .replace(/&Igrave;/g, 'Ì')
    .replace(/&icirc;/g, 'î')
    .replace(/&Icirc;/g, 'Î')
    .replace(/&iuml;/g, 'ï')
    .replace(/&Iuml;/g, 'Ï')
    .replace(/&ntilde;/g, 'ñ')
    .replace(/&Ntilde;/g, 'Ñ')
    .replace(/&oacute;/g, 'ó')
    .replace(/&Oacute;/g, 'Ó')
    .replace(/&ograve;/g, 'ò')
    .replace(/&Ograve;/g, 'Ò')
    .replace(/&ocirc;/g, 'ô')
    .replace(/&Ocirc;/g, 'Ô')
    .replace(/&otilde;/g, 'õ')
    .replace(/&Otilde;/g, 'Õ')
    .replace(/&ouml;/g, 'ö')
    .replace(/&Ouml;/g, 'Ö')
    .replace(/&uacute;/g, 'ú')
    .replace(/&Uacute;/g, 'Ú')
    .replace(/&ugrave;/g, 'ù')
    .replace(/&Ugrave;/g, 'Ù')
    .replace(/&ucirc;/g, 'û')
    .replace(/&Ucirc;/g, 'Û')
    .replace(/&uuml;/g, 'ü')
    .replace(/&Uuml;/g, 'Ü')
    .replace(/&yacute;/g, 'ý')
    .replace(/&Yacute;/g, 'Ý')
    .replace(/&yuml;/g, 'ÿ')
    .replace(/&Yuml;/g, 'Ÿ')
    .replace(/&ordm;/g, 'º')
    .replace(/&ordf;/g, 'ª')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&iquest;/g, '¿')
    .replace(/&iexcl;/g, '¡')
    .replace(/&copy;/g, '©')
    .replace(/&reg;/g, '®')
    .replace(/&trade;/g, '™')
    .replace(/&deg;/g, '°')
    .replace(/&para;/g, '¶')
    .replace(/&sect;/g, '§')
    .replace(/&micro;/g, 'µ')
    .replace(/&middot;/g, '·')
    .replace(/&bull;/g, '•')
    .replace(/&hellip;/g, '…')
    .replace(/&lsquo;/g, '\u2018')
    .replace(/&rsquo;/g, '\u2019')
    .replace(/&ldquo;/g, '\u201C')
    .replace(/&rdquo;/g, '\u201D')
    .replace(/&lsaquo;/g, '‹')
    .replace(/&rsaquo;/g, '›')
    .replace(/&ensp;/g, ' ')
    .replace(/&emsp;/g, ' ')
    .replace(/&thinsp;/g, ' ')
    .replace(/&zwnj;/g, '')
    .replace(/&zwj;/g, '')
    .replace(/&lrm;/g, '')
    .replace(/&rlm;/g, '');
}

/**
 * Strip HTML tags and return plain text.
 * Uses cheerio for parsing, removes non-content elements, and decodes entities.
 *
 * @param html - Input HTML string
 * @returns Plain text content (trimmed, collapsed whitespace)
 */
export function stripHtml(html: string): string {
  if (html.length < 2048) {
    return decodeHtmlEntities(html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ')).trim();
  }
  const $ = cheerio.load(html);
  // Remove elements that are not part of the visible content
  $('script, style, noscript, iframe, head, meta, link, title').remove();
  // Get text content
  let text = $.text();
  // Collapse whitespace and trim
  text = text.replace(/\s+/g, ' ').trim();
  return decodeHtmlEntities(text);
}
