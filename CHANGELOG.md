# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Environment variable configuration: `MAX_REQUESTS_PER_SECOND` to tune rate limiting
- `LOG_LEVEL` documented for controlling structured log verbosity

### Fixed

- SSRF vulnerability in `get_page_content` by validating `arquivo.pt` domain
- Pagination offset now clamped to non-negative values (prevents API errors)
- Latency warning logged and displayed when `get_page_content` exceeds 5s
- Retry logic now includes jitter (±20%) and respects `Retry-After` header
- `HttpError` class replaces unsafe casts (`@ts-expect-error`)
- Output truncation: all paginated tools limited to 8000 tokens (RNF-02)
- Unit test coverage expanded: `validation.test.ts`, `encoding.test.ts`, `logger.test.ts`

### Technical improvements

- Graceful shutdown: handles SIGINT/SIGTERM, stops throttler
- Integration test timeouts increased to 90–180s for stability
- Type safety: removed `any` casts, created `src/tools/types.ts` for parameter interfaces
- Build, lint, and tests passing via `make check`

### Known issues

- Moderate vulnerability in `ip-address` (transitive via MCP SDK). Awaiting upstream fix.

## [1.0.0] - Planned

Initial public release targeting production use with Claude Desktop and Cursor.

### Added

- Full documentation (README, VISION, PERSONAS, REQUIREMENTS, ROADMAP)
- CLI accessibility via `npx arquivo-mcp` and global `npm install -g`
- Configuration examples for Claude Desktop and Cursor
- GitHub Actions CI (lint + build + unit tests)

## [0.1.0] - YYYY-MM-DD (Development)

Initial development milestone. Not published.

- Project inception
- Basic MCP server structure
- ArquivoClient prototype
