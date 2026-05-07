import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ArquivoClient } from '../client/ArquivoClient.js';
import {
  searchFulltextTool,
  getUrlVersionsTool,
  getPageContentTool,
  searchImagesTool,
} from '../tools/index.js';
import type { SearchFulltextParams } from '../tools/types.js';
import type { GetUrlVersionsParams } from '../tools/types.js';
import type { GetPageContentParams } from '../tools/types.js';
import type { SearchImagesParams } from '../tools/types.js';
import { logger } from '../utils/logger.js';

/** In-memory session store for stateful transport */
const sessions: Map<string, StreamableHTTPServerTransport> = new Map();
const sessionTimestamps: Map<string, number> = new Map();
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function createTools(): Tool[] {
  return [
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
          offset: { type: 'number', description: 'Pagination offset (default: 0)', minimum: 0 },
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
          url: { type: 'string', description: 'URL to search for (with or without protocol)' },
          from: { type: 'string', description: 'Start date filter' },
          to: { type: 'string', description: 'End date filter' },
          maxItems: {
            type: 'number',
            description: 'Number of versions (default: 20, max: 100)',
            minimum: 1,
            maximum: 100,
          },
          offset: { type: 'number', description: 'Pagination offset (default: 0)', minimum: 0 },
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
          query: { type: 'string', description: 'Search terms for images' },
          from: { type: 'string', description: 'Start date (YYYY or YYYYMMDDHHMMSS)' },
          to: { type: 'string', description: 'End date (YYYY or YYYYMMDDHHMMSS)' },
          maxItems: {
            type: 'number',
            description: 'Number of results (default: 10, max: 20)',
            minimum: 1,
            maximum: 20,
          },
          offset: { type: 'number', description: 'Pagination offset (default: 0)', minimum: 0 },
        },
        required: ['query'],
      },
    },
  ];
}

function createServerInstance(): Server {
  const maxRetriesEnv =
    typeof process.env.MAX_RETRIES === 'string' ? parseInt(process.env.MAX_RETRIES, 10) : 4;
  const timeoutMsEnv =
    typeof process.env.TIMEOUT_MS === 'string' ? parseInt(process.env.TIMEOUT_MS, 10) : 120000;

  const client = new ArquivoClient({
    maxRequestsPerSecond: Number(process.env.MAX_REQUESTS_PER_SECOND) || 1,
    maxRetries: Number.isNaN(maxRetriesEnv) ? 4 : maxRetriesEnv,
    timeoutMs: Number.isNaN(timeoutMsEnv) ? 120000 : timeoutMsEnv,
  });

  const tools = createTools();
  const toolsList = tools;

  const server = new Server(
    { name: 'arquivo-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolsList,
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
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  return server;
}

export async function startHttpServer(port: number): Promise<void> {
  const server = createServerInstance();

  function cleanupStaleSessions(): void {
    const now = Date.now();
    for (const [sessionId, timestamp] of sessionTimestamps.entries()) {
      if (now - timestamp > SESSION_TTL_MS) {
        sessions.delete(sessionId);
        sessionTimestamps.delete(sessionId);
      }
    }
  }

  const cleanupInterval = setInterval(cleanupStaleSessions, CLEANUP_INTERVAL_MS);

  const httpServer = createServer(async (req, res) => {
    try {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      let transport: StreamableHTTPServerTransport | undefined;

      if (sessionId && sessions.has(sessionId)) {
        transport = sessions.get(sessionId);
        sessionTimestamps.set(sessionId, Date.now());
      } else if (!sessionId && req.method === 'POST') {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid) => {
            sessions.set(sid, transport as StreamableHTTPServerTransport);
            sessionTimestamps.set(sid, Date.now());
          },
        });

        transport.onclose = () => {
          if (transport?.sessionId) {
            sessions.delete(transport.sessionId);
            sessionTimestamps.delete(transport.sessionId);
          }
        };

        await server.connect(transport);
      }

      if (!transport) {
        res.writeHead(400).end('Bad Request: Missing or invalid session');
        return;
      }

      await transport.handleRequest(req, res);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('HTTP server error', { error: message });
      res.writeHead(500).end('Internal Server Error');
    }
  });

  return new Promise((resolve, reject) => {
    httpServer.listen(port, () => {
      logger.info(`arquivo-mcp HTTP server started on port ${port}`);
      logger.info(`Connect with: http://localhost:${port}/mcp`);
      resolve();
    });

    httpServer.on('error', reject);

    const shutdown = (signal: string) => {
      logger.info(`Received ${signal}, shutting down...`);
      clearInterval(cleanupInterval);
      httpServer.close(() => process.exit(0));
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  });
}
