# arquivo-mcp

**MCP server for Arquivo.pt — access Portuguese web archive from LLMs**

A Model Context Protocol (MCP) server that allows Claude Desktop, OpenCode, and other MCP clients to search and retrieve historical web content from [Arquivo.pt](https://arquivo.pt), the Portuguese web archive.

---

## Features

- **Full-text search**: Search historical web pages by query, date range, domain, and MIME type
- **URL versions**: List all archived versions of a specific URL
- **Page content**: Fetch extracted text from archived pages (best-effort)
- **Image search**: Find historical images with metadata

All tools return clean, LLM-friendly text output, respecting token limits (default 8000 tokens).

---

## Installation

### Claude Desktop

```bash
# Global install
npm install -g arquivo-mcp

# Configure Claude Desktop
make install-claude
```

Restart Claude Desktop. The tools will appear automatically.

### OpenCode (local project)

```bash
# In your project directory
git clone https://github.com/yourusername/arquivo-mcp.git
cd arquivo-mcp
make setup
make build
make install-opencode
```

Run `opencode` in the project directory to start the server.

---

## Configuration

Environment variables:

| Variable                  | Default  | Description                                                                               |
| ------------------------- | -------- | ----------------------------------------------------------------------------------------- |
| `MAX_REQUESTS_PER_SECOND` | `1`      | Rate limit for outgoing API calls (Arquivo.pt limit)                                      |
| `MAX_RETRIES`             | `4`      | Number of retry attempts on network errors                                                |
| `TIMEOUT_MS`              | `120000` | Base timeout in milliseconds (adaptive: max(base, 30s + maxItems×600ms), clamped 30–180s) |
| `LOG_LEVEL`               | `info`   | Logging level: `debug`, `info`, `warn`, `error`                                           |

---

## Tools

All tools are exposed via MCP `call_tool` requests. See [DEMONSTRATION.md](docs/DEMONSTRATION.md) for usage examples.

### 1. `arquivo_search_fulltext`

Full-text search across the Portuguese web archive.

**Parameters:**

- `query` (required) — search terms, supports `"exact phrases"` and `-exclusions`
- `from` (optional) — start date (YYYY or YYYYMMDDHHMMSS)
- `to` (optional) — end date
- `site` (optional) — limit to specific domain (e.g., `publico.pt`)
- `type` (optional) — MIME type filter (html, pdf, doc, etc.)
- `maxItems` (optional) — number of results (default 10, max 50)
- `offset` (optional) — pagination offset (default 0)

**Output:** Formatted list with title, URL, archive URL, date, and snippet.

### 2. `arquivo_get_url_versions`

List all archived versions of a given URL.

**Parameters:**

- `url` (required) — URL to check (domain only or full URL)
- `from` (optional) — start date filter
- `to` (optional) — end date filter
- `maxItems` (optional) — number of versions (default 20, max 100)
- `offset` (optional) — pagination

**Output:** Formatted list with timestamp, archive link, size.

### 3. `arquivo_get_page_content`

Retrieve text content from an archived page.

**Parameters:**

- `archive_url` (required) — full Arquivo.pt archive URL (must be from `arquivo.pt` domain)
- `max_tokens` (optional) — maximum tokens to return (default 4000, min 100, max 16000)

**Output:** Title and extracted text. Note: many pages are inside Wayback Machine iframes; extracted text may be limited. Best results with `link[rel="archived text"]` pages.

### 4. `arquivo_search_images`

Search for historical images.

**Parameters:**

- `query` (required) — search terms
- `from` (optional) — start date
- `to` (optional) — end date
- `maxItems` (optional) — number of images (default 10, max 50)
- `offset` (optional) — pagination

**Output:** List with image URL, page URL, date, dimensions.

---

## Troubleshooting

**Tools not appearing in Claude Desktop?**

- Restart Claude Desktop after installation
- Verify global install: `npm list -g arquivo-mcp`
- Check `~/.config/Claude/claude_desktop_config.json` contains the entry

**Requests failing with timeout?**

- Increase `TIMEOUT_MS` (e.g., `export TIMEOUT_MS=180000` before starting)
- The Arquivo.pt API can be slow for some queries (30–60s is normal)
- The server automatically retries transient errors up to 4 times

**Rate limit errors?**

- Default is 1 request/second to respect Arquivo.pt limits
- Adjust via `MAX_REQUESTS_PER_SECOND` if needed (be polite)
- Backoff is automatic; wait a moment and retry

**`get_page_content` returns JavaScript wrapper?**

- This is a known limitation: many archived pages load content via iframe
- The tool attempts to extract text links; if none found, it falls back to HTML strip
- For full page content, you may need to open the archive URL in a browser

---

## Development

```bash
make setup      # npm ci
make build      # TypeScript → dist/
make test       # Vitest (unit only)
make lint       # ESLint
make format     # Prettier
make check      # Docs + lint + tests (pre-commit)
```

See [AGENTS.md](AGENTS.md) for detailed agent instructions and gotchas.

---

## License

MIT — see [LICENSE](LICENSE) file.

---

## Credits

Built for the [Arquivo.pt](https://arquivo.pt) web archive. Uses the official MCP SDK.
