# CODE_DOCUMENTATION

**arquivo-mcp** — MCP (Model Context Protocol) server for Arquivo.pt, the Portuguese web archive. Enables LLMs to search, retrieve, and analyze archived Portuguese web content from 1996 to present.

---

## Executive Summary

This project provides a standards-compliant MCP server that exposes four tools for accessing Arquivo.pt's API:

- `search_fulltext` — Full-text search with date/site/MIME filters
- `get_url_versions` — Retrieve version history of a specific URL
- `get_page_content` — Extract text content from an archived page
- `search_images` — Search historical images

The server runs as a stdio process, communicates via JSON-RPC, and implements production features: rate limiting (token bucket), exponential backoff retries, request timeouts, graceful shutdown, and structured JSON logging.

---

## Architecture Overview

### Directory Structure

```
src/
├── client/
│   └── ArquivoClient.ts    # API client with throttling, retry, timeout
├── tools/
│   ├── common.ts           # Formatting utilities for output
│   ├── get_page_content.ts # Fetch and extract page text
│   ├── get_url_versions.ts # URL version history tool
│   ├── index.ts            # Tool exports
│   ├── search_fulltext.ts  # Full-text search tool
│   ├── search_images.ts    # Image search tool
│   ├── types.ts            # Parameter TypeScript interfaces
├── utils/
│   ├── HttpError.ts        # HTTP error with Retry-After parsing
│   ├── encoding.ts         # Charset-aware response decoding
│   ├── html.ts             # HTML stripping via cheerio
│   ├── logger.ts           # Structured JSON logger (stderr)
│   ├── retry.ts            # Exponential backoff with jitter
│   ├── throttler.ts        # Token bucket rate limiter
│   ├── tokens.ts           # Token-based truncation
│   └── validation.ts       # Date format validation
└── index.ts                # MCP server entry point and tool registration
```

### Component Responsibilities

| Component       | Responsibility                                                                |
| --------------- | ----------------------------------------------------------------------------- |
| `ArquivoClient` | Low-level API communication: throttling, retry, timeout, JSON parsing         |
| Tool modules    | Parameter validation, client invocation, output formatting, truncation        |
| `common.ts`     | Human-readable output formatters for search results, versions, images         |
| Utilities       | Cross-cutting concerns: logging, retry, rate limiting, encoding, HTML parsing |
| `index.ts`      | MCP server bootstrap, tool registration, request routing, graceful shutdown   |

### Data Flow

1. **MCP Request** → `index.ts` receives `CallToolRequest`
2. **Validation** → Tool function validates parameters (dates, required fields, SSRF)
3. **Client Call** → `ArquivoClient` method with automatic throttling
4. **Retry/Timeout** → `retryWithBackoff` handles 429/5xx, `AbortController` enforces timeout
5. **Formatting** → Tool uses `common.ts` formatters, truncates to 8000 tokens
6. **Response** → Returns MCP `content` array; errors return `isError: true`

---

## Modules

### `src/client/ArquivoClient.ts`

**Class:** `ArquivoClient` — Client for the Arquivo.pt API with built-in resilience.

#### Constructor

```typescript
constructor(options?: {
  maxRequestsPerSecond?: number;
  maxRetries?: number;
  timeoutMs?: number;
})
```

- `maxRequestsPerSecond`: Rate limit (default: 1). Override via `MAX_REQUESTS_PER_SECOND` env var.
- `maxRetries`: Retry attempts on retryable errors (default: 2).
- `timeoutMs`: Request timeout in milliseconds (default: 10000).

**Throttling:** TokenBucket with capacity = rps, refillRate = 1 token/sec.  
**Retry:** Exponential backoff with 0.8–1.2 jitter; respects `Retry-After` header on 429.

#### Public Methods

##### `searchFulltext(params): Promise<SearchResult[]>`

Full-text search on the Portuguese web archive.

**Parameters:**

| Name       | Type   | Required | Description                                                |
| ---------- | ------ | -------- | ---------------------------------------------------------- |
| `query`    | string | ✅       | Search terms; supports `"exact phrases"` and `-exclusions` |
| `from`     | string | ❌       | Start date filter (YYYY or YYYYMMDDHHMMSS)                 |
| `to`       | string | ❌       | End date filter (YYYY or YYYYMMDDHHMMSS)                   |
| `site`     | string | ❌       | Limit to specific domain (e.g., `publico.pt`)              |
| `type`     | string | ❌       | MIME type filter (html, pdf, doc, etc.)                    |
| `maxItems` | number | ❌       | Results per page; defaults to 10, capped at 50             |
| `offset`   | number | ❌       | Pagination offset (default: 0)                             |

