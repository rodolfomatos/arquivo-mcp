/**
 * Parameter types for MCP tools
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

export interface GetUrlVersionsParams {
  url: string;
  from?: string;
  to?: string;
  maxItems?: number;
  offset?: number;
}

export interface GetPageContentParams {
  archive_url: string;
  max_tokens?: number;
}

export interface SearchImagesParams {
  query: string;
  from?: string;
  to?: string;
  maxItems?: number;
  offset?: number;
}
