import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ArquivoClient } from './client/ArquivoClient.js';
import {
  searchFulltextTool,
  getUrlVersionsTool,
  getPageContentTool,
  searchImagesTool,
} from './tools/index.js';
import type { SearchFulltextParams } from './tools/types.js';
import type { GetUrlVersionsParams } from './tools/types.js';
import type { GetPageContentParams } from './tools/types.js';
import type { SearchImagesParams } from './tools/types.js';
import { logger } from './utils/logger.js';

/**
 * Main entry point: start the MCP server with Arquivo tools.
 *
 * Setup:
 *   - Creates ArquivoClient with default or env-configured throttling/retry/timeout
 *   - Registers 4 tools: search_fulltext, get_url_versions, get_page_content, search_images
 *   - Sets up graceful shutdown on SIGINT/SIGTERM (calls client.shutdown())
 *   - Connects via StdioServerTransport (MCP over stdio)
 *
 * Error handling: catches fatal errors, logs to stderr, exits with code 1.
 *
 * @returns Never returns; runs until process termination
 */
async function main() {
  const server = new Server(
    {
      name: 'arquivo-mcp',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  const client = new ArquivoClient({
    maxRequestsPerSecond: 1,
    maxRetries: 2,
    timeoutMs: 10000,
  });

  const tools: Tool[] = [
    {
      name: 'search_fulltext',
      description: 'Search full-text in the Portuguese web archive',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search terms (supports "exact phrases" and -exclusions)',
          },
          from: {
            type: 'string',
            description: 'Start date (YYYY or YYYYMMDDHHMMSS). Default: 1996',
          },
          to: {
            type: 'string',
            description: 'End date (YYYY or YYYYMMDDHHMMSS). Default: last year',
          },
          site: {
            type: 'string',
            description: 'Limit search to a specific domain (e.g., publico.pt)',
          },
          type: {
            type: 'string',
            description: 'MIME type filter: html, pdf, doc, etc. Default: html',
          },
          maxItems: {
            type: 'number',
            description: 'Number of results (default: 10, max: 50)',
            minimum: 1,
            maximum: 50,
          },
          offset: {
            type: 'number',
            description: 'Pagination offset (default: 0)',
            minimum: 0,
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'get_url_versions',
      description: 'List all archived versions of a specific URL',
      inputSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL to search for (with or without protocol)',
          },
          from: {
            type: 'string',
            description: 'Start date filter',
          },
          to: {
            type: 'string',
            description: 'End date filter',
          },
          maxItems: {
            type: 'number',
            description: 'Number of versions (default: 20, max: 100)',
            minimum: 1,
            maximum: 100,
          },
          offset: {
            type: 'number',
            description: 'Pagination offset (default: 0)',
            minimum: 0,
          },
        },
        required: ['url'],
      },
    },
    {
      name: 'get_page_content',
      description: 'Fetch text content from an archived page',
      inputSchema: {
        type: 'object',
        properties: {
          archive_url: {
            type: 'string',
            description: 'URL of the archived page (from Arquivo.pt)',
          },
          max_tokens: {
            type: 'number',
            description: 'Maximum tokens to return (default: 4000, max: 16000)',
            minimum: 100,
            maximum: 16000,
          },
        },
        required: ['archive_url'],
      },
    },
    {
      name: 'search_images',
      description: 'Search historical images in the Portuguese web archive',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search terms for images',
          },
          from: {
            type: 'string',
            description: 'Start date (YYYY or YYYYMMDDHHMMSS)',
          },
          to: {
            type: 'string',
            description: 'End date (YYYY or YYYYMMDDHHMMSS)',
          },
          maxItems: {
            type: 'number',
            description: 'Number of results (default: 10, max: 20)',
            minimum: 1,
            maximum: 20,
          },
          offset: {
            type: 'number',
            description: 'Pagination offset (default: 0)',
            minimum: 0,
          },
        },
        required: ['query'],
      },
    },
  ];

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      if (name === 'search_fulltext') {
        const result = await searchFulltextTool(client, args as unknown as SearchFulltextParams);
        return { content: result.content };
      }

      if (name === 'get_url_versions') {
        const result = await getUrlVersionsTool(client, args as unknown as GetUrlVersionsParams);
        return { content: result.content };
      }

      if (name === 'get_page_content') {
        const result = await getPageContentTool(client, args as unknown as GetPageContentParams);
        return { content: result.content };
      }

      if (name === 'search_images') {
        const result = await searchImagesTool(client, args as unknown as SearchImagesParams);
        return { content: result.content };
      }

      throw new Error(`Unknown tool: ${name}`);
    } catch (error) {
      // Return error as text content (MCP expects content, not throw)
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            text: `Error: ${message}`,
          },
        ],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('arquivo-mcp server started with tools');

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    client.shutdown();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  logger.error('Fatal error in main', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