**Returns:** `SearchResult[]` with fields:

- `title: string`
- `link: string` — original URL
- `archiveLink: string` — full Arquivo.pt Wayback URL
- `snippet: string` — HTML-stripped excerpt
- `tstamp: string` — archive timestamp
- `size?: number` — response size in bytes (optional)

**Throws:** `HttpError` for HTTP 4xx/5xx; other errors for network/timeouts.

**Side Effects:** None (pure function). Logs debug messages via `logger`.

---

##### `getUrlVersions(params): Promise<Version[]>`

List all archived versions of a specific URL.

**Parameters:**

| Name       | Type   | Required | Description                                       |
| ---------- | ------ | -------- | ------------------------------------------------- |
| `url`      | string | ✅       | URL to look up (with or without protocol)         |
| `from`     | string | ❌       | Start date filter                                 |
| `to`       | string | ❌       | End date filter                                   |
| `maxItems` | number | ❌       | Number of versions; defaults to 20, capped at 100 |
| `offset`   | number | ❌       | Pagination offset (default: 0)                    |

**Returns:** `Version[]` with fields:

- `tstamp: string`
- `status: number` — HTTP status code of archived version
- `link: string` — full Arquivo.pt Wayback URL
- `size?: number` — optional size in bytes

**Throws:** `HttpError` for HTTP errors; other errors for network/timeouts.

**Note:** Uses `/textsearch` endpoint with `versionHistory` parameter.

---

##### `searchImages(params): Promise<ImageResult[]>`

Search historical images in the Portuguese web archive.

**Parameters:**

| Name       | Type   | Required | Description                                    |
| ---------- | ------ | -------- | ---------------------------------------------- |
| `query`    | string | ✅       | Search terms for images                        |
| `from`     | string | ❌       | Start date filter                              |
| `to`       | string | ❌       | End date filter                                |
| `maxItems` | number | ❌       | Results per page; defaults to 10, capped at 20 |
| `offset`   | number | ❌       | Pagination offset (default: 0)                 |

**Returns:** `ImageResult[]` with fields:

- `title: string`
- `imgLink: string` — direct image URL
- `pageLink: string` — source page URL
- `tstamp: string`
- `width?: number` — optional image width
- `height?: number` — optional image height

**Throws:** `HttpError` for HTTP errors; other errors for network/timeouts.

---

##### `fetchPage(archiveUrl, maxTokens?): Promise<{title, content, originalLength}>`

Fetch and extract text content from an archived page.

**Parameters:**

| Name         | Type   | Required | Description                                                   |
| ------------ | ------ | -------- | ------------------------------------------------------------- |
| `archiveUrl` | string | ✅       | Full Arquivo.pt archive URL (must be from `arquivo.pt`)       |
| `maxTokens`  | number | ❌       | Maximum tokens to return; defaults to 4000, clamped 100–16000 |

**Returns:** Object with:

- `title: string` — page title (from `<title>` tag)
- `content: string` — truncated plain text content
- `originalLength: number` — full content length before truncation (bytes)

**Throws:** `Error` if archive page fetch fails or returns non-OK status.

**Side Effects:**

- Logs warning if extracted text fetch fails (falls back to HTML strip)
- Logs warning if operation exceeds 5000ms (performance signal)
- Consumes 2 throttling tokens if extracted text found, 1 otherwise

**Algorithm:**

1. Fetch archive HTML page (throttled)
2. Parse with cheerio, look for extracted text link (`rel="archived text"` or `linkToExtractedText`)
3. If found, fetch extracted text (throttled); on failure, fall back to HTML strip
4. Extract title from `<title>` tag
5. Truncate content to `maxTokens` using word-boundary cut
6. Return title, truncated content, and original length

---

##### `shutdown(): void`

Cleanly shut down the client. Stops the throttler's refill timer to prevent memory leaks.

**Side Effects:** Clears `setInterval` timer; safe to call multiple times.

---

#### Private Methods

##### `request<T>(endpoint, params): Promise<T>`

Internal: Make authenticated GET request with throttling, timeout, retry, JSON parsing.

**Throws:** `HttpError` for non-2xx responses; propagates other errors.

**Note:** Automatically consumes a token from the throttler before proceeding.

---

##### `fetchWithRetryAndTimeout(url, init?, timeoutMs?): Promise<Response>`

Internal: Fetch with retry and timeout, without throttling. Caller must consume token first.

