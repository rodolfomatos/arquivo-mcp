import * as cheerio from 'cheerio';

/**
 * Strip HTML tags and return plain text.
 * Decodes HTML entities automatically via cheerio.
 */
export function stripHtml(html: string): string {
  const $ = cheerio.load(html);
  return $.text().trim();
}
