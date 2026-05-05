# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Milestone 0: Project scaffolding (TypeScript, ESLint, Prettier, Makefile, CI)
- Milestone 1: HTTP client with token bucket throttling, retry logic, structured logging
- Milestone 2: Tools `search_fulltext` and `get_url_versions` with MCP integration
- Milestone 3: Tools `get_page_content` and `search_images`
- Unit test suite with 47 passing tests (Vitest)
- Integration tests for all tools (marked `[integration]`)

### Features (MCP Tools)

- `search_fulltext`: Full-text search with date/site/type filters
- `get_url_versions`: List all archived versions of a URL
- `get_page_content`: Extract and truncate page content (with fallback to HTML scraping)
- `search_images`: Search historical images

### Technical

- TypeScript with strict mode
- Token bucket rate limiter (1 req/s)
- Exponential backoff retry (max 2 attempts)
- 10-second timeout on all HTTP requests
- Cheerio-based HTML stripping
- Token-aware truncation (~4 chars/token)
- JSON-structured logging to stderr

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
