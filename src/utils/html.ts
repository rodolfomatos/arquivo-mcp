import * as cheerio from 'cheerio';

/**
 * Strip HTML tags and return plain text.
 * Decodes HTML entities automatically via cheerio.
 *
 * @param html - Input HTML string
 * @returns Plain text content (trimmed)
 */
export function stripHtml(html: string): string {
  const $ = cheerio.load(html);
  return $.text().trim();
}