**Throws:** Propagates fetch errors after retry exhaustion.

---

### `src/utils/HttpError.ts`

**Class:** `HttpError extends Error` — Custom error for HTTP responses with metadata.

#### Constructor

```typescript
constructor(status: number, headers: Headers, message?: string)
```

- `status`: HTTP status code (e.g., 429, 500)
- `headers`: Response `Headers` object (for `Retry-After` parsing)
- `message`: Optional error message; defaults to `HTTP {status}`

#### Properties

- `status: number` — Readonly HTTP status code
- `headers: Headers` — Readonly response headers

#### Methods

##### `getRetryAfter(): number | null`

Parse `Retry-After` header and return delay in milliseconds.

**Supports:**

- Seconds format: `Retry-After: 120` → 120000 ms
- HTTP-date format: `Retry-After: Wed, 21 Oct 2015 07:28:00 GMT` → delta from now

**Returns:** `null` if header absent or invalid.

---

### `src/utils/encoding.ts`

**Function:** `decodeResponse(res: Response): Promise<string>`

Decode fetch response body with charset awareness.

**Algorithm:**

1. Read response as `ArrayBuffer`
2. Extract `charset` from `Content-Type` header via regex `charset=([^;]+)`
3. If charset not found, default to `windows-1252` (common for legacy pages)
4. Decode with `TextDecoder(charset)`; on unsupported charset, fallback to UTF-8

**Returns:** Decoded string content.

**Side Effects:** None (pure function).

**Note:** Critical for handling Portuguese-encoded legacy pages (ISO-8859-1, windows-1252).

---

### `src/utils/html.ts`

**Function:** `stripHtml(html: string): string`

Strip HTML tags and decode entities using cheerio.

**Returns:** Plain text content, trimmed.

**Side Effects:** None (pure function).

**Example:**

```typescript
stripHtml('<p>Hello <b>world</b></p>'); // → 'Hello world'
```

---

### `src/utils/logger.ts`

**Class:** `Logger` — Structured JSON logger writing to stderr.

#### Constructor

```typescript
constructor(minLevel: LogLevel = 'info')
```

- `minLevel`: Minimum log level; messages below threshold are ignored.

#### Log Levels

```typescript
type LogLevel = 'debug' | 'info' | 'warn' | 'error';
```

Ordered: `debug` < `info` < `warn` < `error`.

#### Methods

All methods write a JSON line to `stderr` (never `stdout` to avoid MCP protocol interference).

**Format:**

```json
{
  "timestamp": "2025-05-06T00:00:00.000Z",
  "level": "info",
  "message": "Server started",
  ...meta // additional key-value pairs spread into object
}
```

- `debug(message, meta?)`
- `info(message, meta?)`
- `warn(message, meta?)`
- `error(message, meta?)`
- `log(level, message, meta?)` — core implementation

#### Global Instance

```typescript
export const logger = new Logger((process.env.LOG_LEVEL || 'info') as LogLevel);
```

Configure via `LOG_LEVEL` environment variable (`debug`, `info`, `warn`, `error`).

---

### `src/utils/retry.ts`

**Function:** `retryWithBackoff<T>(fn, maxRetries, baseDelayMs, shouldRetry): Promise<T>`

Retry logic with exponential backoff and jitter; respects `Retry-After` header.

**Parameters:**

| Name          | Type                          | Required | Description                             |
| ------------- | ----------------------------- | -------- | --------------------------------------- |
| `fn`          | `() => Promise<T>`            | ✅       | Async function to retry                 |
| `maxRetries`  | number                        | ❌       | Max attempts (default: 2)               |
| `baseDelayMs` | number                        | ❌       | Base delay in ms (default: 1000)        |
| `shouldRetry` | `(error, attempt) => boolean` | ✅       | Predicate: true to retry, false to fail |

**Returns:** Successful result from `fn`.

**Throws:** Last error if all retries exhausted or `shouldRetry` returns `false`.

**Algorithm:**

- Attempts `0..maxRetries` inclusive (total `maxRetries + 1` tries)
- On error:
  - If `HttpError` with `Retry-After` header, use that delay (ms)
  - Else: `delay = baseDelayMs * 2^attempt * jitter(0.8–1.2)`
  - `jitter` adds ±20% randomness to avoid thundering herd
  - Sleep `delay` ms before next attempt

**Side Effects:** None internally; caller should log retries if desired.

---

**Function:** `isRetryableError(error: unknown): boolean`

Determine if an error is safe to retry.

**Retryable Conditions:**

