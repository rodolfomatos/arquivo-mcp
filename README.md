# arquivo-mcp

**MCP (Model Context Protocol) server for [Arquivo.pt](https://arquivo.pt) — the Portuguese web archive.**

Access decades of archived Portuguese web content directly from LLMs like Claude, Cursor, and any MCP-compatible client. Search full-text, retrieve page versions, fetch content, and find historical images without leaving your conversation.

## Features

- `search_fulltext` — Full-text search with date and site filters
- `get_url_versions` — List all archived versions of a specific URL
- `get_page_content` — Extract text content from an archived page
- `search_images` — Search historical images

## Quick Start

### Installation

```bash
# Using npm (global install)
npm install -g arquivo-mcp

# Or use npx (no install needed)
npx arquivo-mcp
```

### Build from source

```bash
git clone https://github.com/yourusername/arquivo-mcp
cd arquivo-mcp
make setup
make build
```

## Configuration

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "arquivo": {
      "command": "arquivo-mcp"
    }
  }
}
```

If installed locally without global bin:

```json
{
  "mcpServers": {
    "arquivo": {
      "command": "node",
      "args": ["/path/to/arquivo-mcp/dist/index.js"]
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "arquivo": {
      "command": "arquivo-mcp"
    }
  }
}
```

Restart Cursor after configuring.

### Environment Variables

- `LOG_LEVEL` — Set the minimum log level for structured JSON output to stderr. Options: `debug`, `info`, `warn`, `error`. Default: `info`. Useful for troubleshooting; logs are sent to stderr and do not interfere with MCP communication on stdout.

## Usage

Once configured, the tools are available in your LLM chat. Example prompts:

```
"Search for news about Portugal in 2008"
→ LLM uses search_fulltext

"Show me all archived versions of publico.pt"
→ LLM uses get_url_versions

"Get the content of this archived article: https://arquivo.pt/wayback/..."
→ LLM uses get_page_content

"Find images of Lisbon in the 1990s"
→ LLM uses search_images
```

### Tool Parameters

#### search_fulltext

| Parameter  | Type   | Required | Description                                               |
| ---------- | ------ | -------- | --------------------------------------------------------- |
| `query`    | string | ✅       | Search terms (supports "exact phrases" and `-exclusions`) |
| `from`     | string | ❌       | Start date (YYYY or YYYYMMDDHHMMSS). Default: 1996        |
| `to`       | string | ❌       | End date (YYYY or YYYYMMDDHHMMSS). Default: last year     |
| `site`     | string | ❌       | Limit to a domain (e.g., `publico.pt`)                    |
| `type`     | string | ❌       | MIME type filter (html, pdf, doc). Default: html          |
| `maxItems` | number | ❌       | Results per page (default: 10, max: 50)                   |
| `offset`   | number | ❌       | Pagination offset (default: 0)                            |

#### get_url_versions

| Parameter  | Type   | Required | Description                                |
| ---------- | ------ | -------- | ------------------------------------------ |
| `url`      | string | ✅       | URL to look up (with or without protocol)  |
| `from`     | string | ❌       | Start date filter                          |
| `to`       | string | ❌       | End date filter                            |
| `maxItems` | number | ❌       | Number of versions (default: 20, max: 100) |
| `offset`   | number | ❌       | Pagination offset (default: 0)             |

#### get_page_content

| Parameter     | Type   | Required | Description                                      |
| ------------- | ------ | -------- | ------------------------------------------------ |
| `archive_url` | string | ✅       | Full Arquivo.pt URL (wayback link)               |
| `max_tokens`  | number | ❌       | Max tokens to return (default: 4000, max: 16000) |

#### search_images

| Parameter  | Type   | Required | Description                             |
| ---------- | ------ | -------- | --------------------------------------- |
| `query`    | string | ✅       | Search terms for images                 |
| `from`     | string | ❌       | Start date                              |
| `to`       | string | ❌       | End date                                |
| `maxItems` | number | ❌       | Results per page (default: 10, max: 20) |
| `offset`   | number | ❌       | Pagination offset (default: 0)          |

## Rate Limits & Performance

Arquivo.pt API rate limit: **250 requests per 180 seconds** per IP.

This MCP server enforces:

- **1 request/second** internal throttling
- **Retry with exponential backoff** on HTTP 429 (max 2 retries)
- **10-second timeout** on all requests

If you hit rate limits, the server will automatically back off and retry.

## Troubleshooting

### Server not starting

- Ensure `dist/index.js` exists (run `make build` first)
- Check that port 8000 is not blocked (if using observatory mode)

### Tools not showing in Claude

- Restart Claude Desktop after adding to config
- Check `~/.config/Claude/claude_desktop_config.json` (Linux/macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows)
- Enable MCP logging in Claude settings to see connection errors

### Slow responses

- `get_page_content` can take up to 10 seconds (fetching remote pages)
- Consider using a smaller `max_tokens` for faster responses

### Rate limited

- Reduce concurrent queries
- The server handles retries automatically; wait a moment and try again

## Development

```bash
# Install dependencies
make setup

# Build
make build

# Run in dev mode (watch)
npm run dev

# Lint
make lint

# Format
make format

# Run tests
make test

# Run integration tests (hits real API)
npm run test:integration

# Run all quality gates
make check
```

## Production Deployment

### Environment Variables

- `MAX_REQUESTS_PER_SECOND` — Rate limit for outgoing requests to Arquivo.pt API (default: 1). The API allows ~250 requests per 180 seconds; adjust conservatively based on your workload.
- `LOG_LEVEL` — Logging level (`debug`, `info`, `warn`, `error`). Default: `info`. Logs are written to stderr in JSON format.

### Running as a Systemd Service

Create `/etc/systemd/system/arquivo-mcp.service`:

```ini
[Unit]
Description=Arquivo MCP Server
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/arquivo-mcp
Environment="MAX_REQUESTS_PER_SECOND=1"
Environment="LOG_LEVEL=info"
ExecStart=/usr/bin/node /path/to/arquivo-mcp/dist/index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now arquivo-mcp
sudo journalctl -u arquivo-mcp -f  # view logs
```

### Docker

Example `Dockerfile`:

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
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
```

Build and run:

```bash
docker build -t arquivo-mcp .
docker run -d --name arquivo-mcp --restart unless-stopped -e MAX_REQUESTS_PER_SECOND=1 arquivo-mcp
docker logs -f arquivo-mcp
```

### Observability

- Logs are JSON on stderr; capture via `journalctl`, Docker logs, or any log collector.
- Set `LOG_LEVEL=debug` for verbose request/error logs.
- The server does not expose metrics endpoints; monitor via logs and process health.

## Project Status

- **v1.0.0** (planned) — All core tools implemented and tested
- See [ROADMAP.md](docs/ROADMAP.md) for detailed milestones and backlog

## License

MIT

## Acknowledgments

- [Arquivo.pt](https://arquivo.pt) — preserving Portuguese web since 1996
- [Model Context Protocol](https://modelcontextprotocol.io) — standard for LLM tool integration

# arquivo-mcp
