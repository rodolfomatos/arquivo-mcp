/**
 * Parameter types for MCP tools
 */

/**
 * Parameters for search_fulltext tool.
 * @property query - Search query (required)
 * @property from - Start date filter in YYYY or YYYYMMDDHHMMSS
 * @property to - End date filter in YYYY or YYYYMMDDHHMMSS
 * @property site - Optional domain restriction
 * @property type - Optional MIME type filter
 * @property maxItems - Results count (1–50)
 * @property offset - Pagination offset
 */
export interface SearchFulltextParams {
  query: string;
  from?: string;
  to?: string;
  site?: string;
  type?: string;
  maxItems?: number;
  offset?: number;
}

/**
 * Parameters for get_url_versions tool.
 * @property url - Target URL (required)
 * @property from - Start date filter (YYYY or YYYYMMDDHHMMSS)
 * @property to - End date filter (YYYY or YYYYMMDDHHMMSS)
 * @property maxItems - Results count (1–100)
 * @property offset - Pagination offset
 */
export interface GetUrlVersionsParams {
  url: string;
  from?: string;
  to?: string;
  maxItems?: number;
  offset?: number;
}

/**
 * Parameters for get_page_content tool.
 * @property archive_url - Arquivo.pt archive URL (required)
 * @property max_tokens - Maximum tokens to return (100–16000)
 */
export interface GetPageContentParams {
  archive_url: string;
  max_tokens?: number;
}

/**
 * Parameters for search_images tool.
 * @property query - Search terms for images (required)
 * @property from - Start date filter (YYYY or YYYYMMDDHHMMSS)
 * @property to - End date filter (YYYY or YYYYMMDDHHMMSS)
 * @property maxItems - Results count (1–20)
 * @property offset - Pagination offset
 */
export interface SearchImagesParams {
  query: string;
  from?: string;
  to?: string;
  maxItems?: number;
  offset?: number;
}