- `HttpError` with status 429 (rate limit) or 5xx (server errors)
- Legacy shape: `error.response.status` 429/5xx (for compatibility)
- Network errors: `ECONNABORTED` (timeout), `ENETUNREACH` (network unreachable)
- `AbortError` from `AbortController` (Node.js fetch timeout)

**Returns:** `true` if operation should be retried.

**Note:** Does not log; used by `retryWithBackoff` only.

---

### `src/utils/throttler.ts`

**Class:** `TokenBucket` — Token bucket rate limiter.

#### Constructor

```typescript
constructor(capacity: number, refillRate: number)
```

- `capacity`: Maximum tokens (burst size). Also initial token count.
- `refillRate`: Tokens added per second (steady drip).

**Side Effects:** Starts a 100ms interval to gradually refill tokens based on elapsed time.

#### Methods

##### `async consume(): Promise<void>`

Consume one token, blocking until available if bucket empty.

**Algorithm:** Busy-wait loop with 50ms sleeps until `tokens >= 1`, then decrement.

**Throws:** Never; waits indefinitely until token available.

**Side Effects:** Decrements internal token count.

---

##### `stop(): void`

Stop the background refill timer.

**Side Effects:** Clears interval; safe to call multiple times.

**Usage:** Call during graceful shutdown to prevent memory leaks.

---

### `src/utils/tokens.ts`

**Function:** `truncateToTokens(text: string, maxTokens: number): string`

Truncate text to approximately `maxTokens` tokens (rough approximation).

**Algorithm:**

- 1 token ≈ 4 characters (`maxChars = maxTokens * 4`)
- If `text.length <= maxChars`, return full text
- Else, cut at last space before limit to avoid partial words
- Append `'...[truncated]'` suffix

**Returns:** Truncated string ending at word boundary with `[truncated]` marker.

**Side Effects:** None (pure function).

**Note:** Approximate only; actual token count varies by tokenizer.

---

### `src/utils/validation.ts`

**Function:** `isValidDateRange(date?: string): boolean`

Validate date parameter format for API queries.

**Accepted Formats:**

- `YYYY` (4 digits)
- `YYYYMMDDHHMMSS` (up to 14 digits; partial prefixes allowed)
- Empty/undefined (allowed, means no filter)

**Examples:**

- `'2023'` → valid
- `'20230101'` → valid
- `'20230101120000'` → valid
- `'2023-01-01'` → invalid (hyphens not allowed)
- `'abc'` → invalid

**Returns:** `true` if format valid or empty; `false` otherwise.

**Note:** Does not validate date semantics (e.g., February 30); only digit length.

---

### `src/tools/common.ts`

**Constants:**

- `MAX_TOKENS = 8000` — Maximum output token limit (RNF-02)
- `MAX_CHARS = MAX_TOKENS * 4` — ~32000 characters

**Functions:**

#### `truncateOutput(output: string): string`

Truncate output string to `MAX_CHARS`, cutting at last newline to avoid partial lines.

**Returns:** Truncated string with `'\n\n[Output truncated due to token limit]'` suffix if cut.

---

#### `formatDate(tstamp: string): string`

Format `YYYYMMDD...` timestamp into `YYYY-MM-DD` (8-digit format).

**Returns:** Formatted `YYYY-MM-DD` if at least 8 digits; otherwise returns raw prefix unchanged.

---

#### `extractHostname(url: string): string`

Extract clean hostname from URL, stripping `www.` prefix.

**Returns:** Hostname (e.g., `publico.pt`) or raw URL on parse error.

---

#### `formatSearchResults(query, from?, to?, results, offset = 0, total?): string`

Format full-text search results into human-readable, LLM-friendly string.

**Output Structure:**

```
[<count> resultados para "<query>" <dateRange>]

1. <title> (<hostname> — <date>)
   URL original: <link>
   Arquivo: <archiveLink>
   Snippet: <snippet>

[Próxima página disponível: offset=<nextOffset>]  // if more results
```

**Parameters:**

| Name      | Type                                                        | Required | Description                                                |
| --------- | ----------------------------------------------------------- | -------- | ---------------------------------------------------------- |
| `query`   | string                                                      | ✅       | Original search query (echoed in header)                   |
| `from`    | string                                                      | ❌       | Start date filter for display                              |
| `to`      | string                                                      | ❌       | End date filter for display                                |
| `results` | `Array<{title, link, archiveLink, snippet, tstamp, size?}>` | ✅       | Search result items                                        |
| `offset`  | number                                                      | ❌       | Pagination offset; added to result numbering               |
| `total`   | number                                                      | ❌       | Optional total count; shows next-page hint if more results |

**Returns:** Formatted string, truncated at `MAX_TOKENS` via `truncateOutput()`.

---

#### `formatVersionResults(url, results, offset = 0, total?): string`

Format version history into readable string.

**Output Structure:**

```
[<count> versões arquivadas de <url>]

1. <date> — HTTP <status>
   Arquivo: <link>
   Tamanho: <size> KB  // if available

[Próxima página disponível: offset=<nextOffset>]  // if more results
```

**Parameters:**

| Name      | Type                                   | Required | Description                              |
| --------- | -------------------------------------- | -------- | ---------------------------------------- |
| `url`     | string                                 | ✅       | Original URL being versioned             |
| `results` | `Array<{tstamp, status, link, size?}>` | ✅       | Version items                            |
| `offset`  | number                                 | ❌       | Pagination offset; added to numbering    |
| `total`   | number                                 | ❌       | Optional total count for pagination hint |

**Returns:** Formatted string, truncated at `MAX_TOKENS`.

---

#### `formatImageResults(query, results, offset = 0, total?): string`

Format image search results into readable string.

**Output Structure:**

```
[<count> imagens para "<query>"]

1. <title>
   URL imagem: <imgLink>
   Página de origem: <pageLink>
   Data: <date>
   Dimensões: <width>x<height>  // if available

[Próxima página disponível: offset=<nextOffset>]  // if more results
```

**Parameters:**

| Name      | Type                                                         | Required | Description           |
| --------- | ------------------------------------------------------------ | -------- | --------------------- |
| `query`   | string                                                       | ✅       | Original search query |
| `results` | `Array<{title, imgLink, pageLink, tstamp, width?, height?}>` | ✅       | Image result items    |
| `offset`  | number                                                       | ❌       | Pagination offset     |
| `total`   | number                                                       | ❌       | Optional total count  |

**Returns:** Formatted string, truncated at `MAX_TOKENS`.

---

### `src/tools/types.ts`

**Parameter Interfaces** for MCP tool input validation.

#### `SearchFulltextParams`

```typescript
export interface SearchFulltextParams {
  query: string;
  from?: string;
  to?: string;
  site?: string;
  type?: string;
  maxItems?: number;
  offset?: number;
}
```

---

#### `GetUrlVersionsParams`

```typescript
export interface GetUrlVersionsParams {
  url: string;
  from?: string;
  to?: string;
  maxItems?: number;
  offset?: number;
}
```

---

#### `GetPageContentParams`

```typescript
export interface GetPageContentParams {
  archive_url: string;
  max_tokens?: number;
}
```

---

#### `SearchImagesParams`

```typescript
export interface SearchImagesParams {
  query: string;
  from?: string;
  to?: string;
  maxItems?: number;
  offset?: number;
}
```

---

### Tool Implementations

All tools follow the same pattern:

1. **Validate** required parameters and date formats
2. **Clamp** numeric limits to API-acceptable ranges
3. **Call** corresponding `ArquivoClient` method
4. **Format** results using `common.ts` functions
5. **Truncate** output to 8000 tokens
6. **Return** `{ content: [{ text }] }` or throw error

#### `src/tools/search_fulltext.ts`

**Exports:** `searchFulltextTool(client, params): Promise<{ content: Array<{text: string}> }>`

**Validation:**

- `query` required, non-empty
- `from` and `to` validated via `isValidDateRange()`
- `maxItems` clamped to 1–50
- `offset` clamped to ≥0

**Calls:** `client.searchFulltext()`

**Returns:** Formatted output from `formatSearchResults()`, truncated to 8000 tokens.

**Throws:** `Error` on validation failure or API error.

---

#### `src/tools/get_url_versions.ts`

**Exports:** `getUrlVersionsTool(client, params): Promise<{ content: Array<{text: string}> }>`

**Validation:**

- `url` required, non-empty
- `from` and `to` validated via `isValidDateRange()`
- `maxItems` clamped to 1–100
- `offset` clamped to ≥0

**Calls:** `client.getUrlVersions()`

**Returns:** `formatVersionResults()` output, truncated to 8000 tokens.

**Throws:** `Error` on validation failure or API error.

---

#### `src/tools/get_page_content.ts`

**Exports:** `getPageContentTool(client, params): Promise<{ content: Array<{text: string}> }>`

**Validation:**

- `archive_url` required, non-empty
- SSRF protection: `isArquivoUrl()` ensures hostname is `arquivo.pt` or `*.arquivo.pt`
- `max_tokens` clamped to 100–16000

**Calls:** `client.fetchPage()`

**Output Format:**

```
[Conteúdo de: <archiveUrl> — <title>]

TÍTULO: <title>

TEXTO:
<truncated content>

[Truncado. Tamanho original: <originalKB> KB]  // if truncated
[AVISO: Operação demorou X.Xs]  // if >5s
```

**Returns:** Formatted text content, truncated to `max_tokens`.

**Throws:** `Error` if validation fails or fetch error.

**Side Effects:**

- Logs warning if duration > 5000ms
- Logs error on failure with params

---

#### `src/tools/search_images.ts`

**Exports:** `searchImagesTool(client, params): Promise<{ content: Array<{text: string}> }>`

**Validation:**

- `query` required, non-empty
- `from` and `to` validated via `isValidDateRange()`
- `maxItems` clamped to 1–20
- `offset` clamped to ≥0

**Calls:** `client.searchImages()`

**Returns:** `formatImageResults()` output, truncated to 8000 tokens.

**Throws:** `Error` on validation failure or API error.

---

### `src/tools/index.ts`

Re-exports all tool functions:

- `searchFulltextTool`
- `getUrlVersionsTool`
- `getPageContentTool`
- `searchImagesTool`

---

### `src/index.ts`

**Entry Point** — MCP server bootstrap and lifecycle management.

#### `main(): Promise<void>`

Initializes and runs the MCP server.

**Setup:**

1. Create `Server` instance with name `'arquivo-mcp'`, version `'0.1.0'`
2. Instantiate `ArquivoClient` with defaults (1 RPS, 2 retries, 10s timeout)
3. Define 4 tools with JSON schema input validation
4. Register request handlers:
   - `ListToolsRequestSchema` → returns tool list
   - `CallToolRequestSchema` → routes to appropriate tool function
5. Connect via `StdioServerTransport` (stdio for MCP communication)
6. Log info: `'arquivo-mcp server started with tools'`
7. Register signal handlers for graceful shutdown:
   - `SIGINT` → `shutdown('SIGINT')`
   - `SIGTERM` → `shutdown('SIGTERM')`
8. Await `server.connect()` (blocks indefinitely)

**Shutdown Flow:**

- Log receipt of signal
- Call `client.shutdown()` to stop throttler interval
- Exit process with code 0

**Error Handling:**

- Fatal errors in `main()` caught by `.catch()` at bottom
- Logs error with stack, exits with code 1
- Tool errors caught within request handler, returned as `isError: true` content

---

## Configuration

### Environment Variables

| Variable                  | Type                                   | Default | Description                                                                                                             |
| ------------------------- | -------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------- |
| `MAX_REQUESTS_PER_SECOND` | number                                 | `1`     | Outgoing API request rate limit. Arquivo.pt allows ~250 requests per 180 seconds; set conservatively based on workload. |
| `LOG_LEVEL`               | `debug` \| `info` \| `warn` \| `error` | `info`  | Minimum log level for structured JSON output to stderr. Use `debug` for verbose request/error logs.                     |

**Note:** Logs are always written to `stderr` to avoid interfering with MCP protocol on `stdout`.

### Build Configuration

- **TypeScript:** ES2022 target, ESNext modules, strict mode enabled
- **Output:** `dist/` directory (compiled JavaScript)
- **Type declarations:** `.d.ts` files generated alongside JS

---

## Production Notes

### Rate Limits

**Arquivo.pt API:** ~250 requests per 180 seconds per IP (enforced by server).

**Client-side Throttling:**

- Default: 1 request per second (sustainable long-term)
- Configurable via `MAX_REQUESTS_PER_SECOND` or `ArquivoClient` constructor
- TokenBucket implementation ensures steady drip; bursts up to `capacity` allowed

**Recommendation:** Keep default 1 RPS for production; increase only if you have explicit permission from Arquivo.pt.

---

### Timeouts

- **Default:** 10 seconds (`timeoutMs = 10000`)
- Applies to all HTTP requests (archive page, extracted text, API calls)
- Uses `AbortController`; on timeout, `AbortError` is thrown and retried if within `maxRetries`

**Rationale:** Prevents hanging indefinitely on slow responses; fits typical page fetch latency.

---

### Retry Strategy

- **Max retries:** 2 (total attempts = 3)
- **Backoff:** Exponential: `baseDelayMs * 2^attempt` (default base = 1000ms)
- **Jitter:** ±20% random factor to avoid synchronized retry storms
- **Retry-After:** If present on `HttpError` (429), uses server-suggested delay (overrides backoff)
- **Retryable statuses:** 429 (rate limit), 5xx (server errors)
- **Retryable errors:** `ECONNABORTED` (timeout), `ENETUNREACH` (network), `AbortError`

---

### Graceful Shutdown

- **Signals handled:** `SIGINT` (Ctrl+C), `SIGTERM` (systemd/k8s)
- **Cleanup:** Calls `ArquivoClient.shutdown()` → stops `TokenBucket` interval
- **Exit code:** 0 on graceful shutdown, 1 on fatal error
- **In-flight requests:** Not cancelled; server waits for current request to complete before exiting. If you need immediate termination, use `SIGKILL`.

---

### Logging

**Structured JSON** to stderr:

```json
{
  "timestamp": "2025-05-06T00:00:00.000Z",
  "level": "info",
  "message": "arquivo-mcp server started with tools"
}
```

**Common Log Points:**

- Server start: `logger.info('arquivo-mcp server started with tools')`
- Shutdown: `logger.info('Received ${signal}, shutting down gracefully...')`
- Tool errors: `logger.error('tool_name error', { error, params })`
- Performance: `logger.warn('get_page_content took >5s', { duration, archiveUrl })`
- Debug: `logger.debug('Making request', { url })` (only if `LOG_LEVEL=debug`)

**Integration:** Capture via `journalctl` (systemd), Docker logs, or any log collector. Parse JSON for structured analysis.

---

### SSRF Protection

`get_page_content` validates that `archive_url` belongs to `arquivo.pt` domain (exact match or subdomain). Prevents server-side request forgery attacks where malicious URLs could be used to probe internal network.

**Validation:** `isArquivoUrl()` checks `hostname === 'arquivo.pt' || hostname.endsWith('.arquivo.pt')`.

---

### Output Truncation

All tool outputs are truncated to **8000 tokens** (~32000 characters) to prevent oversized responses that exceed LLM context windows.

**Enforcement:**

- `search_fulltext`, `get_url_versions`, `search_images`: `truncateToTokens(output, 8000)` after formatting
- `get_page_content`: `truncateToTokens(content, maxTokens)` with default 4000, max 16000

**Truncation strategy:** Cut at last word boundary before limit, append `'...[truncated]'` or `'[Output truncated due to token limit]'`.

---

## Testing

### Test Framework

- **Runner:** Vitest
- **Location:** `tests/` (mirrors `src/` structure)
- **Config:** `vitest.config.ts` (defaults; environment: node)

### Test Types

#### Unit Tests (`tests/unit/`)

Test isolated modules with mocks/stubs.

**Coverage Targets:**

| File                     | Unit Tests                                                                 |
| ------------------------ | -------------------------------------------------------------------------- |
| `ArquivoClient.ts`       | `ArquivoClient.test.ts` — request logic, retry integration, error handling |
| `common.ts`              | `tools_format.test.ts` — formatters for search, versions, images           |
| `encoding.ts`            | `encoding.test.ts` — charset detection, fallback behavior                  |
| `html.ts`                | `html.test.ts` — HTML stripping, entity decoding                           |
| `logger.ts`              | `logger.test.ts` — JSON output, level filtering                            |
| `retry.ts`               | `retry.test.ts` — backoff, jitter, Retry-After, isRetryableError           |
| `throttler.ts`           | `throttler.test.ts` — token consumption, refill rate, stop()               |
| `tokens.ts`              | `tokens.test.ts` — truncation at word boundaries                           |
| `validation.ts`          | `validation.test.ts` — date format validation                              |
| Tools (param validation) | `tools.test.ts` — parameter clamping, error paths                          |

**Run:** `npm test` or `make test`  
**Excludes:** Integration tests (`--exclude tests/integration`)

---

#### Integration Tests (`tests/integration/`)

Hit real Arquivo.pt API (slow, depends on network). Requires live internet connection.

**Test Files:**

- `search_fulltext.integration.test.ts` — end-to-end search
- `get_url_versions.integration.test.ts` — version lookup
- `get_page_content.integration.test.ts` — page fetch and extraction
- `search_images.integration.test.ts` — image search

**Timeouts:** 90–180 seconds (generous for network latency).

**Run:** `npm run test:integration`

---

### Quality Gates

`make check` runs:

1. **docs-check** — Verifies required documentation files exist with substantive content
2. **code-check** — Ensures `src/` directory exists; checks for `TODO:` comments
3. **lint-check** — ESLint with project config
4. **test-check** — Runs unit test suite

---

## API Reference Summary

### Tools

| Tool               | Purpose             | Max Results   | Timeout | Retries |
| ------------------ | ------------------- | ------------- | ------- | ------- |
| `search_fulltext`  | Full-text search    | 50            | 10s     | 2       |
| `get_url_versions` | URL version history | 100           | 10s     | 2       |
| `get_page_content` | Extract page text   | N/A (content) | 10s     | 2       |
| `search_images`    | Image search        | 20            | 10s     | 2       |

### Rate Limits

| Limit              | Value             | Scope                 |
| ------------------ | ----------------- | --------------------- |
| Arquivo.pt API     | ~250 req / 180s   | Per IP                |
| Client default     | 1 req/s           | Configurable          |
| Token bucket burst | `capacity` tokens | Instant burst allowed |

---

## Installation & Deployment

### Build

```bash
npm ci           # Install dependencies
npm run build    # Compile TypeScript to dist/
```

### Run

```bash
# Development (watch mode)
npm run dev      # tsx --watch src/index.ts

# Production
node dist/index.js
```

### Systemd Service

See `README.md` for full service file example.

Key settings:

- `Environment="MAX_REQUESTS_PER_SECOND=1"`
- `Environment="LOG_LEVEL=info"`
- `StandardOutput=journal` / `StandardError=journal`
- `Restart=on-failure`

### Docker

Multi-stage build recommended:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
RUN npm ci --only=production
ENV MAX_REQUESTS_PER_SECOND=1
CMD ["node", "dist/index.js"]
```

---

## Error Handling

### Tool Errors

Errors within tool execution are caught by the MCP request handler and returned as:

```json
{
  "content": [{ "text": "Error: <message>" }],
  "isError": true
}
```

This signals to the LLM that the tool failed and the error message should be displayed.

### Fatal Errors

Uncaught errors in `main()` (e.g., server startup failure) log to stderr and exit with code 1.

---

## TypeScript Types

All public interfaces exported:

```typescript
// Client
export interface SearchResult { title, link, archiveLink, snippet, tstamp, size? }
export interface Version { tstamp, status, link, size? }
export interface ImageResult { title, imgLink, pageLink, tstamp, width?, height? }

// Tools
export interface SearchFulltextParams
export interface GetUrlVersionsParams
export interface GetPageContentParams
export interface SearchImagesParams

// Utils
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
```

Strict mode enabled; no `any` types used.

---

## Security Considerations

1. **SSRF:** `get_page_content` validates `archive_url` hostname is `arquivo.pt` or subdomain.
2. **Input Validation:** All date parameters validated via `isValidDateRange()` (digit length only).
3. **Rate Limiting:** Token bucket prevents accidental DoS of Arquivo.pt API.
4. **User-Agent:** Fixed to `arquivo-mcp/0.1.0` for identification.
5. **Secrets:** No secret handling required (Arquivo.pt API is public).
6. **Logging:** Structured JSON avoids leaking sensitive metadata; `logger` writes to stderr only.

---

## Performance Characteristics

| Operation          | Typical Latency | 95th Percentile | Notes                                                                     |
| ------------------ | --------------- | --------------- | ------------------------------------------------------------------------- |
| `search_fulltext`  | 200–500ms       | <1s             | Depends on result set size                                                |
| `get_url_versions` | 200–500ms       | <1s             | Similar to search                                                         |
| `search_images`    | 300–700ms       | <1s             | Slightly slower due to image metadata                                     |
| `get_page_content` | 1–3s            | 5s+             | Two fetches (HTML + optional extracted text); can be slow for large pages |

**Optimization Tips:**

- Use smaller `maxItems` for faster responses
- Use smaller `max_tokens` for `get_page_content` to reduce truncation and transfer size
- Cache results client-side if repeating queries

---

## Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "cheerio": "^1.2.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "eslint": "^9.0.0",
    "prettier": "^3.0.0",
    "vitest": "^1.0.0"
    // ...plus @eslint/*, @types/node, tsx
  }
}
```

**Runtime:** Minimal (~2 dependencies). No native modules.

---

## License

MIT

---

## Acknowledgments

- [Arquivo.pt](https://arquivo.pt) — preserving Portuguese web since 1996
- [Model Context Protocol](https://modelcontextprotocol.io) — standard for LLM tool integration
- Built with Claude Code assistance

---

_Documentation generated from source JSDoc comments and architecture review._  
_Last updated: 2025-05-06_
